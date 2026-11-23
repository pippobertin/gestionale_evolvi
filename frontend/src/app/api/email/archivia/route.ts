import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getGmailClient } from '@/lib/gmail'
import { leggiMessaggio, nomeFileEmail, pdfEmail } from '@/lib/emailCorrelate'
import { caricaAllegatoPratica, datiPratica } from '@/lib/allegatiPratica'
import { caricaDocumentoCliente, contestoDrive } from '@/lib/driveCliente'

/**
 * Archiviazione di un'email: PDF (ed eventuali allegati) su Drive, nella
 * cartella della pratica o tra i documenti del cliente; se richiesto diventa un
 * contatto con la PA o la conferma scritta del cliente della pratica. In Gmail
 * il messaggio riceve l'etichetta "Archiviata nel gestionale".
 */
export const maxDuration = 60
const UUID = /^[0-9a-fA-F-]{36}$/
const TIPI_CONTATTO = ['richiesta_formale', 'comunicazione_esito', 'controllo', 'incontro', 'altro']
const ETICHETTA = 'Archiviata nel gestionale'
const SOTTOCARTELLA: Record<string, string> = { documento: 'EMAIL', contatto_pa: 'CONTATTI CON GLI ENTI', conferma_cliente: 'INVIO DOMANDA' }

export async function POST(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (sessione.livello_permessi === 'odv') return NextResponse.json({ error: 'Operazione non consentita' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  const messageId = String(b.message_id || '')
  if (!/^[0-9a-zA-Z]+$/.test(messageId)) return NextResponse.json({ error: 'Messaggio non valido' }, { status: 400 })
  const registra = ['documento', 'contatto_pa', 'conferma_cliente'].includes(b.registra) ? b.registra as string : 'documento'
  const progettoId = UUID.test(String(b.progetto_id || '')) ? String(b.progetto_id) : null
  let clienteId = UUID.test(String(b.cliente_id || '')) ? String(b.cliente_id) : null
  if (registra !== 'documento' && !progettoId) return NextResponse.json({ error: 'Contatti con la PA e conferme del cliente si registrano dalla pratica' }, { status: 400 })
  const contatto = b.contatto || {}
  if (registra === 'contatto_pa' && (!String(contatto.ente || '').trim() || !TIPI_CONTATTO.includes(contatto.tipo))) {
    return NextResponse.json({ error: 'Per il contatto con la PA indica ente e tipo' }, { status: 400 })
  }
  if (progettoId) {
    const pratica = await datiPratica(progettoId)
    if (!pratica) return NextResponse.json({ error: 'Pratica non trovata' }, { status: 404 })
    clienteId = pratica.cliente_id
  }
  if (!clienteId) return NextResponse.json({ error: 'Cliente non indicato' }, { status: 400 })

  // 1. Messaggio dalla casella di chi archivia
  const [{ data: utente }, gmail] = await Promise.all([
    supabaseAdmin.from('scadenze_bandi_utenti').select('gmail_email').eq('id', sessione.userId).maybeSingle(),
    getGmailClient(sessione.userId)
  ])
  let m
  try {
    const { data } = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' })
    m = leggiMessaggio(data)
  } catch (e) {
    return NextResponse.json({ error: `Messaggio non disponibile in Gmail: ${e instanceof Error ? e.message : 'errore'}` }, { status: 400 })
  }
  const casella = utente?.gmail_email || ''
  const nome = nomeFileEmail(m)

  // 2. PDF e allegati su Drive
  const allegatiSalvati: { nome: string; id: string | null; url: string | null }[] = []
  let pdf: { id: string | null; url: string | null }
  try {
    const buffer = await pdfEmail(m, casella)
    const allegati = b.allegati ? await Promise.all(m.allegati.slice(0, 10).map(async a => {
      const { data } = await gmail.users.messages.attachments.get({ userId: 'me', messageId, id: a.attachmentId })
      return { ...a, contenuto: Buffer.from(String(data.data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64') }
    })) : []
    if (progettoId) {
      const sotto = SOTTOCARTELLA[registra]
      pdf = await caricaAllegatoPratica(progettoId, new File([new Uint8Array(buffer)], nome.replace(/^Email_/, ''), { type: 'application/pdf' }), sotto, 'Email')
      for (const a of allegati) {
        const f = await caricaAllegatoPratica(progettoId, new File([new Uint8Array(a.contenuto)], a.filename, { type: a.mimeType || 'application/octet-stream' }), sotto, 'Allegato_email')
        allegatiSalvati.push({ nome: a.filename, id: f.id, url: f.url })
      }
    } else {
      const c = await contestoDrive()
      const doc = await caricaDocumentoCliente(c, clienteId, 'EMAIL', nome, buffer, 'application/pdf')
      pdf = doc
      const descrizione = `Email ${m.mittente ? `da ${m.mittente}` : ''}${m.destinatari ? ` a ${m.destinatari}` : ''}`.slice(0, 500)
      await supabaseAdmin.from('scadenze_bandi_documenti_amministrativi').insert({
        cliente_id: clienteId, tipo_documento: 'EMAIL', categoria: 'EMAIL', nome_file: nome, nome_originale: nome,
        dimensione_bytes: buffer.length, mime_type: 'application/pdf', storage_path: null,
        google_drive_id: doc.id, google_drive_url: doc.url, descrizione, data_documento: m.data?.slice(0, 10) || null,
        verificato: false, tags: [], uploaded_by: sessione.userId
      })
      for (const a of allegati) {
        const f = await caricaDocumentoCliente(c, clienteId, 'EMAIL', a.filename, a.contenuto, a.mimeType)
        allegatiSalvati.push({ nome: a.filename, id: f.id, url: f.url })
        await supabaseAdmin.from('scadenze_bandi_documenti_amministrativi').insert({
          cliente_id: clienteId, tipo_documento: 'EMAIL', categoria: 'EMAIL', nome_file: a.filename, nome_originale: a.filename,
          dimensione_bytes: a.contenuto.length, mime_type: a.mimeType, storage_path: null,
          google_drive_id: f.id, google_drive_url: f.url, descrizione: `Allegato dell'email «${m.oggetto || ''}»`.slice(0, 500),
          data_documento: m.data?.slice(0, 10) || null, verificato: false, tags: [], uploaded_by: sessione.userId
        })
      }
    }
  } catch (e) {
    return NextResponse.json({ error: `Salvataggio su Drive non riuscito: ${e instanceof Error ? e.message : 'errore'}` }, { status: 500 })
  }

  // 3. Registrazione come contatto con la PA o conferma del cliente
  const giorno = (m.data || new Date().toISOString()).slice(0, 10)
  if (registra === 'contatto_pa') {
    const { error } = await supabaseAdmin.from('scadenze_bandi_contatti_pa').insert({
      progetto_id: progettoId, cliente_id: clienteId, data: giorno, ente: String(contatto.ente).trim(), tipo: contatto.tipo,
      oggetto: String(contatto.oggetto || m.oggetto || 'Email').trim().slice(0, 500), persona: m.mittente.slice(0, 200) || null,
      esito: String(contatto.esito || '').trim() || null, allegato_drive_id: pdf.id, allegato_url: pdf.url, registrato_da: sessione.userId
    })
    if (error) return NextResponse.json({ error: `PDF salvato su Drive, ma contatto non registrato: ${error.message}` }, { status: 400 })
  } else if (registra === 'conferma_cliente') {
    const { error } = await supabaseAdmin.from('scadenze_bandi_pratica_verifiche').insert({
      progetto_id: progettoId, tipo: 'conferma_cliente', data: giorno, vale_anche_come_delega: !!b.vale_anche_come_delega,
      note: `Email «${m.oggetto || ''}» del ${giorno} da ${m.mittente}`.slice(0, 2000),
      file_drive_id: pdf.id, file_url: pdf.url, eseguito_da: sessione.userId
    })
    if (error) return NextResponse.json({ error: `PDF salvato su Drive, ma conferma non registrata: ${error.message}` }, { status: error.code === '42501' ? 403 : 400 })
  }

  // 4. Traccia nel gestionale ed etichetta in Gmail
  await supabaseAdmin.from('scadenze_bandi_email_archiviate').insert({
    gmail_message_id: m.id, gmail_thread_id: m.threadId, casella, oggetto: m.oggetto.slice(0, 500), mittente: m.mittente.slice(0, 500),
    destinatari: m.destinatari.slice(0, 1000), data_email: m.data, cliente_id: clienteId, progetto_id: progettoId,
    registrata_come: registra, google_drive_id: pdf.id, google_drive_url: pdf.url, allegati: allegatiSalvati, archiviata_da: sessione.userId
  })
  try {
    const { data: etichette } = await gmail.users.labels.list({ userId: 'me' })
    let id = (etichette.labels || []).find(l => l.name === ETICHETTA)?.id
    if (!id) id = (await gmail.users.labels.create({ userId: 'me', requestBody: { name: ETICHETTA, labelListVisibility: 'labelShow', messageListVisibility: 'show' } })).data.id || undefined
    if (id) await gmail.users.messages.modify({ userId: 'me', id: m.id, requestBody: { addLabelIds: [id] } })
  } catch (e) {
    console.warn('Etichetta Gmail non applicata:', e)
  }
  return NextResponse.json({ ok: true, url: pdf.url, allegati: allegatiSalvati.length })
}
