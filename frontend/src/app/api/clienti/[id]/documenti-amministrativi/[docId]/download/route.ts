import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getSignedUrl, BUCKET_CLIENTI } from '@/lib/supabaseStorage'

// GET - Genera URL di download firmato per il documento
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: clienteId, docId } = await params

    // Recupera il documento per ottenere il path nello storage
    const { data: doc, error: fetchError } = await supabase
      .from('scadenze_bandi_documenti_amministrativi')
      .select('storage_path, nome_originale, mime_type')
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

    // Genera signed URL (valido per 1 ora)
    const signedUrl = await getSignedUrl(BUCKET_CLIENTI, doc.storage_path, 3600)

    // Check if redirect param is set
    const { searchParams } = new URL(request.url)
    const redirect = searchParams.get('redirect')

    if (redirect === 'true') {
      return Response.redirect(signedUrl)
    }

    return Response.json({
      success: true,
      data: {
        url: signedUrl,
        nome_originale: doc.nome_originale,
        mime_type: doc.mime_type
      }
    })

  } catch (error: any) {
    console.error('Errore nella generazione URL download:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nella generazione del link di download'
    }, { status: 500 })
  }
}
