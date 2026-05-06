import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

const VALID_TRANSITIONS: Record<string, string[]> = {
  bozza: ['qualificato', 'congelato', 'archiviato'],
  qualificato: ['in_decisione', 'congelato', 'archiviato'],
  in_decisione: ['preso_in_carico', 'congelato', 'archiviato'],
  preso_in_carico: ['convertito', 'congelato', 'archiviato'],
  congelato: ['archiviato'], // + stato_pre_congelamento via scongela
  convertito: [],
  archiviato: []
}

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
      .select('*')
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

    // Validate state transition if stato is changing
    if (body.stato && body.stato !== statoPrecedente) {
      // Special case: scongela (congelato -> stato_pre_congelamento)
      const isScongela = statoPrecedente === 'congelato' && body.stato === currentProspect.stato_pre_congelamento
      const allowed = VALID_TRANSITIONS[statoPrecedente] || []
      if (!isScongela && !allowed.includes(body.stato)) {
        return Response.json({
          success: false,
          error: `Transizione di stato non valida: ${statoPrecedente} -> ${body.stato}`
        }, { status: 400 })
      }
    }

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

// DELETE - Archivia prospect (non cancella più il record)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Recupera lo stato corrente
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

    if (['convertito', 'archiviato'].includes(prospect.stato)) {
      return Response.json({
        success: false,
        error: `Impossibile archiviare un prospect con stato "${prospect.stato}".`
      }, { status: 400 })
    }

    // Archivia invece di cancellare
    const { error } = await supabase
      .from('scadenze_bandi_prospect')
      .update({
        stato: 'archiviato',
        archiviato_il: new Date().toISOString(),
        motivo_archiviazione: 'Archiviato via eliminazione',
        // Pulisci campi freeze se era congelato
        congelato_il: null,
        scongela_il: null,
        stato_pre_congelamento: null,
        motivo_congelamento: null
      })
      .eq('id', id)

    if (error) throw error

    // History
    await supabase
      .from('scadenze_bandi_prospect_history')
      .insert([{
        prospect_id: id,
        stato_precedente: prospect.stato,
        stato_nuovo: 'archiviato',
        note: 'Prospect archiviato'
      }])

    return Response.json({
      success: true,
      message: `Prospect "${prospect.denominazione}" archiviato con successo`
    })

  } catch (error: any) {
    console.error('Errore nell\'archiviazione prospect:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nell\'archiviazione del prospect'
    }, { status: 500 })
  }
}
