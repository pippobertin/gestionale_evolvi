import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { uploadFileToFolder } from '@/lib/googleDrive'

export async function POST(req: NextRequest) {
  try {
    const { contrattoId, approvatoDa } = await req.json()

    if (!contrattoId) {
      return Response.json({
        success: false,
        message: 'ID contratto richiesto'
      }, { status: 400 })
    }

    // 1. Recupera contratto con info file
    const { data: contratto, error: fetchError } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .select('id, stato, numero_contratto, contract_word_id, cliente_id')
      .eq('id', contrattoId)
      .single()

    if (fetchError || !contratto) {
      return Response.json({
        success: false,
        message: 'Contratto non trovato'
      }, { status: 404 })
    }

    if (!['bozza', 'in_revisione'].includes(contratto.stato)) {
      return Response.json({
        success: false,
        message: `Impossibile approvare un contratto con stato "${contratto.stato}". Il contratto deve essere in stato "bozza" o "in_revisione".`
      }, { status: 400 })
    }

    if (!contratto.contract_word_id) {
      return Response.json({
        success: false,
        message: 'Il contratto non ha un documento Word/Google Docs associato. Genera prima il contratto.'
      }, { status: 400 })
    }

    // 2. Ottieni token Google Drive
    const googleAccessToken = await getValidGoogleToken()
    if (!googleAccessToken) {
      return Response.json({
        success: false,
        message: 'Google Drive non configurato'
      }, { status: 401 })
    }

    // 3. Verifica che il file Google Docs esista e recupera la cartella parent
    console.log('Verifica file Google Docs:', contratto.contract_word_id)

    const fileCheckResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${contratto.contract_word_id}?fields=mimeType,name,parents&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers: { 'Authorization': `Bearer ${googleAccessToken}` } }
    )

    if (!fileCheckResponse.ok) {
      return Response.json({
        success: false,
        message: 'File contratto non trovato su Google Drive'
      }, { status: 404 })
    }

    const fileInfo = await fileCheckResponse.json()
    const contractsFolderId = fileInfo.parents?.[0]
    console.log('File Google Docs trovato:', fileInfo.mimeType, fileInfo.name)

    // 4. Esporta il Google Docs come PDF (cattura tutte le modifiche fatte in Docs)
    // Il file è già Google Docs nativo (convertito durante la generazione), quindi esportiamo direttamente
    console.log('Esportazione PDF dal Google Docs...')

    // Attendi che eventuali modifiche siano processate
    await new Promise(resolve => setTimeout(resolve, 2000))

    const exportResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${contratto.contract_word_id}/export?mimeType=application/pdf`,
      { headers: { 'Authorization': `Bearer ${googleAccessToken}` } }
    )

    if (!exportResponse.ok) {
      const errorText = await exportResponse.text()
      console.error('Errore export PDF:', errorText)
      return Response.json({
        success: false,
        message: `Conversione PDF fallita: ${exportResponse.status} ${exportResponse.statusText}`
      }, { status: 500 })
    }

    const pdfBuffer = await exportResponse.arrayBuffer()
    console.log('PDF esportato:', pdfBuffer.byteLength, 'bytes')

    // 5. Recupera nome cliente per il nome file PDF
    const { data: cliente } = await supabase
      .from('scadenze_bandi_clienti')
      .select('denominazione')
      .eq('id', contratto.cliente_id)
      .single()

    const clienteName = cliente?.denominazione?.replace(/[^a-zA-Z0-9]/g, '_') || 'Cliente'
    const pdfFileName = `Contratto_Evolvi_APPROVATO_${clienteName}_${contratto.numero_contratto || contrattoId}_${new Date().toISOString().split('T')[0]}.pdf`

    // 6. Carica PDF nella stessa cartella del contratto Word
    const pdfUploadResult = await uploadFileToFolder(
      googleAccessToken,
      contractsFolderId,
      pdfFileName,
      Buffer.from(pdfBuffer),
      'application/pdf'
    )

    console.log('PDF caricato su Drive:', pdfUploadResult.id)

    // 7. Aggiorna stato a 'approvato' e salva riferimenti PDF
    const { data, error: updateError } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .update({
        stato: 'approvato',
        approvato_da: approvatoDa || 'system',
        approvato_il: new Date().toISOString(),
        contract_pdf_id: pdfUploadResult.id,
        contract_pdf_url: pdfUploadResult.webViewLink
      })
      .eq('id', contrattoId)
      .select()
      .single()

    if (updateError) throw updateError

    console.log('Contratto Evolvi approvato con PDF:', contrattoId)

    return Response.json({
      success: true,
      message: `Contratto "${contratto.numero_contratto || contrattoId}" approvato con successo. PDF generato.`,
      data: {
        ...data,
        pdfId: pdfUploadResult.id,
        pdfUrl: pdfUploadResult.webViewLink
      }
    })

  } catch (error: any) {
    console.error('Errore approvazione contratto Evolvi:', error)
    return Response.json({
      success: false,
      message: 'Errore durante approvazione contratto Evolvi',
      error: error.message
    }, { status: 500 })
  }
}
