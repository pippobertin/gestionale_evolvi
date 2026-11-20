import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/** Cambio di fase della pratica: i requisiti li verifica il database (gestionale_cambia_fase). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const { fase, deroga } = await request.json().catch(() => ({}))

  const { data, error } = await supabaseAdmin.rpc('gestionale_cambia_fase', {
    p_progetto: id, p_fase: fase, p_deroga: typeof deroga === 'string' ? deroga : null
  })
  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.hint === 'REQUISITI_MANCANTI' ? 'REQUISITI_MANCANTI' : undefined },
      { status: error.code === '42501' ? 403 : 400 }
    )
  }
  return NextResponse.json(data)
}
