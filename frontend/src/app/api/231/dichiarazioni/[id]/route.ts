import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { erroreDatabase } from '@/lib/praticaForm'

/**
 * Valutazione dell'AU (il database verifica chi valuta). Con "conflitto
 * annotato" il conflitto entra nel registro dei conflitti con le misure.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const { esito, nota, misure } = await request.json().catch(() => ({}))
  if (!['nessun_conflitto', 'conflitto_annotato'].includes(esito)) return NextResponse.json({ error: 'Esito non valido' }, { status: 400 })
  if (esito === 'conflitto_annotato' && !String(misure || '').trim()) return NextResponse.json({ error: 'Indica le misure adottate' }, { status: 400 })

  const { data: dich, error } = await supabaseAdmin.from('scadenze_bandi_dichiarazioni_interessi')
    .update({ esito, nota_valutazione: String(nota || '').trim() || null }).eq('id', id).select('utente_id').single()
  if (error) return erroreDatabase(error)

  if (esito === 'conflitto_annotato') {
    const { error: e2 } = await supabaseAdmin.from('scadenze_bandi_conflitti').insert({
      persona_id: dich.utente_id, origine: 'dichiarazione', dichiarazione_id: id,
      descrizione: String(nota || 'Conflitto emerso dalla dichiarazione degli interessi').trim(),
      misure: String(misure).trim(), registrato_da: sessione.userId
    })
    if (e2) return erroreDatabase(e2)
  }
  return NextResponse.json({ ok: true })
}
