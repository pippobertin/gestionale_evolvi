import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contesto231 } from '@/lib/registri231'
import { erroreDatabase } from '@/lib/praticaForm'

/**
 * Checklist di ingresso e di uscita del personale (modulo M.06). Le compilano
 * gli amministratori; l'OdV le legge tutte, ciascun collaboratore le proprie.
 */
const UUID = /^[0-9a-fA-F-]{36}$/
const DATA = /^\d{4}-\d{2}-\d{2}$/
const TIPI = ['ingresso_interno', 'ingresso_esterno', 'uscita']

export async function GET(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const ruolo = sessione.livello_permessi
  const admin = ruolo === 'admin'
  let q = supabaseAdmin.from('scadenze_bandi_checklist_personale').select('*').order('created_at', { ascending: false })
  if (!admin && ruolo !== 'odv') q = q.eq('utente_id', sessione.userId)
  const [ctx, { data, error }, { data: voci }] = await Promise.all([
    contesto231(sessione.userId, ruolo),
    q,
    supabaseAdmin.from('scadenze_bandi_checklist_voci').select('tipo, chiave, etichetta, ordine, facoltativa')
      .in('tipo', TIPI.map(t => `personale_${t}`)).eq('attiva', true).order('ordine')
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Per gli amministratori: stato degli accessi e deleghe di chi esce
  let utenti: unknown[] = [], autorizzazioni: unknown[] = [], titolarita: unknown[] = []
  if (admin) {
    const [{ data: u }, { data: a }, { data: tit }] = await Promise.all([
      supabaseAdmin.from('scadenze_bandi_utenti').select('id, nome, cognome, livello_permessi, attivo, accesso_fino_al').neq('livello_permessi', 'odv').order('nome'),
      supabaseAdmin.from('scadenze_bandi_deleghe_persone')
        .select('id, utente_id, delega_id, scadenze_bandi_deleghe(piattaforma, scadenze_bandi_clienti(denominazione))').is('rimossa_il', null),
      supabaseAdmin.from('scadenze_bandi_deleghe')
        .select('id, titolare_id, piattaforma, scadenze_bandi_clienti(denominazione)').not('titolare_id', 'is', null).is('revocata_il', null)
    ])
    utenti = u || []; autorizzazioni = a || []; titolarita = tit || []
  }
  return NextResponse.json({ ...ctx, admin, checklist: data || [], voci: voci || [], utenti, autorizzazioni, titolarita })
}

export async function POST(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (sessione.livello_permessi !== 'admin') return NextResponse.json({ error: 'Le checklist del personale le compilano gli amministratori' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  if (!TIPI.includes(b.tipo)) return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 })
  const utenteId = UUID.test(String(b.utente_id || '')) ? String(b.utente_id) : null
  let persona = String(b.persona || '').trim()
  let periodoAl = DATA.test(String(b.periodo_al || '')) ? String(b.periodo_al) : null
  if (utenteId) {
    const { data: u } = await supabaseAdmin.from('scadenze_bandi_utenti').select('nome, cognome, accesso_fino_al').eq('id', utenteId).maybeSingle()
    if (!u) return NextResponse.json({ error: 'Utente non trovato' }, { status: 400 })
    persona = `${u.nome || ''} ${u.cognome || ''}`.trim()
    if (!periodoAl && u.accesso_fino_al) periodoAl = String(u.accesso_fino_al).slice(0, 10)
  }
  if (!persona) return NextResponse.json({ error: 'Indica la persona' }, { status: 400 })
  if (b.tipo === 'uscita' && !utenteId && !persona) return NextResponse.json({ error: 'Indica chi esce' }, { status: 400 })

  const { data: voci } = await supabaseAdmin.from('scadenze_bandi_checklist_voci')
    .select('chiave, etichetta, facoltativa').eq('tipo', `personale_${b.tipo}`).eq('attiva', true).order('ordine')
  const { data, error } = await supabaseAdmin.from('scadenze_bandi_checklist_personale').insert({
    tipo: b.tipo, utente_id: utenteId, persona, ruolo: String(b.ruolo || '').trim() || null,
    periodo_dal: DATA.test(String(b.periodo_dal || '')) ? b.periodo_dal : null, periodo_al: periodoAl,
    voci: (voci || []).map(v => ({ ...v, stato: 'da_fare', data: null, nota: '' })), creata_da: sessione.userId
  }).select('id').single()
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true, id: data.id })
}
