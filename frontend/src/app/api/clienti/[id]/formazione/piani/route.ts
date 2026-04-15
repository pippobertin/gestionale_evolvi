import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import { syncPianoScadenze } from '@/lib/formazione/syncScadenze'

// GET - Lista piani formativi per cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clienteId } = await params
    const { searchParams } = new URL(request.url)
    const stato = searchParams.get('stato')
    const fondoId = searchParams.get('fondo_id')

    let query = supabase
      .from('scadenze_bandi_piani_formativi')
      .select(`
        *,
        fondo:scadenze_bandi_fondi_interprofessionali(id, codice, nome, sigla),
        adesione:scadenze_bandi_clienti_adesioni_fpi(id, codice_adesione)
      `)
      .eq('cliente_id', clienteId)

    if (stato) query = query.eq('stato', stato)
    if (fondoId) query = query.eq('fondo_id', fondoId)

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error

    return Response.json({ success: true, data: data || [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel recupero piani'
    console.error('[API piani] GET Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

// POST - Crea nuovo piano formativo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await verifyJWT(request)
    const { id: clienteId } = await params
    const body = await request.json()

    const { data, error } = await supabase
      .from('scadenze_bandi_piani_formativi')
      .insert({
        cliente_id: clienteId,
        adesione_fpi_id: body.adesione_fpi_id,
        fondo_id: body.fondo_id,
        codice_piano: body.codice_piano,
        titolo: body.titolo,
        descrizione: body.descrizione,
        tipologia: body.tipologia,
        canale_finanziamento: body.canale_finanziamento,
        avviso_riferimento: body.avviso_riferimento,
        stato: 'BOZZA',
        data_presentazione: body.data_presentazione,
        data_approvazione: body.data_approvazione,
        data_inizio_attivita: body.data_inizio_attivita,
        data_fine_attivita: body.data_fine_attivita,
        data_scadenza_rendicontazione: body.data_scadenza_rendicontazione,
        importo_richiesto: body.importo_richiesto,
        importo_approvato: body.importo_approvato,
        ore_previste: body.ore_previste,
        num_partecipanti_previsti: body.num_partecipanti_previsti,
        responsabile_piano: body.responsabile_piano,
        note: body.note,
        created_by: decoded?.userId,
      })
      .select()
      .single()

    if (error) throw error

    // Sync scadenze if relevant dates exist
    if (data.data_scadenza_rendicontazione || data.data_fine_attivita) {
      await syncPianoScadenze(data.id)
    }

    return Response.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nella creazione piano'
    console.error('[API piani] POST Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
