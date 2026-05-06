import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { uploadFileToFolder } from '@/lib/googleDrive'
import { verifyJWT } from '@/lib/jwtAuth'
import { getGmailClient } from '@/lib/gmail'

function buildProjectHtmlBody(
  denominazione: string,
  nomeProgetto: string,
  nomeBando: string,
  importoConsulenza: string,
  hasPdf: boolean,
  firmaHtml?: string | null
): string {
  const dataOggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:30px 40px;text-align:center;">
  <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;letter-spacing:1px;">BLM Project</h1>
  <p style="color:#ccfbf1;margin:8px 0 0;font-size:14px;">Contratto di Consulenza</p>
</td>
</tr>

<!-- Body -->
<tr>
<td style="padding:35px 40px;">
  <p style="font-size:16px;color:#1f2937;margin:0 0 20px;">
    Spettabile <strong>${denominazione}</strong>,
  </p>
  <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 25px;">
    siamo lieti di inviarVi il contratto di consulenza per il progetto indicato di seguito.
  </p>

  <!-- Dettagli contratto -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #0d9488;border-radius:8px;overflow:hidden;margin:0 0 25px;">
    <tr>
      <td style="background-color:#f0fdfa;padding:15px 20px;border-bottom:1px solid #ccfbf1;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#6b7280;width:40%;">Nome Progetto</td>
            <td style="font-size:15px;color:#0f766e;font-weight:700;">${nomeProgetto}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:15px 20px;border-bottom:1px solid #ccfbf1;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#6b7280;width:40%;">Bando di Riferimento</td>
            <td style="font-size:15px;color:#1f2937;font-weight:600;">${nomeBando}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color:#f0fdfa;padding:15px 20px;border-bottom:1px solid #ccfbf1;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#6b7280;width:40%;">Importo Consulenza</td>
            <td style="font-size:15px;color:#0f766e;font-weight:700;">&euro; ${importoConsulenza} + IVA</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:15px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#6b7280;width:40%;">Data</td>
            <td style="font-size:15px;color:#1f2937;font-weight:600;">${dataOggi}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  ${hasPdf ? `<p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px;">
    In allegato troverete il contratto in formato PDF.
  </p>` : ''}

  <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 8px;">Vi preghiamo di:</p>
  <ol style="font-size:15px;color:#374151;line-height:1.8;margin:0 0 25px;padding-left:20px;">
    <li>Verificare il contenuto del contratto</li>
    <li>Firmare il documento</li>
    <li>Restituirci una copia firmata via email</li>
  </ol>

  <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 30px;">
    Restiamo a disposizione per qualsiasi chiarimento.
  </p>

  <!-- Firma -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e5e7eb;padding-top:20px;">
    <tr>
      <td>
        <p style="font-size:15px;color:#1f2937;margin:0 0 10px;">Cordiali saluti,</p>
        ${firmaHtml || `<p style="font-size:14px;color:#0f766e;font-weight:700;margin:0 0 3px;">BLM Project Srl</p>
        <p style="font-size:12px;color:#6b7280;margin:0;line-height:1.5;">
          Tel. +39 0171 41 42 05 | info@blmproject.com<br/>
          www.blmproject.com
        </p>`}
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="background-color:#f9fafb;padding:15px 40px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="font-size:11px;color:#9ca3af;margin:0;">
    Questa email è stata inviata automaticamente dal Gestionale Evolvi.
  </p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

function buildMimeMessage(params: {
  from: string
  to: string
  subject: string
  htmlBody: string
  pdfBase64?: string
  pdfFilename?: string
}): string {
  const { from, to, subject, htmlBody, pdfBase64, pdfFilename } = params
  const subjectB64 = Buffer.from(subject, 'utf-8').toString('base64')
  const encodedSubject = `=?UTF-8?B?${subjectB64}?=`

  const htmlBase64 = Buffer.from(htmlBody, 'utf-8').toString('base64')

  if (pdfBase64 && pdfFilename) {
    const boundary = `BOUNDARY_MIXED_${Date.now()}`
    return [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      htmlBase64,
      '',
      `--${boundary}`,
      `Content-Type: application/pdf; name="${pdfFilename}"`,
      `Content-Disposition: attachment; filename="${pdfFilename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      pdfBase64,
      '',
      `--${boundary}--`,
    ].join('\r\n')
  }

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    htmlBase64,
  ].join('\r\n')
}

export async function POST(req: NextRequest) {
  try {
    const { progettoId, contractId, contractUrl, customMessage } = await req.json()

    if (!progettoId || !contractId || !contractUrl) {
      return Response.json({
        message: 'ID progetto, ID contratto e URL contratto richiesti'
      }, { status: 400 })
    }

    console.log('🔄 Approvazione contratto:', contractId)

    // 1. Verifica JWT e recupera dati utente
    const decoded = await verifyJWT(req)
    const userId = decoded?.userId

    const { data: utente } = await supabase
      .from('scadenze_bandi_utenti')
      .select('nome, cognome, gmail_email, email, firma_email_html')
      .eq('id', userId)
      .single()

    const senderName = utente ? `${utente.nome} ${utente.cognome} BLMProject` : 'BLMProject'
    const senderEmail = utente?.gmail_email || utente?.email || ''

    // 2. Ottieni token Google Drive (service account per operazioni Drive)
    const googleAccessToken = await getValidGoogleToken()
    if (!googleAccessToken) {
      return Response.json({
        success: false,
        message: 'Google Drive non configurato'
      }, { status: 401 })
    }

    // 3. Conversione Word → PDF via Google Docs
    console.log('📄 Conversione Word → PDF via Google Docs')

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

    // Scarica il file Word
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

    // Upload nel Drive Condiviso come Google Docs per conversione
    const tempDocsName = `TEMP_${fileInfo.name.replace(/\.docx$/, '')}_${Date.now()}`

    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&convert=true&supportsAllDrives=true&keepRevisionForever=false`

    const boundary = '-------314159265358979323846'
    const delimiter = "\r\n--" + boundary + "\r\n"
    const close_delim = "\r\n--" + boundary + "--"

    const metadata = JSON.stringify({
      name: tempDocsName,
      mimeType: 'application/vnd.google-apps.document',
      parents: [contractsFolderId]
    })

    const metadataPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata

    const filePart = delimiter +
      'Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n'

    const requestBody = Buffer.concat([
      Buffer.from(metadataPart, 'utf8'),
      Buffer.from(filePart, 'utf8'),
      Buffer.from(wordBuffer),
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

    // Export PDF
    await new Promise(resolve => setTimeout(resolve, 2000))

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
    }

    // Cleanup file temporaneo
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

    // 4. Recupera dati progetto per email
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

    const { data: clienteData, error: clienteError } = await supabase
      .from('scadenze_bandi_clienti')
      .select('denominazione, email, pec')
      .eq('id', baseProgetto.cliente_id)
      .single()

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

    const progetto = {
      ...baseProgetto,
      scadenze_bandi_clienti: clienteData,
      scadenze_bandi_bandi: bandoData
    }

    // 5. Carica PDF APPROVATO nella cartella CONTRATTI
    const pdfFileName = `Contratto_APPROVATO_${progetto.scadenze_bandi_clienti.denominazione.replace(/[^a-zA-Z0-9]/g, '_')}_${progetto.codice_progetto}_${new Date().toISOString().split('T')[0]}.pdf`

    const pdfUploadResult = await uploadFileToFolder(
      googleAccessToken,
      contractsFolderId,
      pdfFileName,
      Buffer.from(pdfBuffer),
      'application/pdf'
    )

    // 6. Invia email via Gmail OAuth utente
    const clientEmail = progetto.scadenze_bandi_clienti.email || progetto.scadenze_bandi_clienti.pec
    if (!clientEmail) {
      return Response.json({
        success: false,
        message: 'Email/PEC del cliente non configurata'
      }, { status: 400 })
    }

    // Ottieni Gmail client via OAuth utente
    let gmail
    try {
      gmail = await getGmailClient(userId)
    } catch (gmailAuthError: any) {
      console.error('Errore autenticazione Gmail:', gmailAuthError)
      return Response.json({
        success: false,
        message: `Errore autenticazione Gmail: ${gmailAuthError.message}. Verifica di aver collegato Gmail nelle impostazioni.`
      }, { status: 401 })
    }

    // Componi email HTML
    const importoFromContract = baseProgetto.importo_consulenza || ''
    const subject = `Contratto di consulenza - ${progetto.titolo_progetto} - ${progetto.scadenze_bandi_clienti.denominazione}`
    const fromHeader = senderEmail ? `"${senderName}" <${senderEmail}>` : senderName

    const htmlBody = customMessage || buildProjectHtmlBody(
      progetto.scadenze_bandi_clienti.denominazione,
      progetto.titolo_progetto,
      progetto.scadenze_bandi_bandi.nome,
      importoFromContract,
      true,
      utente?.firma_email_html
    )

    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')

    const rawMessage = buildMimeMessage({
      from: fromHeader,
      to: clientEmail,
      subject,
      htmlBody,
      pdfBase64,
      pdfFilename: pdfFileName,
    })

    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage }
    })

    console.log('✅ Email contratto progetto inviata:', response.data.id)

    // 7. Aggiorna stato contratto nel database
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

    // 8. Crea record di tracking
    try {
      await supabase.from('scadenze_bandi_contract_tracking').insert({
        entity_type: 'CONTRATTO_PROGETTO',
        entity_id: progettoId,
        cliente_id: baseProgetto.cliente_id,
        contract_document_url: pdfUploadResult.webViewLink,
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_sent_to: clientEmail,
        email_message_id: response.data.id || null,
        email_delivery_status: 'SENT',
        overall_status: 'SENT'
      })
      console.log('✅ Record tracking creato')
    } catch (trackingError) {
      console.warn('⚠️ Warning: tracking record non creato:', trackingError)
    }

    return Response.json({
      success: true,
      message: 'Contratto approvato e inviato con successo',
      data: {
        pdfFileName,
        pdfId: pdfUploadResult.id,
        pdfUrl: pdfUploadResult.webViewLink,
        emailSent: true,
        emailTo: clientEmail
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
