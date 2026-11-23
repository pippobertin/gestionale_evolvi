import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getGmailClient, metadatiMessaggi } from '@/lib/gmail'
import { indirizziCliente, queryGmail } from '@/lib/emailCorrelate'

/**
 * Email con un cliente, cercate nel Gmail di chi è collegato, e email già
 * archiviate nel gestionale per quel cliente o quella pratica.
 */
const UUID = /^[0-9a-fA-F-]{36}$/

export async function GET(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const p = request.nextUrl.searchParams
  const progettoId = UUID.test(p.get('progetto_id') || '') ? p.get('progetto_id')! : null
  let clienteId = UUID.test(p.get('cliente_id') || '') ? p.get('cliente_id')! : null
  let ente = ''
  if (progettoId) {
    const { data: pr } = await supabaseAdmin.from('scadenze_bandi_progetti').select('cliente_id, scadenze_bandi_bandi(ente_erogatore)').eq('id', progettoId).maybeSingle()
    clienteId = pr?.cliente_id || clienteId
    const bando = Array.isArray(pr?.scadenze_bandi_bandi) ? pr?.scadenze_bandi_bandi[0] : pr?.scadenze_bandi_bandi
    ente = (bando as { ente_erogatore?: string } | null)?.ente_erogatore || ''
  }
  if (!clienteId) return NextResponse.json({ error: 'Cliente non indicato' }, { status: 400 })

  let q = supabaseAdmin.from('scadenze_bandi_email_archiviate').select('*').order('data_email', { ascending: false })
  q = progettoId ? q.eq('progetto_id', progettoId) : q.eq('cliente_id', clienteId)
  const [cliente, { data: archiviate }, { data: utente }] = await Promise.all([
    indirizziCliente(clienteId),
    q,
    supabaseAdmin.from('scadenze_bandi_utenti').select('gmail_email, gmail_refresh_token').eq('id', sessione.userId).maybeSingle()
  ])
  const base = { ...cliente, ente, archiviate: archiviate || [], casella: utente?.gmail_email || null }
  if (!utente?.gmail_refresh_token) {
    return NextResponse.json({ ...base, messages: [], avviso: 'Per vedere le email collega la tua casella Gmail in Impostazioni, Il mio Gmail.' })
  }
  const query = queryGmail(cliente.indirizzi, cliente.domini, p.get('q') || '')
  if (!query) {
    return NextResponse.json({ ...base, messages: [], avviso: 'Nella scheda del cliente non ci sono indirizzi email (email, PEC, legale rappresentante o referenti): aggiungili per trovare le email.' })
  }
  try {
    const gmail = await getGmailClient(sessione.userId)
    const elenco = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 25, pageToken: p.get('pageToken') || undefined })
    const ids = (elenco.data.messages || []).map(m => m.id!).filter(Boolean)
    const messages = (await metadatiMessaggi(gmail, ids, ['From', 'To', 'Cc', 'Subject', 'Date']))
      .sort((a, b) => Number(b.internalDate) - Number(a.internalDate))
    return NextResponse.json({ ...base, messages, nextPageToken: elenco.data.nextPageToken || null })
  } catch (e) {
    return NextResponse.json({ ...base, messages: [], avviso: `Gmail non ha risposto: ${e instanceof Error ? e.message : 'errore'}. Se il problema continua, ricollega la casella in Impostazioni.` })
  }
}
