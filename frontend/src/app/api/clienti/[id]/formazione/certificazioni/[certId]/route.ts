import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import { syncCertificazioneScadenza, computeCertificazioneStato } from '@/lib/formazione/syncScadenze'

// PUT - Aggiorna certificazione
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; certId: string }> }
) {
  try {
    await verifyJWT(request)
    const { certId } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    const fields = [
      'tipo_obbligo', 'normativa_riferimento', 'persona_nome',
      'persona_codice_fiscale', 'data_conseguimento', 'data_scadenza',
      'validita_mesi', 'corso_collegato_id', 'note', 'file_attestato_storage_path',
    ]

    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Recompute state if date changed
    if (body.data_scadenza !== undefined) {
      updateData.stato = computeCertificazioneStato(body.data_scadenza)
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_certificazioni_obbligatorie')
      .update(updateData)
      .eq('id', certId)
      .select()
      .single()

    if (error) throw error

    await syncCertificazioneScadenza(certId)

    return Response.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore aggiornamento certificazione'
    console.error('[API certificazioni] PUT Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

// DELETE - Elimina certificazione
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; certId: string }> }
) {
  try {
    await verifyJWT(request)
    const { certId } = await params

    // Remove linked scadenze
    await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .delete()
      .eq('entity_type', 'FORMAZIONE')
      .eq('entity_id', certId)

    const { error } = await supabase
      .from('scadenze_bandi_certificazioni_obbligatorie')
      .delete()
      .eq('id', certId)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore eliminazione certificazione'
    console.error('[API certificazioni] DELETE Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
