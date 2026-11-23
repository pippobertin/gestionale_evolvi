import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { erroreDatabase } from '@/lib/praticaForm'

/** Decisione dell'AU sulla deroga (un altro amministratore se l'ha chiesta l'AU). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  if (!['approvata', 'respinta'].includes(b.decisione)) return NextResponse.json({ error: 'Decisione non valida' }, { status: 400 })
  const { error } = await supabaseAdmin.from('scadenze_bandi_deroghe')
    .update({ decisione: b.decisione, decisione_nota: String(b.nota || '').trim() || null }).eq('id', id)
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}
