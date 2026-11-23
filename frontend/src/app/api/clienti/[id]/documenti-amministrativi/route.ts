import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { caricaDocumentoCliente, contestoDrive } from '@/lib/driveCliente'
import { verifyJWT } from '@/lib/jwtAuth'

export const maxDuration = 60

// GET - Lista documenti amministrativi per cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clienteId } = await params
    const { searchParams } = new URL(request.url)
    const tipo_documento = searchParams.get('tipo_documento')
    const categoria = searchParams.get('categoria')

    let query = supabase
      .from('scadenze_bandi_documenti_amministrativi')
      .select('*')
      .eq('cliente_id', clienteId)

    if (tipo_documento) {
      query = query.eq('tipo_documento', tipo_documento)
    }

    if (categoria) {
      query = query.eq('categoria', categoria)
    }

    query = query.order('uploaded_at', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    return Response.json({
      success: true,
      data: data || []
    })

  } catch (error: any) {
    console.error('Errore nel recupero documenti amministrativi:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero dei documenti amministrativi'
    }, { status: 500 })
  }
}

// POST - Carica nuovo documento amministrativo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clienteId } = await params
    const formData = await request.formData()

    const file = formData.get('file') as File | null
    const tipo_documento = formData.get('tipo_documento') as string
    const categoria = formData.get('categoria') as string
    const descrizione = formData.get('descrizione') as string | null
    const data_documento = formData.get('data_documento') as string | null
    const data_scadenza = formData.get('data_scadenza') as string | null
    const tagsRaw = formData.get('tags') as string | null

    if (!file) {
      return Response.json({
        success: false,
        error: 'Il file è obbligatorio'
      }, { status: 400 })
    }

    if (!tipo_documento) {
      return Response.json({
        success: false,
        error: 'Il tipo_documento è obbligatorio'
      }, { status: 400 })
    }

    // Parse tags
    let tags: string[] = []
    if (tagsRaw) {
      try {
        tags = JSON.parse(tagsRaw)
      } catch {
        tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
      }
    }

    // Il file va su Google Drive, nella cartella del cliente (CLIENTI/<cliente>/DOCUMENTI/<categoria>)
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const drive = await caricaDocumentoCliente(await contestoDrive(), clienteId, categoria || 'ALTRO',
      file.name, Buffer.from(await file.arrayBuffer()), file.type || 'application/octet-stream')
    const sessione = await verifyJWT(request)

    // Insert metadata record
    const documentData = {
      cliente_id: clienteId,
      tipo_documento,
      categoria: categoria || 'ALTRO',
      nome_file: `${timestamp}_${sanitizedName}`,
      nome_originale: file.name,
      dimensione_bytes: file.size,
      mime_type: file.type || 'application/octet-stream',
      storage_path: null,
      google_drive_id: drive.id,
      google_drive_url: drive.url,
      descrizione: descrizione || null,
      data_documento: data_documento || null,
      data_scadenza: data_scadenza || null,
      verificato: false,
      tags: tags,
      uploaded_by: sessione?.userId || 'system'
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_documenti_amministrativi')
      .insert([documentData])
      .select()
      .single()

    if (error) throw error

    return Response.json({
      success: true,
      data,
      message: 'Documento caricato con successo'
    })

  } catch (error: any) {
    console.error('Errore nel caricamento documento amministrativo:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel caricamento del documento'
    }, { status: 500 })
  }
}
