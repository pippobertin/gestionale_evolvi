import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { uploadFileToFolder } from '@/lib/googleDrive'
import { gmail_v1, google } from 'googleapis'

export async function POST(req: NextRequest) {
  try {
    const { progettoId, contractId, contractUrl, customMessage } = await req.json()

    if (!progettoId || !contractId || !contractUrl) {
      return Response.json({
        message: 'ID progetto, ID contratto e URL contratto richiesti'
      }, { status: 400 })
    }

    console.log('🔄 Approvazione contratto:', contractId)

    // 1. Ottieni token Google Drive
    const googleAccessToken = await getValidGoogleToken()
    if (!googleAccessToken) {
      return Response.json({
        success: false,
        message: 'Google Drive non configurato'
      }, { status: 401 })
    }

    // 2. Strategia semplice: Scarica Word, carica come Google Docs con conversione, poi esporta PDF
    console.log('📄 Conversione Word → PDF via Google Docs')

    // Verifica che il file sia disponibile
    const fileCheckResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${contractId}?fields=mimeType,name,parents&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`
      }
    })

    if (!fileCheckResponse.ok) {
      console.error('❌ Errore controllo file:', fileCheckResponse.status, fileCheckResponse.statusText)
      return Response.json({
        success: false,
        message: 'File contratto non trovato'
      }, { status: 404 })
    }

    const fileInfo = await fileCheckResponse.json()
    console.log('📄 Contratto Word trovato:', fileInfo.mimeType, fileInfo.name)
    const contractsFolderId = fileInfo.parents?.[0]

    // 1. Scarica il file Word
    const downloadResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${contractId}?alt=media&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`
      }
    })

    if (!downloadResponse.ok) {
      return Response.json({
        success: false,
        message: `Impossibile scaricare il contratto: ${downloadResponse.status} ${downloadResponse.statusText}`
      }, { status: 500 })
    }

    const wordBuffer = await downloadResponse.arrayBuffer()
    console.log('✅ File Word scaricato:', wordBuffer.byteLength, 'bytes')

    // 2. Upload nel Drive Condiviso seguendo suggerimenti Gemini
    const tempDocsName = `TEMP_${fileInfo.name.replace(/\.docx$/, '')}_${Date.now()}`

    // CORREZIONE GEMINI: Usa Shared Drive con supportsAllDrives
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&convert=true&supportsAllDrives=true&keepRevisionForever=false`

    const boundary = '-------314159265358979323846'
    const delimiter = "\r\n--" + boundary + "\r\n"
    const close_delim = "\r\n--" + boundary + "--"

    // CORREZIONE GEMINI: Aggiungi parents per evitare quota 0
    const metadata = JSON.stringify({
      name: tempDocsName,
      mimeType: 'application/vnd.google-apps.document',
      parents: [contractsFolderId] // Forza creazione nel Drive Condiviso
    })

    // CORREZIONE GEMINI: Content-Type specifico per metadati
    const metadataPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata

    const filePart = delimiter +
      'Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n'

    // CORREZIONE GEMINI: Buffer diretto senza base64
    const requestBody = Buffer.concat([
      Buffer.from(metadataPart, 'utf8'),
      Buffer.from(filePart, 'utf8'),
      Buffer.from(wordBuffer), // Buffer diretto dal download
      Buffer.from(close_delim, 'utf8')
    ])

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`
      },
      body: requestBody
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error('❌ Errore conversione Google Docs:', errorText)
      return Response.json({
        success: false,
        message: `Errore conversione: ${uploadResponse.status} ${uploadResponse.statusText}`
      }, { status: 500 })
    }

    const docsFile = await uploadResponse.json()
    console.log('✅ Google Docs creato nel Drive Condiviso:', docsFile.id)

    // 3. Export PDF usando ID noto (non serve supportsAllDrives)
    await new Promise(resolve => setTimeout(resolve, 2000))

    // CORREZIONE GEMINI: Export diretto con fileId noto
    const exportResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${docsFile.id}/export?mimeType=application/pdf`, {
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`
      }
    })

    let pdfBuffer: ArrayBuffer | null = null

    if (exportResponse.ok) {
      pdfBuffer = await exportResponse.arrayBuffer()
      console.log('✅ PDF esportato dal Drive Condiviso:', pdfBuffer.byteLength, 'bytes')
    } else {
      const errorText = await exportResponse.text()
      console.error('❌ Export PDF fallito:', errorText)
      console.log('💡 Verifica che il Service Account abbia ruolo "Content Manager" sul Drive Condiviso')
    }

    // 4. Cleanup file temporaneo con supportsAllDrives
    await fetch(`https://www.googleapis.com/drive/v3/files/${docsFile.id}?supportsAllDrives=true`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`
      }
    })
    console.log('🗑️ File temporaneo eliminato dal Drive Condiviso')

    if (!pdfBuffer) {
      return Response.json({
        success: false,
        message: 'Conversione PDF fallita'
      }, { status: 500 })
    }

    // 4. Recupera dati progetto per email (query separate per evitare problemi di relazioni)
    const { data: baseProgetto, error: projectError } = await supabase
      .from('scadenze_bandi_progetti')
      .select('*')
      .eq('id', progettoId)
      .single()

    if (projectError || !baseProgetto) {
      return Response.json({
        success: false,
        message: 'Progetto non trovato'
      }, { status: 404 })
    }

    // Recupera dati cliente
    const { data: clienteData, error: clienteError } = await supabase
      .from('scadenze_bandi_clienti')
      .select('denominazione, email, pec')
      .eq('id', baseProgetto.cliente_id)
      .single()

    // Recupera dati bando
    const { data: bandoData, error: bandoError } = await supabase
      .from('scadenze_bandi_bandi')
      .select('nome, ente_erogatore')
      .eq('id', baseProgetto.bando_id)
      .single()

    if (clienteError || bandoError) {
      return Response.json({
        success: false,
        message: 'Errore recupero dati cliente/bando'
      }, { status: 404 })
    }

    // Componi oggetto progetto
    const progetto = {
      ...baseProgetto,
      scadenze_bandi_clienti: clienteData,
      scadenze_bandi_bandi: bandoData
    }


    // 3. Carica PDF APPROVATO nella cartella CONTRATTI
    const pdfFileName = `Contratto_APPROVATO_${progetto.scadenze_bandi_clienti.denominazione.replace(/[^a-zA-Z0-9]/g, '_')}_${progetto.codice_progetto}_${new Date().toISOString().split('T')[0]}.pdf`

    const pdfUploadResult = await uploadFileToFolder(
      googleAccessToken,
      contractsFolderId,
      pdfFileName,
      Buffer.from(pdfBuffer),
      'application/pdf'
    )

    // 4. Invia PDF via email (TEMPORANEAMENTE DISABILITATO per test)
    const clientEmail = progetto.scadenze_bandi_clienti.email || progetto.scadenze_bandi_clienti.pec || 'test@example.com'

    // TEMPORANEO: Skip controllo email per test PDF
    /* if (!clientEmail) {
      return Response.json({
        success: false,
        message: 'Email/PEC del cliente non configurata'
      }, { status: 400 })
    } */

    const emailData = {
      clientEmail,
      clientName: progetto.scadenze_bandi_clienti.denominazione,
      projectTitle: progetto.titolo_progetto,
      contractUrl: pdfUploadResult.webViewLink,
      bandoName: progetto.scadenze_bandi_bandi.nome
    }

    const emailResult = await sendContractEmailWithPdf(googleAccessToken, emailData, customMessage)

    if (!emailResult.success) {
      console.log('⚠️ PDF generato ma errore invio email:', emailResult.error)
      // Non bloccare il processo - PDF comunque generato
    }

    // 5. Aggiorna stato contratto nel database per eliminare alert "modifiche non salvate"
    try {
      const { error: updateError } = await supabase
        .from('scadenze_bandi_documenti_progetto')
        .update({
          has_changes: false,
          last_checked: new Date().toISOString()
        })
        .eq('google_drive_id', contractId)
        .eq('progetto_id', progettoId)

      if (updateError) {
        console.log('⚠️ Errore aggiornamento stato contratto:', updateError.message)
      } else {
        console.log('✅ Stato contratto aggiornato - alert rimosso')
      }
    } catch (dbError) {
      console.log('⚠️ Errore database aggiornamento contratto:', dbError)
    }

    return Response.json({
      success: true,
      message: 'Contratto approvato e PDF generato con successo',
      data: {
        pdfFileName,
        pdfId: pdfUploadResult.id,
        pdfUrl: pdfUploadResult.webViewLink,
        emailSent: emailResult.success,
        emailError: emailResult.error
      }
    })

  } catch (error: any) {
    console.error('Errore approvazione contratto:', error)
    return Response.json({
      success: false,
      message: 'Errore durante approvazione contratto',
      error: error.message
    }, { status: 500 })
  }
}


// Invia email con contratto PDF
async function sendContractEmailWithPdf(
  accessToken: string,
  emailData: any,
  customMessage?: string
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  try {
    // Crea client Gmail
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: 'v1', auth })

    // Template email per PDF approvato
    const subject = `Contratto di consulenza APPROVATO - Progetto: ${emailData.projectTitle}`

    const defaultMessage = `
Gentile ${emailData.clientName},

siamo lieti di inviarvi il contratto di consulenza APPROVATO per il progetto:

**${emailData.projectTitle}**
Bando di riferimento: ${emailData.bandoName}

Il contratto finale in formato PDF è disponibile al seguente link:
${emailData.contractUrl}

Vi preghiamo di:
1. Scaricare il contratto PDF
2. Firmare il documento
3. Restituirci una copia firmata via email

Per qualsiasi chiarimento, non esitate a contattarci.

Cordiali saluti,
Team BLM Project Srl
Email: info@blmproject.com
`

    const emailBody = customMessage || defaultMessage

    // Crea email in formato RFC 2822
    const emailContent = [
      `To: ${emailData.clientEmail}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=\"UTF-8\"`,
      '',
      emailBody
    ].join('\n')

    // Codifica in base64
    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Invia email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    })

    console.log('✅ Email contratto PDF inviata:', response.data.id)

    return {
      success: true,
      emailId: response.data.id ?? undefined
    }

  } catch (error: any) {
    console.error('❌ Errore invio email Gmail:', error)
    return {
      success: false,
      error: error.message
    }
  }
}