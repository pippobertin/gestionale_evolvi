import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'

// GET - Lista adesioni FPI per cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clienteId } = await params

    const { data, error } = await supabase
      .from('scadenze_bandi_clienti_adesioni_fpi')
      .select(`
        *,
        fondo:scadenze_bandi_fondi_interprofessionali(id, codice, nome, sigla),
        ccnl:scadenze_bandi_ccnl(id, codice, denominazione, settore)
      `)
      .eq('cliente_id', clienteId)
      .order('data_adesione', { ascending: false })

    if (error) throw error

    return Response.json({ success: true, data: data || [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel recupero adesioni'
    console.error('[API adesioni] GET Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

// POST - Crea nuova adesione FPI
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await verifyJWT(request)
    const { id: clienteId } = await params
    const body = await request.json()

    const { data, error } = await supabase
      .from('scadenze_bandi_clienti_adesioni_fpi')
      .insert({
        cliente_id: clienteId,
        fondo_id: body.fondo_id,
        codice_adesione: body.codice_adesione,
        data_adesione: body.data_adesione,
        data_cessazione: body.data_cessazione,
        ccnl_applicato: body.ccnl_applicato,
        ccnl_id: body.ccnl_id || null,
        sigle_sindacali_ids: body.sigle_sindacali_ids || [],
        matricole_inps_associate: body.matricole_inps_associate,
        dipendenti_aderenti: body.dipendenti_aderenti,
        stato: body.stato || 'ATTIVA',
        note: body.note,
        created_by: decoded?.userId,
      })
      .select(`
        *,
        fondo:scadenze_bandi_fondi_interprofessionali(id, codice, nome, sigla),
        ccnl:scadenze_bandi_ccnl(id, codice, denominazione, settore)
      `)
      .single()

    if (error) throw error

    return Response.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nella creazione adesione'
    console.error('[API adesioni] POST Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
