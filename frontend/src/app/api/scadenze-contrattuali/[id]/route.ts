import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Recupera singola scadenza con log entries
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Recupera la scadenza
    const { data: scadenza, error: scadenzaError } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .select('*')
      .eq('id', id)
      .single()

    if (scadenzaError) {
      if (scadenzaError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Scadenza non trovata'
        }, { status: 404 })
      }
      throw scadenzaError
    }

    // Recupera i log entries
    const { data: logs, error: logsError } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali_log')
      .select('*')
      .eq('scadenza_id', id)
      .order('created_at', { ascending: false })

    if (logsError) {
      console.error('Errore nel recupero log:', logsError)
    }

    return Response.json({
      success: true,
      data: {
        ...scadenza,
        logs: logs || []
      }
    })

  } catch (error: any) {
    console.error('Errore nel recupero scadenza contrattuale:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero della scadenza contrattuale'
    }, { status: 500 })
  }
}

// PUT - Aggiorna scadenza contrattuale
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Escludi campi non aggiornabili
    const {
      id: _id,
      created_at: _ca,
      created_by: _cb,
      logs: _logs,
      ...updateData
    } = body

    const { data, error } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Scadenza non trovata'
        }, { status: 404 })
      }
      throw error
    }

    // Inserisci log di modifica
    const campiModificati = Object.keys(updateData).join(', ')
    await supabase
      .from('scadenze_bandi_scadenze_contrattuali_log')
      .insert([{
        scadenza_id: id,
        azione: 'modifica',
        descrizione: `Campi modificati: ${campiModificati}`,
        eseguito_da: body.updated_by || 'system'
      }])

    return Response.json({
      success: true,
      data,
      message: 'Scadenza contrattuale aggiornata con successo'
    })

  } catch (error: any) {
    console.error('Errore nell\'aggiornamento scadenza contrattuale:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nell\'aggiornamento della scadenza contrattuale'
    }, { status: 500 })
  }
}

// DELETE - Elimina scadenza contrattuale
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verifica che la scadenza esista
    const { data: scadenza, error: fetchError } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .select('id, titolo')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Scadenza non trovata'
        }, { status: 404 })
      }
      throw fetchError
    }

    // Elimina i log associati
    await supabase
      .from('scadenze_bandi_scadenze_contrattuali_log')
      .delete()
      .eq('scadenza_id', id)

    // Elimina la scadenza
    const { error } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .delete()
      .eq('id', id)

    if (error) throw error

    return Response.json({
      success: true,
      message: `Scadenza "${scadenza.titolo}" eliminata con successo`
    })

  } catch (error: any) {
    console.error('Errore nell\'eliminazione scadenza contrattuale:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nell\'eliminazione della scadenza contrattuale'
    }, { status: 500 })
  }
}
