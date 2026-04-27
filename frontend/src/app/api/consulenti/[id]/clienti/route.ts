import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: lista clienti segnalati dal consulente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: consulenteId } = await params

    const { data, error } = await supabase
      .from('scadenze_bandi_consulenti_clienti')
      .select(`
        id,
        consulente_id,
        cliente_id,
        tipo_segnalazione,
        data_segnalazione,
        note,
        created_at,
        cliente:scadenze_bandi_clienti!cliente_id(
          id, denominazione, partita_iva, email, telefono,
          citta_fatturazione, provincia_fatturazione,
          categoria_evolvi
        )
      `)
      .eq('consulente_id', consulenteId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return Response.json({ success: true, data: data || [] })
  } catch (error: any) {
    console.error('Errore fetch clienti consulente:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST: crea associazione consulente -> cliente
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: consulenteId } = await params
    const body = await request.json()

    if (!body.cliente_id || !body.tipo_segnalazione) {
      return Response.json({
        success: false,
        error: 'cliente_id e tipo_segnalazione sono obbligatori'
      }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_consulenti_clienti')
      .insert([{
        consulente_id: consulenteId,
        cliente_id: body.cliente_id,
        tipo_segnalazione: body.tipo_segnalazione,
        data_segnalazione: body.data_segnalazione || new Date().toISOString().split('T')[0],
        note: body.note || null
      }])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return Response.json({
          success: false,
          error: 'Questo cliente è già associato per questo tipo di segnalazione'
        }, { status: 409 })
      }
      throw error
    }

    return Response.json({ success: true, data })
  } catch (error: any) {
    console.error('Errore creazione associazione consulente:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
