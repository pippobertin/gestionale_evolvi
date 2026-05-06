import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'

/**
 * POST — Marca una rilevazione come INVIATA al cliente.
 *
 * Da chiamare DOPO che il consulente ha effettivamente spedito l'email
 * con il link di compilazione (l'invio email avviene lato frontend
 * tramite /api/gmail/send).
 *
 * Aggiorna stato e tracking. Funziona anche per re-invii (sollecito):
 * in quel caso aggiorna data_invio mantenendo lo stato attuale se gia'
 * compilando.
 *
 * Body opzionale:
 *   { eh_sollecito?: boolean }
 *     - false (default): primo invio. Stato passa da BOZZA → INVIATA.
 *     - true: re-invio. Lo stato resta uguale, viene aggiornato solo data_invio.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rilevazioneId: string }> }
) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const { id: clienteId, rilevazioneId } = await params
    const body = await request.json().catch(() => ({}))
    const ehSollecito = !!body.eh_sollecito

    // Verifica esistenza
    const { data: ril, error: errFetch } = await supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .select('id, stato')
      .eq('id', rilevazioneId)
      .eq('cliente_id', clienteId)
      .single()

    if (errFetch) {
      if (errFetch.code === 'PGRST116') {
        return Response.json({ success: false, error: 'Rilevazione non trovata' }, { status: 404 })
      }
      throw errFetch
    }

    // Stati su cui non ha senso inviare/sollecitare
    if (['COMPLETATA', 'ARCHIVIATA'].includes(ril.stato)) {
      return Response.json(
        { success: false, error: `Rilevazione ${ril.stato.toLowerCase()}: non e' possibile inviare un nuovo link` },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = {
      data_invio: new Date().toISOString(),
      inviata_da_utente_id: auth.userId,
    }

    if (!ehSollecito && ril.stato === 'BOZZA') {
      updates.stato = 'INVIATA'
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .update(updates)
      .eq('id', rilevazioneId)
      .select()
      .single()

    if (error) throw error
    return Response.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel marcare invio'
    console.error('[API fabbisogno] invia Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
