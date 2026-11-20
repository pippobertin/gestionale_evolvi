import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { uploadFileToFolder } from '@/lib/googleDrive'
import { findWordTemplate, processWordTemplate } from '@/lib/wordTemplate'
import { findProjectFolder, sottocartellaProgetto } from '@/lib/driveProgetto'
import { datiPratica } from '@/lib/allegatiPratica'

/**
 * Ordine di lavoro (clienti con accordo quadro, PR.01 §4.1.3): genera il
 * documento dal MODELLO ORDINE DI LAVORO della cartella MODELLI e lo salva nella
 * cartella CONTRATTI del progetto. Vale come incarico solo dopo la conferma del
 * cliente (firma o email), registrata a parte.
 */

export const maxDuration = 60

function dataIt(d: string | null | undefined) {
  if (!d) return ''
  const [a, m, g] = d.slice(0, 10).split('-')
  return `${g}/${m}/${a}`
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const rendicontazione = String(body.rendicontazione || '').trim()
  if (!rendicontazione) {
    return NextResponse.json({ error: 'Indica se la rendicontazione è inclusa o esclusa' }, { status: 400 })
  }

  const pratica = await datiPratica(id)
  if (!pratica) return NextResponse.json({ error: 'Pratica non trovata' }, { status: 404 })

  let accordo: any = null
  if (body.contratto_evolvi_id) {
    const { data } = await supabaseAdmin.from('scadenze_bandi_contratti_evolvi')
      .select('id, numero_contratto, data_contratto').eq('id', body.contratto_evolvi_id).maybeSingle()
    accordo = data
  }

  // Numero progressivo dell'anno: OL-AAAA-NNN
  const anno = new Date().getFullYear()
  const { count } = await supabaseAdmin.from('scadenze_bandi_ordini_lavoro')
    .select('id', { count: 'exact', head: true }).like('numero', `OL-${anno}-%`)
  const numero = `OL-${anno}-${String((count || 0) + 1).padStart(3, '0')}`

  const token = await getValidGoogleToken()
  if (!token) return NextResponse.json({ error: 'Accesso a Google Drive non disponibile' }, { status: 503 })
  const modello = await findWordTemplate(token, 'MODELLO ORDINE DI LAVORO')
  if (!modello.success || !modello.fileId) {
    return NextResponse.json({ error: 'Modello dell\'ordine di lavoro non trovato nella cartella MODELLI' }, { status: 404 })
  }

  const cliente = pratica.scadenze_bandi_clienti || {}
  const compilato = await processWordTemplate(token, modello.fileId, {
    NumeroOrdine: numero,
    NumeroAccordo: accordo?.numero_contratto || '____',
    DataAccordo: dataIt(accordo?.data_contratto) || '____',
    Denominazione: cliente.denominazione || '',
    PartitaIVA: cliente.partita_iva || '',
    Citta: cliente.citta_fatturazione || '',
    Provincia: cliente.provincia_fatturazione || '',
    Indirizzo: cliente.indirizzo_fatturazione || '',
    NomeBando: pratica.scadenze_bandi_bandi?.nome || '',
    EnteErogatore: pratica.scadenze_bandi_bandi?.ente_erogatore || '',
    TitoloProgetto: pratica.titolo_progetto || '',
    CodiceProgetto: pratica.codice_progetto || '',
    Attivita: String(body.attivita || '').trim() || 'nessuna',
    Rendicontazione: rendicontazione,
    SuccessFee: String(body.success_fee || '').trim() || 'nessuna condizione diversa dall\'Accordo Quadro',
    DataOrdine: dataIt(new Date().toISOString())
  }, modello.mimeType)
  if (!compilato.success || !compilato.processedDoc) {
    return NextResponse.json({ error: compilato.error || 'Compilazione del modello non riuscita' }, { status: 500 })
  }

  const cartella = await findProjectFolder(token, pratica.scadenze_bandi_bandi?.nome || '', pratica.titolo_progetto || '')
  if (!cartella.success) return NextResponse.json({ error: cartella.message }, { status: 404 })
  const contratti = await sottocartellaProgetto(token, cartella.sharedDriveId!, cartella.projectFolderId!, 'CONTRATTI')
  const nomeFile = `Ordine_di_lavoro_${numero}_${(cliente.denominazione || '').replace(/[^a-zA-Z0-9]/g, '_')}.docx`
  const file = await uploadFileToFolder(
    token, contratti, nomeFile, Buffer.from(compilato.processedDoc),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )

  const { data: ordine, error } = await supabaseAdmin.from('scadenze_bandi_ordini_lavoro').insert({
    progetto_id: id,
    cliente_id: pratica.cliente_id,
    contratto_evolvi_id: accordo?.id || null,
    numero,
    attivita: body.attivita || null,
    rendicontazione,
    success_fee: body.success_fee || null,
    file_drive_id: file.id,
    file_url: file.webViewLink,
    generato_da: sessione.userId
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true, ordine })
}
