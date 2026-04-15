import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'

// GET - Lista corsi formativi per cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clienteId } = await params
    const { searchParams } = new URL(request.url)
    const pianoId = searchParams.get('piano_id')
    const stato = searchParams.get('stato')

    let query = supabase
      .from('scadenze_bandi_corsi_formativi')
      .select(`
        *,
        piano:scadenze_bandi_piani_formativi(id, titolo, codice_piano)
      `)
      .eq('cliente_id', clienteId)

    if (pianoId) query = query.eq('piano_formativo_id', pianoId)
    if (stato) query = query.eq('stato', stato)

    query = query.order('data_inizio', { ascending: false })

    const { data, error } = await query
    if (error) throw error

    return Response.json({ success: true, data: data || [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel recupero corsi'
    console.error('[API corsi] GET Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

// POST - Crea nuovo corso formativo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyJWT(request)
    const { id: clienteId } = await params
    const body = await request.json()

    const { data, error } = await supabase
      .from('scadenze_bandi_corsi_formativi')
      .insert({
        cliente_id: clienteId,
        piano_formativo_id: body.piano_formativo_id,
        titolo: body.titolo,
        area_tematica: body.area_tematica,
        modalita: body.modalita,
        ore_durata: body.ore_durata,
        data_inizio: body.data_inizio,
        data_fine: body.data_fine,
        sede: body.sede,
        ente_erogatore: body.ente_erogatore,
        docente: body.docente,
        numero_partecipanti: body.numero_partecipanti,
        stato: body.stato || 'PIANIFICATO',
        costo_totale: body.costo_totale,
        note: body.note,
      })
      .select()
      .single()

    if (error) throw error

    return Response.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nella creazione corso'
    console.error('[API corsi] POST Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
