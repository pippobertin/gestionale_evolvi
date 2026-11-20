import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; contattoId: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id, contattoId } = await params
  const { error } = await supabaseAdmin.from('scadenze_bandi_contatti_pa').delete().eq('id', contattoId).eq('progetto_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 400 })
  return NextResponse.json({ ok: true })
}
