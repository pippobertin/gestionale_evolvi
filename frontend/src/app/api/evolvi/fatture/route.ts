import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Lista fatture con filtri opzionali
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cliente_id = searchParams.get('cliente_id')
    const contratto_id = searchParams.get('contratto_id')
    const stato_pagamento = searchParams.get('stato_pagamento')

    // Query base con join per denominazione cliente e numero contratto
    let query = supabase
      .from('scadenze_bandi_evolvi_fatture')
      .select('*, scadenze_bandi_clienti(denominazione), scadenze_bandi_contratti_evolvi(numero_contratto)')

    if (cliente_id) {
      query = query.eq('cliente_id', cliente_id)
    }

    if (contratto_id) {
      query = query.eq('contratto_id', contratto_id)
    }

    if (stato_pagamento) {
      query = query.eq('stato_pagamento', stato_pagamento)
    }

    query = query.order('data_scadenza_pagamento', { ascending: true })

    const { data, error } = await query

    if (error) throw error

    // Flatten join fields
    const fatture = (data || []).map((fattura: any) => ({
      ...fattura,
      cliente_denominazione: fattura.scadenze_bandi_clienti?.denominazione || null,
      numero_contratto: fattura.scadenze_bandi_contratti_evolvi?.numero_contratto || null,
      scadenze_bandi_clienti: undefined,
      scadenze_bandi_contratti_evolvi: undefined
    }))

    return Response.json({
      success: true,
      data: fatture
    })

  } catch (error: any) {
    console.error('Errore nel recupero fatture:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero delle fatture'
    }, { status: 500 })
  }
}

// POST - Crea nuova fattura
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.contratto_id) {
      return Response.json({
        success: false,
        error: 'Il campo contratto_id è obbligatorio'
      }, { status: 400 })
    }

    if (!body.cliente_id) {
      return Response.json({
        success: false,
        error: 'Il campo cliente_id è obbligatorio'
      }, { status: 400 })
    }

    if (!body.importo_netto || !body.importo_totale) {
      return Response.json({
        success: false,
        error: 'I campi importo_netto e importo_totale sono obbligatori'
      }, { status: 400 })
    }

    const fatturaData = {
      contratto_id: body.contratto_id,
      cliente_id: body.cliente_id,
      numero_fattura: body.numero_fattura || null,
      data_fattura: body.data_fattura || null,
      data_scadenza_pagamento: body.data_scadenza_pagamento || null,
      importo_netto: body.importo_netto,
      importo_iva: body.importo_iva || 0,
      importo_totale: body.importo_totale,
      periodo_inizio: body.periodo_inizio || null,
      periodo_fine: body.periodo_fine || null,
      stato_pagamento: body.stato_pagamento || 'PENDING',
      note: body.note || null,
      created_by: body.created_by || 'system'
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_evolvi_fatture')
      .insert([fatturaData])
      .select()
      .single()

    if (error) throw error

    return Response.json({
      success: true,
      data,
      message: 'Fattura creata con successo'
    })

  } catch (error: any) {
    console.error('Errore nella creazione fattura:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nella creazione della fattura'
    }, { status: 500 })
  }
}
