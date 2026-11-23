import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contesto231 } from '@/lib/registri231'
import { erroreDatabase } from '@/lib/praticaForm'
import { oggiItalia } from '@/lib/accessoUtente'
import { creaReport, semestreConcluso } from '@/lib/reportOdv'

/** Report semestrale all'OdV (M.05): elenco, preparazione, promemoria in calendario. */
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const ctx = await contesto231(sessione.userId, sessione.livello_permessi)
  let q = supabaseAdmin.from('scadenze_bandi_report_odv').select('*').order('anno', { ascending: false }).order('semestre', { ascending: false })
  if (ctx.solaLettura) q = q.not('inviato_il', 'is', null)
  const [{ data, error }, { data: promemoria }, { data: admin }] = await Promise.all([
    q,
    supabaseAdmin.from('scadenze_bandi_system_settings').select('value').eq('key', 'promemoria_report_odv').maybeSingle(),
    supabaseAdmin.from('scadenze_bandi_utenti').select('email').eq('livello_permessi', 'admin').eq('attivo', true)
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Semestri che si possono preparare: l'ultimo concluso e quello in corso
  const ultimo = semestreConcluso(oggiItalia())
  const inCorso = ultimo.semestre === 1 ? { anno: ultimo.anno, semestre: 2 as const } : { anno: ultimo.anno + 1, semestre: 1 as const }
  const esistenti = new Set((data || []).map(r => `${r.anno}-${r.semestre}`))
  const disponibili = [ultimo, inCorso].filter(s => !esistenti.has(`${s.anno}-${s.semestre}`))
  return NextResponse.json({
    ...ctx, admin: sessione.livello_permessi === 'admin', report: data || [], disponibili,
    promemoriaAttivi: !!promemoria?.value, emailAdmin: ctx.solaLettura ? [] : (admin || []).map(a => a.email).filter(Boolean)
  })
}

export async function POST(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (sessione.livello_permessi !== 'admin') return NextResponse.json({ error: 'Il report lo preparano gli amministratori' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  if (b.azione === 'promemoria') {
    const valore = new Date().toISOString()
    const { data: c } = await supabaseAdmin.from('scadenze_bandi_system_settings').select('key').eq('key', 'promemoria_report_odv').maybeSingle()
    const { error } = c
      ? await supabaseAdmin.from('scadenze_bandi_system_settings').update({ value: valore, updated_at: valore }).eq('key', 'promemoria_report_odv')
      : await supabaseAdmin.from('scadenze_bandi_system_settings').insert({ key: 'promemoria_report_odv', value: valore })
    if (error) return erroreDatabase(error)
    return NextResponse.json({ ok: true })
  }
  const anno = Number(b.anno), semestre = Number(b.semestre)
  if (!Number.isInteger(anno) || anno < 2026 || anno > 2100 || ![1, 2].includes(semestre)) return NextResponse.json({ error: 'Semestre non valido' }, { status: 400 })
  const { data, error } = await creaReport(anno, semestre as 1 | 2, sessione.userId)
  if (error) return error.code === '23505' ? NextResponse.json({ error: 'Il report di questo semestre esiste già' }, { status: 400 }) : erroreDatabase(error)
  return NextResponse.json({ ok: true, id: data.id })
}
