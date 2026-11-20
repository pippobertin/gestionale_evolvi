import { supabaseAdmin } from './supabaseAdmin'
import { getValidGoogleToken } from './googleAuth'
import { uploadFileToFolder } from './googleDrive'
import { findProjectFolder, sottocartellaProgetto } from './driveProgetto'

/** Dati della pratica che servono per le cartelle Drive e i documenti. */
export async function datiPratica(progettoId: string) {
  const { data, error } = await supabaseAdmin
    .from('scadenze_bandi_progetti')
    .select('id, titolo_progetto, codice_progetto, cliente_id, bando_id, fase, rp_id, rev_id, pratica_propria, trasmissione, motivazione_stesso_bando, data_invio, scadenza_rendicontazione_finale, scadenze_bandi_bandi(nome, ente_erogatore), scadenze_bandi_clienti(denominazione, partita_iva, citta_fatturazione, provincia_fatturazione, indirizzo_fatturazione)')
    .eq('id', progettoId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as any
}

/**
 * Carica un allegato della pratica su Drive, nella sottocartella indicata della
 * cartella del progetto. Restituisce identificativo e collegamento del file.
 */
export async function caricaAllegatoPratica(progettoId: string, file: File, sottocartella: string, prefisso: string) {
  const pratica = await datiPratica(progettoId)
  if (!pratica) throw new Error('Pratica non trovata')
  const token = await getValidGoogleToken()
  if (!token) throw new Error('Accesso a Google Drive non disponibile')
  const cartella = await findProjectFolder(token, pratica.scadenze_bandi_bandi?.nome || '', pratica.titolo_progetto || '')
  if (!cartella.success) throw new Error(cartella.message || 'Cartella del progetto non trovata su Drive')
  const destinazione = await sottocartellaProgetto(token, cartella.sharedDriveId!, cartella.projectFolderId!, sottocartella)
  const data = new Date().toISOString().slice(0, 10)
  const nome = `${prefisso}_${data}_${file.name}`.replace(/[\\/:*?"<>|]/g, '_')
  const caricato = await uploadFileToFolder(
    token, destinazione, nome, Buffer.from(await file.arrayBuffer()), file.type || 'application/octet-stream'
  )
  return { id: caricato.id || null, url: caricato.webViewLink || null, nome }
}
