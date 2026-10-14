/**
 * Agente RNA per il Mac (lanciato da launchd ogni 5 minuti, vedi rna-mac-install.sh).
 *
 * rna.gov.it non risponde ai server cloud, quindi il gestionale non può
 * importare da solo: scrive una richiesta in scadenze_bandi_rna_richieste e
 * questo agente la esegue. A ogni giro:
 *   1. segnala che il Mac è attivo (scadenze_bandi_rna_agente)
 *   2. rimette in coda le richieste rimaste "in corso" (Mac spento a metà)
 *   3. esegue la richiesta in attesa più vecchia, se c'è
 *   4. altrimenti, se serve, crea ed esegue la richiesta automatica:
 *        - storico completo dal 2020 se l'ultimo è più vecchio di 30 giorni
 *        - ultimi 4 mesi se l'ultimo aggiornamento è più vecchio di 7 giorni
 *      (così un Mac rimasto spento o in stop recupera appena si riaccende)
 *
 * Uso manuale (dalla cartella dell'agente o da frontend):
 *   node --experimental-strip-types scripts/rna-agent.mts
 */
import { readFileSync, existsSync } from 'node:fs'
import { hostname } from 'node:os'
import { createClient } from '@supabase/supabase-js'
import { importaMeseRna, indiceClienti, elencoMesi, ultimiMesi } from '../src/lib/rna/importer.ts'

const R = 'scadenze_bandi_rna_richieste'
const AGENTE = 'scadenze_bandi_rna_agente'
const GIORNO = 86400000

if (existsSync('.env.local')) {
  for (const riga of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = riga.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) { console.error('Mancano le variabili Supabase'); process.exit(1) }
const sb = createClient(url, key, { auth: { persistSession: false } })
const macchina = hostname().replace(/\.local$/, '') || 'mac'
const ora = () => new Date().toISOString()

async function battito(stato: string) {
  await sb.from(AGENTE).upsert({ id: macchina, ultimo_contatto_at: ora(), stato }, { onConflict: 'id' })
}

async function ultimaOk(filtro: (q: any) => any): Promise<Date | null> {
  const { data } = await filtro(sb.from(R).select('completata_at').eq('stato', 'OK'))
    .order('completata_at', { ascending: false }).limit(1)
  return data && data[0]?.completata_at ? new Date(data[0].completata_at) : null
}

async function prossimaRichiesta(): Promise<any | null> {
  const { data: attesa } = await sb.from(R).select('*').eq('stato', 'IN_ATTESA')
    .order('created_at', { ascending: true }).limit(1)
  if (attesa && attesa[0]) return attesa[0]

  const adesso = Date.now()
  const meseCorrente = ultimiMesi(1)[0]
  const ultimoCompleto = await ultimaOk(q => q.eq('mese_da', '2020_01'))
  const ultimoQualsiasi = await ultimaOk(q => q)

  // Se un aggiornamento automatico è fallito nelle ultime 6 ore (es. RNA non
  // raggiungibile) non se ne crea un altro: si evita di riprovare ogni 5 minuti.
  const { data: fallite } = await sb.from(R).select('id').eq('origine', 'AUTOMATICA').eq('stato', 'ERRORE')
    .gte('created_at', new Date(adesso - 6 * 3600000).toISOString()).limit(1)
  if (fallite && fallite.length) return null

  let da: string | null = null
  if (!ultimoCompleto || adesso - ultimoCompleto.getTime() > 30 * GIORNO) da = '2020_01'
  else if (!ultimoQualsiasi || adesso - ultimoQualsiasi.getTime() > 7 * GIORNO) da = ultimiMesi(4)[3]
  if (!da) return null

  const { data: nuova, error } = await sb.from(R)
    .insert({ mese_da: da, mese_a: meseCorrente, origine: 'AUTOMATICA', stato: 'IN_ATTESA' })
    .select('*').single()
  if (error) throw new Error(`Creazione richiesta automatica: ${error.message}`)
  return nuova
}

async function esegui(req: any) {
  const mesi = elencoMesi(req.mese_da, req.mese_a)
  await sb.from(R).update({
    stato: 'IN_CORSO', avviata_at: ora(), mesi_totali: mesi.length, mesi_completati: 0, errore: null,
  }).eq('id', req.id)
  console.log(`${ora()} richiesta ${req.origine} ${req.mese_da} → ${req.mese_a} (${mesi.length} mesi)`)

  const tot = { clienti: 0, nuovi: 0, aggiornati: 0, collegati: 0, errori: 0 }
  const errori: string[] = []
  const indice = await indiceClienti(sb)
  for (let i = 0; i < mesi.length; i++) {
    const mese = mesi[i]
    await battito(`in corso ${mese}`)
    await sb.from(R).update({ mese_corrente: mese }).eq('id', req.id)
    const e = await importaMeseRna({ client: sb, mese, origine: req.origine === 'AUTOMATICA' ? 'CRON' : 'MANUALE', indice })
    tot.clienti += e.aiuti_clienti; tot.nuovi += e.nuovi; tot.aggiornati += e.aggiornati; tot.collegati += e.collegati_auto
    if (e.esito !== 'OK') { tot.errori++; errori.push(`${mese}: ${e.errore}`) }
    console.log(`  ${mese} ${e.esito} clienti ${e.aiuti_clienti} nuovi ${e.nuovi} collegati ${e.collegati_auto}${e.errore ? ' ' + e.errore : ''}`)
    await sb.from(R).update({
      mesi_completati: i + 1, aiuti_clienti: tot.clienti, nuovi: tot.nuovi,
      aggiornati: tot.aggiornati, collegati_auto: tot.collegati, mesi_in_errore: tot.errori,
    }).eq('id', req.id)
  }

  await sb.from(R).update({
    stato: tot.errori === mesi.length ? 'ERRORE' : 'OK',
    errore: errori.length ? errori.slice(0, 5).join(' | ') : null,
    mese_corrente: null,
    completata_at: ora(),
  }).eq('id', req.id)
}

try {
  await battito('in ascolto')
  // Una richiesta "in corso" all'avvio è rimasta a metà (Mac spento o in stop): si riparte.
  // launchd non avvia due agenti insieme, quindi non c'è un'altra esecuzione attiva.
  await sb.from(R).update({ stato: 'IN_ATTESA', avviata_at: null }).eq('stato', 'IN_CORSO')

  const req = await prossimaRichiesta()
  if (req) await esegui(req)
  await battito('in ascolto')
} catch (err) {
  console.error(ora(), 'Errore agente RNA:', err instanceof Error ? err.message : err)
  process.exitCode = 1
}
