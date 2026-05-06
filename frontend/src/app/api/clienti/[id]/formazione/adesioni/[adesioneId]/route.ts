import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'

// PUT - Aggiorna adesione FPI
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; adesioneId: string }> }
) {
  try {
    await verifyJWT(request)
    const { adesioneId } = await params
    const body = await request.json()

    const { data, error } = await supabase
      .from('scadenze_bandi_clienti_adesioni_fpi')
      .update({
        fondo_id: body.fondo_id,
        codice_adesione: body.codice_adesione,
        data_adesione: body.data_adesione,
        data_cessazione: body.data_cessazione,
        ccnl_applicato: body.ccnl_applicato,
        ccnl_id: body.ccnl_id || null,
        sigle_sindacali_ids: body.sigle_sindacali_ids || [],
        matricole_inps_associate: body.matricole_inps_associate,
        dipendenti_aderenti: body.dipendenti_aderenti,
        stato: body.stato,
        note: body.note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adesioneId)
      .select(`
        *,
        fondo:scadenze_bandi_fondi_interprofessionali(id, codice, nome, sigla),
        ccnl:scadenze_bandi_ccnl(id, codice, denominazione, settore)
      `)
      .single()

    if (error) throw error

    return Response.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore aggiornamento adesione'
    console.error('[API adesioni] PUT Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

// DELETE - Elimina adesione FPI
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; adesioneId: string }> }
) {
  try {
    await verifyJWT(request)
    const { adesioneId } = await params

    const { error } = await supabase
      .from('scadenze_bandi_clienti_adesioni_fpi')
      .delete()
      .eq('id', adesioneId)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore eliminazione adesione'
    console.error('[API adesioni] DELETE Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
