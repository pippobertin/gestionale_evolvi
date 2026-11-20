import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { erroreDatabase } from '@/lib/praticaForm'

/** Decisione dell'AU sul conflitto e misure adottate (il database verifica chi decide). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const { decisione, misure } = await request.json().catch(() => ({}))
  if (!String(decisione || '').trim()) return NextResponse.json({ error: 'Scrivi la decisione' }, { status: 400 })
  const { error } = await supabaseAdmin.from('scadenze_bandi_conflitti').update({
    decisione: String(decisione).trim().slice(0, 2000),
    ...(String(misure || '').trim() ? { misure: String(misure).trim().slice(0, 2000) } : {})
  }).eq('id', id)
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}
