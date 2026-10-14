import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import { calcolaRiepilogo, type RigaRiepilogo } from '@/lib/contributi/riepilogo'

/**
 * GET — Riepilogo aggregato dei contributi di un cliente.
 * Calcolato in memoria: le righe per cliente sono poche (ordine delle centinaia).
 * importo_contributo/esl null contano come 0 nelle somme; count conta sempre la riga.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const { id: clienteId } = await params

    const { data, error } = await supabase
      .from('scadenze_bandi_contributi_ottenuti')
      .select('anno_competenza, forma_contributo, stato, importo_contributo, esl')
      .eq('cliente_id', clienteId)

    if (error) throw error

    return Response.json({
      success: true,
      data: calcolaRiepilogo((data || []) as RigaRiepilogo[]),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel calcolo riepilogo contributi'
    console.error('[API contributi] GET riepilogo Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
