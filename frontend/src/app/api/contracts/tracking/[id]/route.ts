import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Recupera singolo record di tracking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data, error } = await supabase
      .from('scadenze_bandi_contract_tracking')
      .select('*, scadenze_bandi_clienti(denominazione, email, pec)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Record di tracking non trovato'
        }, { status: 404 })
      }
      throw error
    }

    // Flatten join
    const result = {
      ...data,
      cliente_denominazione: data.scadenze_bandi_clienti?.denominazione || null,
      cliente_email: data.scadenze_bandi_clienti?.email || null,
      cliente_pec: data.scadenze_bandi_clienti?.pec || null,
      scadenze_bandi_clienti: undefined
    }

    return Response.json({
      success: true,
      data: result
    })

  } catch (error: any) {
    console.error('Errore nel recupero tracking contratto:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero del record di tracking'
    }, { status: 500 })
  }
}

// PUT - Aggiorna record di tracking
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Exclude non-updatable fields
    const {
      id: _id,
      created_at: _ca,
      scadenze_bandi_clienti: _cl,
      cliente_denominazione: _cd,
      cliente_email: _ce,
      cliente_pec: _cp,
      ...updateData
    } = body

    const { data, error } = await supabase
      .from('scadenze_bandi_contract_tracking')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Record di tracking non trovato'
        }, { status: 404 })
      }
      throw error
    }

    return Response.json({
      success: true,
      data,
      message: 'Record di tracking aggiornato con successo'
    })

  } catch (error: any) {
    console.error('Errore nell\'aggiornamento tracking contratto:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nell\'aggiornamento del record di tracking'
    }, { status: 500 })
  }
}
