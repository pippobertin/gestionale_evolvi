import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { datiPratica } from '@/lib/allegatiPratica'

/**
 * Pratica di finanza agevolata guidata (Modello 231, PR.01).
 * GET: stato dei requisiti, cronologia, ordini di lavoro, contatti con la PA,
 * verifiche (checklist del REV, conferma del cliente, delega, ricevuta).
 * PATCH: responsabile di pratica, revisore, pratica di BLM in proprio, chi
 * trasmette, motivazione per le pratiche concorrenti sullo stesso bando.
 */

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params

  const pratica = await datiPratica(id)
  if (!pratica) return NextResponse.json({ error: 'Pratica non trovata' }, { status: 404 })

  const [stato, passaggi, ordini, contatti, verifiche, utenti, voci, au, tracking, integrazioni, rendiconti, rettifiche] = await Promise.all([
    supabaseAdmin.rpc('gestionale_stato_pratica', { p_progetto: id }),
    supabaseAdmin.from('scadenze_bandi_pratica_passaggi').select('*').eq('progetto_id', id).order('quando', { ascending: false }),
    supabaseAdmin.from('scadenze_bandi_ordini_lavoro').select('*').eq('progetto_id', id).order('created_at', { ascending: false }),
    supabaseAdmin.from('scadenze_bandi_contatti_pa').select('*').eq('progetto_id', id).order('data', { ascending: false }),
    supabaseAdmin.from('scadenze_bandi_pratica_verifiche').select('*').eq('progetto_id', id).order('created_at', { ascending: false }),
    supabaseAdmin.from('scadenze_bandi_utenti').select('id, nome, cognome, email, livello_permessi').eq('attivo', true).order('nome'),
    supabaseAdmin.from('scadenze_bandi_checklist_voci').select('tipo, chiave, etichetta, ordine').eq('attiva', true).order('ordine'),
    supabaseAdmin.from('scadenze_bandi_system_settings').select('value').eq('key', 'utente_au').maybeSingle(),
    supabaseAdmin.from('scadenze_bandi_contract_tracking').select('id, overall_status, signed_contract_received')
      .eq('entity_type', 'PROGETTO').eq('entity_id', id).order('created_at', { ascending: false }).limit(1),
    supabaseAdmin.from('scadenze_bandi_integrazioni').select('*').eq('progetto_id', id).order('scadenza', { ascending: true }),
    supabaseAdmin.from('scadenze_bandi_rendiconti').select('*').eq('progetto_id', id).order('scadenza', { ascending: true }),
    supabaseAdmin.from('scadenze_bandi_rettifiche').select('*').eq('progetto_id', id).order('data_rilevazione', { ascending: false })
  ])
  if (stato.error) return NextResponse.json({ error: stato.error.message }, { status: 500 })

  // Contratto Evolvi attivo del cliente: l'incarico può passare dall'ordine di lavoro
  const { data: accordi } = await supabaseAdmin
    .from('scadenze_bandi_contratti_evolvi')
    .select('id, numero_contratto, data_contratto, stato, data_fine')
    .eq('cliente_id', pratica.cliente_id)
    .in('stato', ['approvato', 'inviato', 'firmato', 'attivo'])
    .order('data_contratto', { ascending: false })

  const nomi: Record<string, string> = {}
  for (const u of utenti.data || []) nomi[u.id] = `${u.nome || ''} ${u.cognome || ''}`.trim()

  return NextResponse.json({
    pratica: {
      id: pratica.id, titolo: pratica.titolo_progetto, codice: pratica.codice_progetto, fase: pratica.fase,
      rp_id: pratica.rp_id, rev_id: pratica.rev_id, pratica_propria: pratica.pratica_propria,
      trasmissione: pratica.trasmissione, motivazione_stesso_bando: pratica.motivazione_stesso_bando,
      data_invio: pratica.data_invio, scadenza_rendicontazione: pratica.scadenza_rendicontazione_finale || null, bando: pratica.scadenze_bandi_bandi?.nome || '',
      cliente: pratica.scadenze_bandi_clienti?.denominazione || ''
    },
    stato: stato.data,
    passaggi: passaggi.data || [],
    ordini: ordini.data || [],
    contatti: contatti.data || [],
    verifiche: verifiche.data || [],
    voci: (voci.data || []).filter(v => v.tipo === 'checklist_preinvio'),
    vociRendicontazione: (voci.data || []).filter(v => v.tipo === 'checklist_rendicontazione'),
    integrazioni: integrazioni.data || [],
    rendiconti: rendiconti.data || [],
    rettifiche: rettifiche.data || [],
    email: Object.fromEntries((utenti.data || []).map(u => [u.id, u.email])),
    accordi: accordi || [],
    contratto: tracking.data?.[0] || null,
    utenti: (utenti.data || []).filter(u => u.livello_permessi !== 'odv').map(u => ({ id: u.id, nome: nomi[u.id] })),
    nomi,
    au_id: au.data?.value || null,
    io: sessione.userId
  })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const UUID = /^[0-9a-fA-F-]{36}$/
  const aggiornamento: Record<string, unknown> = {}
  for (const campo of ['rp_id', 'rev_id'] as const) {
    if (body[campo] !== undefined) {
      if (body[campo] !== null && !UUID.test(String(body[campo]))) {
        return NextResponse.json({ error: 'Utente non valido' }, { status: 400 })
      }
      aggiornamento[campo] = body[campo] || null
    }
  }
  if (typeof body.pratica_propria === 'boolean') aggiornamento.pratica_propria = body.pratica_propria
  if (body.trasmissione !== undefined) {
    if (body.trasmissione !== null && !['blm', 'cliente'].includes(body.trasmissione)) {
      return NextResponse.json({ error: 'Valore non valido' }, { status: 400 })
    }
    aggiornamento.trasmissione = body.trasmissione
  }
  if (body.motivazione_stesso_bando !== undefined) {
    aggiornamento.motivazione_stesso_bando = String(body.motivazione_stesso_bando || '').slice(0, 2000) || null
  }
  if (!Object.keys(aggiornamento).length) return NextResponse.json({ error: 'Niente da aggiornare' }, { status: 400 })

  const { error } = await supabaseAdmin.from('scadenze_bandi_progetti').update(aggiornamento).eq('id', id)
  if (error) {
    const messaggio = /progetti_rp_rev_diversi/.test(error.message)
      ? 'Il revisore deve essere una persona diversa dal responsabile di pratica'
      : error.message
    return NextResponse.json({ error: messaggio }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
