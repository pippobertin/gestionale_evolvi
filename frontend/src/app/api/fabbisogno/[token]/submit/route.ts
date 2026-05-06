import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * POST — Invio finale del questionario.
 * Endpoint pubblico, identificato dal token.
 *
 * Idempotente: se la rilevazione e' gia' COMPLETATA restituisce successo
 * senza modifiche, cosi' i double-click non generano errori.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const { data: ril, error: errRiv } = await supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .select('id, stato, token_scadenza')
      .eq('token', token)
      .maybeSingle()

    if (errRiv || !ril) {
      return Response.json({ success: false, error: 'Link non valido' }, { status: 404 })
    }

    // Idempotenza: gia' completata, OK senza fare nulla
    if (ril.stato === 'COMPLETATA') {
      return Response.json({
        success: true,
        data: { stato: 'COMPLETATA', alreadySubmitted: true },
      })
    }

    if (!['INVIATA', 'IN_COMPILAZIONE', 'BOZZA'].includes(ril.stato)) {
      return Response.json(
        { success: false, error: 'Stato non valido per l\'invio' },
        { status: 403 }
      )
    }

    if (ril.token_scadenza && new Date(ril.token_scadenza).getTime() < Date.now()) {
      return Response.json({ success: false, error: 'Il link e\' scaduto' }, { status: 410 })
    }

    const oraIso = new Date().toISOString()
    const { data: updated, error: errUp } = await supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .update({
        stato: 'COMPLETATA',
        data_completamento: oraIso,
        data_ultima_modifica: oraIso,
      })
      .eq('id', ril.id)
      .select()
      .single()

    if (errUp) throw errUp

    return Response.json({ success: true, data: updated })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nell\'invio'
    console.error('[API fabbisogno public] submit Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
