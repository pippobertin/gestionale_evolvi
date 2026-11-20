import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { erroreDatabase } from '@/lib/praticaForm'

/** Decisione scritta dell'AU su una qualifica con anomalia (il database verifica che decida l'AU). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const { decisione, motivazione } = await request.json().catch(() => ({}))
  if (!['procedere', 'procedere_cautele', 'non_procedere'].includes(decisione)) return NextResponse.json({ error: 'Decisione non valida' }, { status: 400 })
  if (!String(motivazione || '').trim()) return NextResponse.json({ error: 'Scrivi la motivazione' }, { status: 400 })
  const { error } = await supabaseAdmin.from('scadenze_bandi_qualifiche')
    .update({ decisione, decisione_motivazione: String(motivazione).trim().slice(0, 2000) }).eq('id', id)
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}
