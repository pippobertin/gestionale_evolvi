import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Lista contratti Evolvi con filtri opzionali
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cliente_id = searchParams.get('cliente_id')
    const stato = searchParams.get('stato')

    // Query base con join per denominazione cliente
    let query = supabase
      .from('scadenze_bandi_contratti_evolvi')
      .select('*, scadenze_bandi_clienti(denominazione)')

    if (cliente_id) {
      query = query.eq('cliente_id', cliente_id)
    }

    if (stato) {
      query = query.eq('stato', stato)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    // Flatten denominazione dal join
    const contracts = (data || []).map((contract: any) => ({
      ...contract,
      cliente_denominazione: contract.scadenze_bandi_clienti?.denominazione || null,
      scadenze_bandi_clienti: undefined
    }))

    return Response.json({
      success: true,
      data: contracts
    })

  } catch (error: any) {
    console.error('Errore nel recupero contratti Evolvi:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero dei contratti Evolvi'
    }, { status: 500 })
  }
}

// POST - Crea nuovo contratto Evolvi
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.cliente_id) {
      return Response.json({
        success: false,
        error: 'Il campo cliente_id è obbligatorio'
      }, { status: 400 })
    }

    const contractData = {
      cliente_id: body.cliente_id,
      data_contratto: body.data_contratto || null,
      data_inizio: body.data_inizio || null,
      data_fine: body.data_fine || null,
      importo_annuale: body.importo_annuale || null,
      importo_totale: body.importo_totale || null,
      modalita_pagamento: body.modalita_pagamento || null,
      rinnovo_automatico: body.rinnovo_automatico ?? false,
      note: body.note || null,
      stato: 'bozza',
      creato_da: body.creato_da || 'system'
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .insert([contractData])
      .select()
      .single()

    if (error) throw error

    return Response.json({
      success: true,
      data,
      message: 'Contratto Evolvi creato con successo'
    })

  } catch (error: any) {
    console.error('Errore nella creazione contratto Evolvi:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nella creazione del contratto Evolvi'
    }, { status: 500 })
  }
}
