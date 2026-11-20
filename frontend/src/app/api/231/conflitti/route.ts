import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contesto231 } from '@/lib/registri231'
import { erroreDatabase } from '@/lib/praticaForm'

/** Registro dei conflitti (PR.02 §4.4 e §4.5). */
export async function GET(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const [ctx, { data, error }, { data: progetti }] = await Promise.all([
    contesto231(sessione.userId, sessione.livello_permessi),
    supabaseAdmin.from('scadenze_bandi_conflitti').select('*, scadenze_bandi_progetti(titolo_progetto), scadenze_bandi_clienti(denominazione)').order('data', { ascending: false }),
    supabaseAdmin.from('scadenze_bandi_progetti').select('id, titolo_progetto, scadenze_bandi_clienti(denominazione)').order('created_at', { ascending: false })
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...ctx, conflitti: data || [], progetti: ctx.solaLettura ? [] : (progetti || []) })
}

export async function POST(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const b = await request.json().catch(() => ({}))
  const descrizione = String(b.descrizione || '').trim()
  if (!descrizione) return NextResponse.json({ error: 'Descrivi il conflitto' }, { status: 400 })
  if (!['dichiarazione', 'stesso_bando', 'segnalazione', 'altro'].includes(b.origine)) return NextResponse.json({ error: 'Origine non valida' }, { status: 400 })
  const UUID = /^[0-9a-fA-F-]{36}$/
  let clienteId: string | null = null
  if (UUID.test(String(b.progetto_id || ''))) {
    const { data } = await supabaseAdmin.from('scadenze_bandi_progetti').select('cliente_id').eq('id', b.progetto_id).maybeSingle()
    clienteId = data?.cliente_id || null
  }
  const { error } = await supabaseAdmin.from('scadenze_bandi_conflitti').insert({
    data: /^\d{4}-\d{2}-\d{2}$/.test(String(b.data || '')) ? b.data : undefined,
    persona_id: UUID.test(String(b.persona_id || '')) ? b.persona_id : null,
    persona_esterna: String(b.persona_esterna || '').trim() || null,
    origine: b.origine, descrizione,
    progetto_id: UUID.test(String(b.progetto_id || '')) ? b.progetto_id : null, cliente_id: clienteId,
    misure: String(b.misure || '').trim() || null, registrato_da: sessione.userId
  })
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}
