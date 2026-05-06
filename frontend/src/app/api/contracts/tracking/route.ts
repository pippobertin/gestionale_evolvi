import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Lista record di tracking contratti con filtri opzionali
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const entity_type = searchParams.get('entity_type')
    const cliente_id = searchParams.get('cliente_id')
    const overall_status = searchParams.get('overall_status')

    let query = supabase
      .from('scadenze_bandi_contract_tracking')
      .select('*, scadenze_bandi_clienti(denominazione, email, pec)')

    if (entity_type) {
      query = query.eq('entity_type', entity_type)
    }

    if (cliente_id) {
      query = query.eq('cliente_id', cliente_id)
    }

    if (overall_status) {
      query = query.eq('overall_status', overall_status)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    // Flatten join data
    const trackingRecords = (data || []).map((record: any) => ({
      ...record,
      cliente_denominazione: record.scadenze_bandi_clienti?.denominazione || null,
      cliente_email: record.scadenze_bandi_clienti?.email || null,
      cliente_pec: record.scadenze_bandi_clienti?.pec || null,
      scadenze_bandi_clienti: undefined
    }))

    return Response.json({
      success: true,
      data: trackingRecords
    })

  } catch (error: any) {
    console.error('Errore nel recupero tracking contratti:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero dei record di tracking'
    }, { status: 500 })
  }
}

// POST - Crea nuovo record di tracking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.entity_type) {
      return Response.json({
        success: false,
        error: 'Il campo entity_type è obbligatorio'
      }, { status: 400 })
    }

    if (!body.entity_id) {
      return Response.json({
        success: false,
        error: 'Il campo entity_id è obbligatorio'
      }, { status: 400 })
    }

    if (!body.cliente_id) {
      return Response.json({
        success: false,
        error: 'Il campo cliente_id è obbligatorio'
      }, { status: 400 })
    }

    const trackingData = {
      entity_type: body.entity_type,
      entity_id: body.entity_id,
      cliente_id: body.cliente_id,
      contract_document_url: body.contract_document_url || null,
      email_sent: false,
      email_delivery_status: 'PENDING',
      signed_contract_received: false,
      reminder_sent_count: 0,
      reminder_interval_days: body.reminder_interval_days || 7,
      overall_status: 'DRAFT'
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_contract_tracking')
      .insert([trackingData])
      .select()
      .single()

    if (error) throw error

    return Response.json({
      success: true,
      data,
      message: 'Record di tracking creato con successo'
    })

  } catch (error: any) {
    console.error('Errore nella creazione tracking contratto:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nella creazione del record di tracking'
    }, { status: 500 })
  }
}
