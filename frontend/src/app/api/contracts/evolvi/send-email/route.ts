import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getGmailClient } from '@/lib/gmail'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { verifyJWT } from '@/lib/jwtAuth'

function buildHtmlBody(
  denominazione: string,
  numeroContratto: string,
  dataInizio: string | null,
  dataFine: string | null,
  importoAnnuale: number | null,
  hasPdf: boolean,
  firmaHtml?: string | null
): string {
  const periodo = `dal ${dataInizio ? new Date(dataInizio).toLocaleDateString('it-IT') : 'N/A'} al ${dataFine ? new Date(dataFine).toLocaleDateString('it-IT') : 'N/A'}`
  const importo = importoAnnuale
    ? Number(importoAnnuale).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
    : 'N/A'

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
  <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;letter-spacing:1px;">Metodo Evolvi</h1>
  <p style="color:#ccfbf1;margin:8px 0 0;font-size:14px;">Contratto di Servizio</p>
</td>
</tr>

<!-- Body -->
<tr>
<td style="padding:35px 40px;">
  <p style="font-size:16px;color:#1f2937;margin:0 0 20px;">
    Spettabile <strong>${denominazione}</strong>,
  </p>
  <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 25px;">
    siamo lieti di inviarVi il contratto per il servizio <strong>Metodo Evolvi</strong>.
  </p>

  <!-- Dettagli contratto -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #0d9488;border-radius:8px;overflow:hidden;margin:0 0 25px;">
    <tr>
      <td style="background-color:#f0fdfa;padding:15px 20px;border-bottom:1px solid #ccfbf1;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#6b7280;width:40%;">Numero Contratto</td>
            <td style="font-size:15px;color:#0f766e;font-weight:700;">${numeroContratto}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:15px 20px;border-bottom:1px solid #ccfbf1;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#6b7280;width:40%;">Periodo</td>
            <td style="font-size:15px;color:#1f2937;font-weight:600;">${periodo}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color:#f0fdfa;padding:15px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#6b7280;width:40%;">Importo Annuale</td>
            <td style="font-size:15px;color:#0f766e;font-weight:700;">${importo}</td>
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

  // No attachment — simple HTML message
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
    const { contrattoId, customMessage } = await req.json()

    if (!contrattoId) {
      return Response.json({ message: 'ID contratto richiesto' }, { status: 400 })
    }

    // 1. Verifica JWT e recupera dati utente per il From
    const decoded = await verifyJWT(req)
    const userId = decoded?.userId

    const { data: utente } = await supabase
      .from('scadenze_bandi_utenti')
      .select('nome, cognome, gmail_email, email, firma_email_html')
      .eq('id', userId)
      .single()

    const senderName = utente ? `${utente.nome} ${utente.cognome} BLMProject` : 'BLMProject'
    const senderEmail = utente?.gmail_email || utente?.email || ''

    // 2. Recupera contratto
    const { data: contratto, error: contrattoError } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .select('*')
      .eq('id', contrattoId)
      .single()

    if (contrattoError || !contratto) {
      return Response.json({ message: 'Contratto non trovato' }, { status: 404 })
    }

    // 3. Recupera dati cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('scadenze_bandi_clienti')
      .select('denominazione, email, pec')
      .eq('id', contratto.cliente_id)
      .single()

    if (clienteError || !cliente) {
      return Response.json({ message: 'Cliente non trovato' }, { status: 404 })
    }

    // 4. Determina email destinazione
    const clientEmail = cliente.email || cliente.pec
    if (!clientEmail) {
      return Response.json({ message: 'Email/PEC del cliente non configurata' }, { status: 400 })
    }

    // 5. Scarica PDF da Google Drive se disponibile
    let pdfBase64: string | undefined
    let pdfFilename: string | undefined

    if (contratto.contract_pdf_id) {
      try {
        const token = await getValidGoogleToken()
        const pdfResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${contratto.contract_pdf_id}?alt=media`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
        if (pdfResponse.ok) {
          const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer())
          pdfBase64 = pdfBuffer.toString('base64')
          pdfFilename = `Contratto_Evolvi_${contratto.numero_contratto?.replace(/\//g, '-') || contrattoId}.pdf`
        } else {
          console.warn('Impossibile scaricare PDF da Drive, invio senza allegato:', pdfResponse.status)
        }
      } catch (pdfError) {
        console.warn('Errore download PDF da Drive, invio senza allegato:', pdfError)
      }
    }

    // 6. Ottieni client Gmail
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

    // 7. Componi email HTML
    const subject = `Contratto Metodo Evolvi - ${cliente.denominazione} - ${contratto.numero_contratto}`
    const fromHeader = senderEmail ? `${senderName} <${senderEmail}>` : senderName

    const htmlBody = customMessage || buildHtmlBody(
      cliente.denominazione,
      contratto.numero_contratto || '',
      contratto.data_inizio,
      contratto.data_fine,
      contratto.importo_annuale,
      !!pdfBase64,
      utente?.firma_email_html
    )

    const rawMessage = buildMimeMessage({
      from: fromHeader,
      to: clientEmail,
      subject,
      htmlBody,
      pdfBase64,
      pdfFilename,
    })

    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // 8. Invia email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage }
    })

    // 9. Aggiorna contratto
    await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .update({
        stato: 'inviato',
        inviato_a_email: clientEmail,
        inviato_il: new Date().toISOString()
      })
      .eq('id', contrattoId)

    // 10. Crea record di tracking
    try {
      await supabase.from('scadenze_bandi_contract_tracking').insert({
        entity_type: 'CONTRATTO_EVOLVI',
        entity_id: contrattoId,
        cliente_id: contratto.cliente_id,
        contract_document_url: contratto.contract_pdf_url || contratto.contract_word_url,
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_sent_to: clientEmail,
        email_message_id: response.data.id || null,
        email_delivery_status: 'SENT',
        overall_status: 'SENT'
      })
    } catch (trackingError) {
      console.warn('Warning: tracking record non creato:', trackingError)
    }

    return Response.json({
      success: true,
      message: `Email inviata con successo${pdfBase64 ? ' con PDF allegato' : ''}`,
      data: {
        emailId: response.data.id,
        recipient: clientEmail,
        pdfAttached: !!pdfBase64
      }
    })

  } catch (error: any) {
    console.error('Errore invio email contratto Evolvi:', error)
    return Response.json({
      success: false,
      message: `Errore durante invio email: ${error.message || 'errore sconosciuto'}`
    }, { status: 500 })
  }
}
