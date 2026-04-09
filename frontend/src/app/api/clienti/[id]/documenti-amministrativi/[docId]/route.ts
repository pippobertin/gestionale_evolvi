import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { deleteFile, BUCKET_CLIENTI } from '@/lib/supabaseStorage'

// GET - Recupera singolo documento amministrativo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: clienteId, docId } = await params

    const { data, error } = await supabase
      .from('scadenze_bandi_documenti_amministrativi')
      .select('*')
      .eq('id', docId)
      .eq('cliente_id', clienteId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Documento non trovato'
        }, { status: 404 })
      }
      throw error
    }

    return Response.json({
      success: true,
      data
    })

  } catch (error: any) {
    console.error('Errore nel recupero documento amministrativo:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero del documento'
    }, { status: 500 })
  }
}

// PUT - Aggiorna metadati documento amministrativo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: clienteId, docId } = await params
    const body = await request.json()

    // Only allow updating specific fields
    const updateData: any = {}

    if (body.descrizione !== undefined) updateData.descrizione = body.descrizione
    if (body.data_scadenza !== undefined) updateData.data_scadenza = body.data_scadenza
    if (body.tags !== undefined) updateData.tags = body.tags

    if (body.verificato !== undefined) {
      updateData.verificato = body.verificato
      if (body.verificato) {
        updateData.verificato_da = body.verificato_da || 'system'
        updateData.verificato_il = new Date().toISOString()
      } else {
        updateData.verificato_da = null
        updateData.verificato_il = null
      }
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_documenti_amministrativi')
      .update(updateData)
      .eq('id', docId)
      .eq('cliente_id', clienteId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Documento non trovato'
        }, { status: 404 })
      }
      throw error
    }

    return Response.json({
      success: true,
      data,
      message: 'Documento aggiornato con successo'
    })

  } catch (error: any) {
    console.error('Errore nell\'aggiornamento documento amministrativo:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nell\'aggiornamento del documento'
    }, { status: 500 })
  }
}

// DELETE - Elimina documento amministrativo (storage + DB)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: clienteId, docId } = await params

    // First get the document to find the storage path
    const { data: doc, error: fetchError } = await supabase
      .from('scadenze_bandi_documenti_amministrativi')
      .select('storage_path, nome_originale')
      .eq('id', docId)
      .eq('cliente_id', clienteId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Documento non trovato'
        }, { status: 404 })
      }
      throw fetchError
    }

    // Delete from storage
    try {
      await deleteFile(BUCKET_CLIENTI, doc.storage_path)
    } catch (storageError: any) {
      console.error('Errore eliminazione file da storage (continuo con eliminazione DB):', storageError)
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('scadenze_bandi_documenti_amministrativi')
      .delete()
      .eq('id', docId)
      .eq('cliente_id', clienteId)

    if (deleteError) throw deleteError

    return Response.json({
      success: true,
      message: `Documento "${doc.nome_originale}" eliminato con successo`
    })

  } catch (error: any) {
    console.error('Errore nell\'eliminazione documento amministrativo:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nell\'eliminazione del documento'
    }, { status: 500 })
  }
}
