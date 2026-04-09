import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { uploadFile, BUCKET_CONTRATTI } from '@/lib/supabaseStorage'

// POST - Upload contratto firmato
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: trackingId } = await params
    const formData = await request.formData()

    const file = formData.get('file') as File | null
    const notes = formData.get('notes') as string | null

    if (!file) {
      return Response.json({
        success: false,
        error: 'Il file del contratto firmato è obbligatorio'
      }, { status: 400 })
    }

    // Verify tracking record exists
    const { data: tracking, error: fetchError } = await supabase
      .from('scadenze_bandi_contract_tracking')
      .select('id, entity_type, entity_id, cliente_id')
      .eq('id', trackingId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Record di tracking non trovato'
        }, { status: 404 })
      }
      throw fetchError
    }

    // Generate storage path
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${tracking.cliente_id}/${tracking.entity_type}/${tracking.entity_id}/${timestamp}_${sanitizedName}`

    // Upload to Supabase Storage
    await uploadFile(BUCKET_CONTRATTI, storagePath, file, file.type)

    // Update tracking record
    const { data, error: updateError } = await supabase
      .from('scadenze_bandi_contract_tracking')
      .update({
        signed_contract_received: true,
        signed_contract_received_at: new Date().toISOString(),
        signed_contract_storage_path: storagePath,
        signed_contract_notes: notes || null,
        overall_status: 'SIGNED_RECEIVED'
      })
      .eq('id', trackingId)
      .select()
      .single()

    if (updateError) throw updateError

    return Response.json({
      success: true,
      data,
      message: 'Contratto firmato caricato con successo'
    })

  } catch (error: any) {
    console.error('Errore nel caricamento contratto firmato:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel caricamento del contratto firmato'
    }, { status: 500 })
  }
}
