import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'

/**
 * GET — Dettaglio di una rilevazione, comprese le tabelle figlie:
 *   - popolazione (A6)
 *   - inserimenti previsti (A7)
 *   - obblighi dichiarati (C1)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rilevazioneId: string }> }
) {
  try {
    const { id: clienteId, rilevazioneId } = await params

    const { data: rilevazione, error: errRiv } = await supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .select('*')
      .eq('id', rilevazioneId)
      .eq('cliente_id', clienteId)
      .single()

    if (errRiv) {
      if (errRiv.code === 'PGRST116') {
        return Response.json({ success: false, error: 'Rilevazione non trovata' }, { status: 404 })
      }
      throw errRiv
    }

    const [popRes, insRes, obbRes] = await Promise.all([
      supabase
        .from('scadenze_bandi_fabbisogno_popolazione')
        .select('*')
        .eq('rilevazione_id', rilevazioneId)
        .order('ordine', { ascending: true }),
      supabase
        .from('scadenze_bandi_fabbisogno_inserimenti_previsti')
        .select('*')
        .eq('rilevazione_id', rilevazioneId)
        .order('ordine', { ascending: true }),
      supabase
        .from('scadenze_bandi_fabbisogno_obblighi_dichiarati')
        .select('*')
        .eq('rilevazione_id', rilevazioneId),
    ])

    if (popRes.error) throw popRes.error
    if (insRes.error) throw insRes.error
    if (obbRes.error) throw obbRes.error

    return Response.json({
      success: true,
      data: {
        ...rilevazione,
        popolazione: popRes.data || [],
        inserimenti_previsti: insRes.data || [],
        obblighi_dichiarati: obbRes.data || [],
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel recupero rilevazione'
    console.error('[API fabbisogno] GET dettaglio Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * PATCH — Modifica metadati o stato di una rilevazione.
 * Campi modificabili: titolo, anno_riferimento, stato, token_scadenza.
 * NB: i contenuti del questionario si modificano dagli endpoint pubblici
 * (cliente) tramite token, non da qui.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rilevazioneId: string }> }
) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const { id: clienteId, rilevazioneId } = await params
    const body = await request.json()

    const updates: Record<string, unknown> = {}

    if (typeof body.titolo === 'string') updates.titolo = body.titolo.slice(0, 200)
    if (Number.isInteger(body.anno_riferimento)) updates.anno_riferimento = body.anno_riferimento
    if (typeof body.stato === 'string') {
      const statiAmmessi = ['BOZZA', 'INVIATA', 'IN_COMPILAZIONE', 'COMPLETATA', 'SCADUTA', 'ARCHIVIATA']
      if (!statiAmmessi.includes(body.stato)) {
        return Response.json({ success: false, error: 'Stato non valido' }, { status: 400 })
      }
      updates.stato = body.stato
    }
    if (typeof body.token_scadenza === 'string') updates.token_scadenza = body.token_scadenza

    if (Object.keys(updates).length === 0) {
      return Response.json({ success: false, error: 'Nessun campo da aggiornare' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .update(updates)
      .eq('id', rilevazioneId)
      .eq('cliente_id', clienteId)
      .select()
      .single()

    if (error) throw error
    return Response.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nell\'aggiornamento'
    console.error('[API fabbisogno] PATCH Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * DELETE — Elimina definitivamente una rilevazione.
 * Per nasconderla senza cancellarla, usare PATCH con stato=ARCHIVIATA.
 * La cascata cancella popolazione, inserimenti e obblighi correlati.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rilevazioneId: string }> }
) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const { id: clienteId, rilevazioneId } = await params

    const { error } = await supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .delete()
      .eq('id', rilevazioneId)
      .eq('cliente_id', clienteId)

    if (error) throw error
    return Response.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nella cancellazione'
    console.error('[API fabbisogno] DELETE Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
