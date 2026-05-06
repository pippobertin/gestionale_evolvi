import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Recupera singola fattura con info cliente e contratto
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: fattura, error: fatturaError } = await supabase
      .from('scadenze_bandi_evolvi_fatture')
      .select('*, scadenze_bandi_clienti(denominazione), scadenze_bandi_contratti_evolvi(numero_contratto)')
      .eq('id', id)
      .single()

    if (fatturaError) {
      if (fatturaError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Fattura non trovata'
        }, { status: 404 })
      }
      throw fatturaError
    }

    const result = {
      ...fattura,
      cliente_denominazione: fattura.scadenze_bandi_clienti?.denominazione || null,
      numero_contratto: fattura.scadenze_bandi_contratti_evolvi?.numero_contratto || null,
      scadenze_bandi_clienti: undefined,
      scadenze_bandi_contratti_evolvi: undefined
    }

    return Response.json({
      success: true,
      data: result
    })

  } catch (error: any) {
    console.error('Errore nel recupero fattura:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero della fattura'
    }, { status: 500 })
  }
}

// PUT - Aggiorna fattura
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
      scadenze_bandi_clienti: _sbc,
      scadenze_bandi_contratti_evolvi: _sbce,
      cliente_denominazione: _cd,
      numero_contratto: _nc,
      ...updateData
    } = body

    const { data, error } = await supabase
      .from('scadenze_bandi_evolvi_fatture')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Fattura non trovata'
        }, { status: 404 })
      }
      throw error
    }

    return Response.json({
      success: true,
      data,
      message: 'Fattura aggiornata con successo'
    })

  } catch (error: any) {
    console.error('Errore nell\'aggiornamento fattura:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nell\'aggiornamento della fattura'
    }, { status: 500 })
  }
}
