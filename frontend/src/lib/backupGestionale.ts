import crypto from 'crypto'
import zlib from 'zlib'
import { promisify } from 'util'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getValidGoogleToken } from '@/lib/googleAuth'
import {
  createDriveClient,
  createDriveFolderInSharedDrive,
  findOrCreateSharedDrive,
  listSharedDriveFiles,
  uploadFileToFolder
} from '@/lib/googleDrive'

/**
 * Esportazione completa del gestionale (Modello 231, presidio sui backup).
 *
 * Tutte le tabelle scadenze_bandi_* finiscono in un unico file JSON compresso,
 * salvato nel Drive condiviso nella cartella BACKUP GESTIONALE e annotato nel
 * registro scadenze_bandi_backup_registro con impronta SHA-256 e righe per tabella.
 * Restano fuori password, token e sessioni: in caso di ripristino gli utenti
 * reimpostano la password e ricollegano Gmail.
 */

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

export const FORMATO_BACKUP = 'gestionale-evolvi-backup'
export const VERSIONE_BACKUP = 1
export const NOME_DRIVE = 'Gestionale Evolvi'
export const CARTELLA_BACKUP = 'BACKUP GESTIONALE'

/**
 * Tabelle non esportate:
 * - sessioni di accesso e configurazioni con credenziali;
 * - il vecchio client di posta IMAP (copia di una casella Gmail del novembre 2025,
 *   non più usata dal codice): la posta è in Google Workspace e ha il suo backup.
 *   La coda delle email inviate dal gestionale (scadenze_bandi_email_queue) resta inclusa.
 */
const TABELLE_ESCLUSE = new Set([
  'scadenze_bandi_sessioni',
  'scadenze_bandi_system_settings',
  'scadenze_bandi_email_accounts',
  'scadenze_bandi_email_messages',
  'scadenze_bandi_email_attachments',
  'scadenze_bandi_email_folders',
  'scadenze_bandi_email_links',
  'scadenze_bandi_email_sync_logs'
])

/** Colonne con segreti, tolte dall'esportazione. */
const COLONNE_ESCLUSE: Record<string, string[]> = {
  scadenze_bandi_utenti: ['password_hash', 'gmail_refresh_token', 'gmail_access_token'],
  scadenze_bandi_fabbisogno_rilevazioni: ['token']
}

const PAGINA = 1000

type InfoTabella = { tabella: string; colonne: string[]; chiave: string[] }

export type RisultatoEsportazione = {
  nomeFile: string
  contenuto: Buffer
  sha256: string
  conteggi: Record<string, number>
}

async function elencoTabelle(): Promise<InfoTabella[]> {
  const { data, error } = await supabaseAdmin.rpc('gestionale_backup_tabelle')
  if (error) throw new Error(`Elenco tabelle non disponibile: ${error.message}`)
  return (data as InfoTabella[]).filter(t => !TABELLE_ESCLUSE.has(t.tabella))
}

async function leggiTabella(info: InfoTabella): Promise<any[]> {
  const escluse = new Set(COLONNE_ESCLUSE[info.tabella] || [])
  const colonne = info.colonne.filter(c => !escluse.has(c))
  const righe: any[] = []
  for (let da = 0; ; da += PAGINA) {
    let query = supabaseAdmin.from(info.tabella).select(colonne.join(','))
    for (const k of info.chiave) query = query.order(k, { ascending: true })
    const { data, error } = await query.range(da, da + PAGINA - 1)
    if (error) throw new Error(`${info.tabella}: ${error.message}`)
    righe.push(...(data || []))
    if (!data || data.length < PAGINA) break
  }
  return righe
}

/** Legge tutte le tabelle e produce il file compresso con impronta e conteggi. */
export async function esportaGestionale(): Promise<RisultatoEsportazione> {
  const tabelle = await elencoTabelle()
  const dati: Record<string, any[]> = {}
  const conteggi: Record<string, number> = {}

  // Poche tabelle alla volta, per non sovraccaricare il database
  for (let i = 0; i < tabelle.length; i += 6) {
    const gruppo = tabelle.slice(i, i + 6)
    const letti = await Promise.all(gruppo.map(leggiTabella))
    gruppo.forEach((t, j) => {
      dati[t.tabella] = letti[j]
      conteggi[t.tabella] = letti[j].length
    })
  }

  const creatoIl = new Date().toISOString()
  const documento = {
    formato: FORMATO_BACKUP,
    versione: VERSIONE_BACKUP,
    creato_il: creatoIl,
    escluse: {
      tabelle: Array.from(TABELLE_ESCLUSE),
      colonne: COLONNE_ESCLUSE
    },
    conteggi,
    tabelle: dati
  }

  const contenuto = await gzip(Buffer.from(JSON.stringify(documento), 'utf8'), { level: 9 })
  const sha256 = crypto.createHash('sha256').update(contenuto).digest('hex')
  const nomeFile = `gestionale_${creatoIl.slice(0, 10)}_${creatoIl.slice(11, 16).replace(':', '')}.json.gz`
  return { nomeFile, contenuto, sha256, conteggi }
}

async function tokenDrive(): Promise<string> {
  const token = await getValidGoogleToken()
  if (!token) throw new Error('Accesso a Google Drive non disponibile')
  return token
}

async function cartellaBackup(token: string): Promise<string> {
  const driveId = await findOrCreateSharedDrive(token, NOME_DRIVE)
  const esistenti = await listSharedDriveFiles(
    token,
    driveId,
    `name='${CARTELLA_BACKUP}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  )
  if (esistenti.length > 0) return esistenti[0].id!
  const creata = await createDriveFolderInSharedDrive(token, CARTELLA_BACKUP, driveId)
  return creata.id!
}

/**
 * Esegue l'esportazione, la salva su Drive e la annota nel registro.
 * In caso di errore la riga di registro c'è comunque, con esito "errore".
 */
export async function eseguiBackup(origine: 'automatica' | 'manuale', utenteId: string | null) {
  try {
    const esportazione = await esportaGestionale()
    const token = await tokenDrive()
    const cartella = await cartellaBackup(token)
    const file = await uploadFileToFolder(
      token,
      cartella,
      esportazione.nomeFile,
      esportazione.contenuto,
      'application/gzip'
    )

    const { data, error } = await supabaseAdmin
      .from('scadenze_bandi_backup_registro')
      .insert({
        tipo: 'esportazione',
        origine,
        eseguito_da: utenteId,
        esito: 'ok',
        file_nome: esportazione.nomeFile,
        file_drive_id: file.id,
        dimensione_byte: esportazione.contenuto.length,
        sha256: esportazione.sha256,
        conteggi: esportazione.conteggi
      })
      .select('*')
      .single()
    if (error) throw new Error(`File salvato su Drive ma registro non aggiornato: ${error.message}`)
    return { ok: true as const, riga: data }
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : String(e)
    console.error('[backup] esportazione non riuscita:', messaggio)
    await supabaseAdmin.from('scadenze_bandi_backup_registro').insert({
      tipo: 'esportazione',
      origine,
      eseguito_da: utenteId,
      esito: 'errore',
      errore: messaggio.slice(0, 1000)
    })
    return { ok: false as const, errore: messaggio }
  }
}

export type EsitoVerifica = {
  ok: boolean
  impronta_corretta: boolean
  formato_corretto: boolean
  tabelle: number
  righe: number
  differenze: { tabella: string; attese: number; trovate: number }[]
  errore?: string
}

/**
 * Prova di leggibilità di un'esportazione: scarica il file da Drive, controlla
 * l'impronta SHA-256, lo decomprime e confronta le righe di ogni tabella con
 * quelle annotate al momento del salvataggio.
 */
export async function verificaBackup(backupId: string): Promise<EsitoVerifica> {
  const vuoto: EsitoVerifica = {
    ok: false, impronta_corretta: false, formato_corretto: false, tabelle: 0, righe: 0, differenze: []
  }
  const { data: riga } = await supabaseAdmin
    .from('scadenze_bandi_backup_registro')
    .select('id, file_drive_id, sha256, conteggi')
    .eq('id', backupId)
    .eq('tipo', 'esportazione')
    .maybeSingle()
  if (!riga?.file_drive_id) return { ...vuoto, errore: 'Esportazione non trovata o senza file' }

  try {
    const token = await tokenDrive()
    const drive = await createDriveClient(token)
    const risposta = await drive.files.get(
      { fileId: riga.file_drive_id, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    )
    const contenuto = Buffer.from(risposta.data as ArrayBuffer)
    const sha = crypto.createHash('sha256').update(contenuto).digest('hex')
    const documento = JSON.parse((await gunzip(contenuto)).toString('utf8'))

    const attesi: Record<string, number> = riga.conteggi || {}
    const differenze: EsitoVerifica['differenze'] = []
    let righe = 0
    for (const [tabella, n] of Object.entries(attesi)) {
      const trovate = Array.isArray(documento.tabelle?.[tabella]) ? documento.tabelle[tabella].length : 0
      righe += trovate
      if (trovate !== n) differenze.push({ tabella, attese: n, trovate })
    }
    const esito: EsitoVerifica = {
      impronta_corretta: sha === riga.sha256,
      formato_corretto: documento.formato === FORMATO_BACKUP,
      tabelle: Object.keys(documento.tabelle || {}).length,
      righe,
      differenze,
      ok: false
    }
    esito.ok = esito.impronta_corretta && esito.formato_corretto && differenze.length === 0
    return esito
  } catch (e) {
    return { ...vuoto, errore: e instanceof Error ? e.message : String(e) }
  }
}
