import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contesto231 } from '@/lib/registri231'
import { erroreDatabase } from '@/lib/praticaForm'

/**
 * Dichiarazioni degli interessi (modulo M.04). Ognuno vede e presenta le
 * proprie; amministratori e OdV le vedono tutte, con chi non l'ha ancora
 * presentata quest'anno.
 */
const SEZIONI = ['enti', 'clienti', 'attivita', 'omaggi']

export async function GET(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const ctx = await contesto231(sessione.userId, sessione.livello_permessi)
  // Chi valuta le dichiarazioni le vede tutte, anche se non è amministratore
  const vedeTutte = ctx.vedeTutto || ctx.puoDecidere
  let query = supabaseAdmin.from('scadenze_bandi_dichiarazioni_interessi').select('*').order('dichiarata_il', { ascending: false })
  if (!vedeTutte) query = query.eq('utente_id', sessione.userId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const anno = new Date().getFullYear()
  const presentate = new Set((data || []).filter(d => d.anno === anno).map(d => d.utente_id))
  // All'OdV le dichiarazioni arrivano in forma riepilogativa (M.04): numero di casi per sezione, senza dettagli
  const riepiloga = (d: any) => ({
    ...d,
    sezioni: Object.fromEntries(SEZIONI.map(s => [s, {
      nessuno: !!d.sezioni?.[s]?.nessuno,
      numero_casi: Array.isArray(d.sezioni?.[s]?.casi) ? d.sezioni[s].casi.length : 0
    }]).concat([['altro', d.sezioni?.altro ? 'presente' : '']])),
    nota_valutazione: d.nota_valutazione ? 'presente' : null
  })
  return NextResponse.json({
    ...ctx, vedeTutte, anno,
    dichiarazioni: ctx.solaLettura ? (data || []).map(riepiloga) : (data || []),
    mancanti: vedeTutte ? ctx.utentiAttivi.filter(u => !presentate.has(u.id)) : []
  })
}

export async function POST(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { tipo, sezioni, impegno } = await request.json().catch(() => ({}))
  if (!['prima', 'rinnovo', 'variazione'].includes(tipo)) return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 })
  if (impegno !== true) return NextResponse.json({ error: 'Accetta gli impegni della dichiarazione' }, { status: 400 })
  if (!sezioni || typeof sezioni !== 'object') return NextResponse.json({ error: 'Dichiarazione vuota' }, { status: 400 })
  for (const s of SEZIONI) {
    const v = sezioni[s]
    if (!v || (v.nessuno !== true && !(Array.isArray(v.casi) && v.casi.length))) {
      return NextResponse.json({ error: 'Per ogni sezione indica "nessuno" oppure almeno un caso' }, { status: 400 })
    }
  }
  const { data, error } = await supabaseAdmin.from('scadenze_bandi_dichiarazioni_interessi').insert({
    utente_id: sessione.userId, anno: new Date().getFullYear(), tipo, sezioni, impegno_accettato: true
  }).select('id').single()
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true, id: data.id })
}
