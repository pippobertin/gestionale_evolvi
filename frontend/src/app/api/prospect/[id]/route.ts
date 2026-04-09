import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Recupera singolo prospect con history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Recupera il prospect
    const { data: prospect, error: prospectError } = await supabase
      .from('scadenze_bandi_prospect')
      .select('*')
      .eq('id', id)
      .single()

    if (prospectError) {
      if (prospectError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Prospect non trovato'
        }, { status: 404 })
      }
      throw prospectError
    }

    // Recupera la history del prospect
    const { data: history, error: historyError } = await supabase
      .from('scadenze_bandi_prospect_history')
      .select('*')
      .eq('prospect_id', id)
      .order('created_at', { ascending: false })

    if (historyError) {
      console.error('Errore nel recupero history:', historyError)
    }

    return Response.json({
      success: true,
      data: {
        ...prospect,
        history: history || []
      }
    })

  } catch (error: any) {
    console.error('Errore nel recupero prospect:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero del prospect'
    }, { status: 500 })
  }
}

// PUT - Aggiorna prospect
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Recupera lo stato corrente prima dell'aggiornamento
    const { data: currentProspect, error: fetchError } = await supabase
      .from('scadenze_bandi_prospect')
      .select('stato')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Prospect non trovato'
        }, { status: 404 })
      }
      throw fetchError
    }

    const statoPrecedente = currentProspect.stato

    // Prepara i dati di aggiornamento (escludi campi non aggiornabili)
    const { id: _id, created_at: _ca, numero_prospect: _np, history: _h, ...updateData } = body

    const { data, error } = await supabase
      .from('scadenze_bandi_prospect')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Se lo stato è cambiato, inserisci un record nella history
    if (body.stato && body.stato !== statoPrecedente) {
      await supabase
        .from('scadenze_bandi_prospect_history')
        .insert([{
          prospect_id: id,
          stato_precedente: statoPrecedente,
          stato_nuovo: body.stato,
          note: body.note_history || null,
          utente: body.aggiornato_da || 'system'
        }])
    }

    return Response.json({
      success: true,
      data,
      message: 'Prospect aggiornato con successo'
    })

  } catch (error: any) {
    console.error('Errore nell\'aggiornamento prospect:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nell\'aggiornamento del prospect'
    }, { status: 500 })
  }
}

// DELETE - Elimina prospect (solo se stato è 'nuovo' o 'rifiutato')
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verifica lo stato corrente
    const { data: prospect, error: fetchError } = await supabase
      .from('scadenze_bandi_prospect')
      .select('stato, denominazione')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Prospect non trovato'
        }, { status: 404 })
      }
      throw fetchError
    }

    if (!['nuovo', 'rifiutato'].includes(prospect.stato)) {
      return Response.json({
        success: false,
        error: `Impossibile eliminare un prospect con stato "${prospect.stato}". È possibile eliminare solo prospect con stato "nuovo" o "rifiutato".`
      }, { status: 400 })
    }

    const { error } = await supabase
      .from('scadenze_bandi_prospect')
      .delete()
      .eq('id', id)

    if (error) throw error

    return Response.json({
      success: true,
      message: `Prospect "${prospect.denominazione}" eliminato con successo`
    })

  } catch (error: any) {
    console.error('Errore nell\'eliminazione prospect:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nell\'eliminazione del prospect'
    }, { status: 500 })
  }
}
