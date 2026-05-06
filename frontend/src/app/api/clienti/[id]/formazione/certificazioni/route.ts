import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import { syncCertificazioneScadenza, computeCertificazioneStato } from '@/lib/formazione/syncScadenze'

// GET - Lista certificazioni obbligatorie per cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clienteId } = await params

    const { data, error } = await supabase
      .from('scadenze_bandi_certificazioni_obbligatorie')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('data_scadenza', { ascending: true })

    if (error) throw error

    // Compute dynamic state based on dates
    const enriched = (data || []).map(cert => ({
      ...cert,
      stato: computeCertificazioneStato(cert.data_scadenza),
    }))

    return Response.json({ success: true, data: enriched })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel recupero certificazioni'
    console.error('[API certificazioni] GET Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

// POST - Crea nuova certificazione
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyJWT(request)
    const { id: clienteId } = await params
    const body = await request.json()

    const stato = computeCertificazioneStato(body.data_scadenza)

    const { data, error } = await supabase
      .from('scadenze_bandi_certificazioni_obbligatorie')
      .insert({
        cliente_id: clienteId,
        tipo_obbligo: body.tipo_obbligo,
        normativa_riferimento: body.normativa_riferimento,
        persona_nome: body.persona_nome,
        persona_codice_fiscale: body.persona_codice_fiscale,
        data_conseguimento: body.data_conseguimento,
        data_scadenza: body.data_scadenza,
        validita_mesi: body.validita_mesi,
        stato,
        corso_collegato_id: body.corso_collegato_id,
        note: body.note,
      })
      .select()
      .single()

    if (error) throw error

    // Sync scadenza
    await syncCertificazioneScadenza(data.id)

    return Response.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nella creazione certificazione'
    console.error('[API certificazioni] POST Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
