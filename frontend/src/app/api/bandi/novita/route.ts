import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { erroreDatabase } from '@/lib/praticaForm'

/**
 * Novità sui bandi da vedere (riquadro del Cruscotto).
 * PATCH { id, stato: 'graduatoria' | 'non_interessa' }.
 */
export async function GET(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (sessione.livello_permessi === 'odv') return NextResponse.json({ novita: [] })
  const { data, error } = await supabaseAdmin.from('scadenze_bandi_controllo_novita')
    .select('id, bando_id, url, testo, tipo, parole, trovata_il, scadenze_bandi_bandi(nome)')
    .eq('stato', 'da_vedere').order('tipo', { ascending: false }).order('trovata_il', { ascending: false }).limit(50)
  if (error) return erroreDatabase(error)
  return NextResponse.json({
    novita: (data || []).map((n: any) => ({ ...n, bando_nome: (Array.isArray(n.scadenze_bandi_bandi) ? n.scadenze_bandi_bandi[0] : n.scadenze_bandi_bandi)?.nome || '' }))
  })
}

export async function PATCH(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (sessione.livello_permessi === 'odv') return NextResponse.json({ error: 'Operazione non consentita' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  if (!b.id || !['graduatoria', 'non_interessa', 'da_vedere'].includes(b.stato)) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 })
  const { error } = await supabaseAdmin.from('scadenze_bandi_controllo_novita').update({
    stato: b.stato,
    decisa_da: b.stato === 'da_vedere' ? null : sessione.userId,
    decisa_il: b.stato === 'da_vedere' ? null : new Date().toISOString()
  }).eq('id', b.id)
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}
