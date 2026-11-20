import { NextRequest, NextResponse } from 'next/server'
import { getGmailClient } from '@/lib/gmail'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function escapeHtml(testo: string) {
  return testo
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function htmlInTesto(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Contenuto in base64 a righe di 76 caratteri (RFC 2045) */
function base64ARighe(testo: string) {
  return (Buffer.from(testo, 'utf-8').toString('base64').match(/.{1,76}/g) || []).join('\r\n')
}

/** Oggetto codificato (RFC 2047): le lettere accentate arrivano intatte */
function codificaOggetto(oggetto: string) {
  return /^[\x20-\x7E]*$/.test(oggetto) ? oggetto : `=?UTF-8?B?${Buffer.from(oggetto, 'utf-8').toString('base64')}?=`
}

/**
 * Parte multipart/alternative con testo semplice e HTML. La firma impostata
 * dall'utente (Impostazioni → Le Mie API Google) è aggiunta in fondo.
 */
function parteTestoConFirma(corpo: string, firmaHtml: string | null) {
  const alt = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const testo = (corpo || '') + (firmaHtml ? '\r\n\r\n-- \r\n' + htmlInTesto(firmaHtml) : '')
  const html =
    `<div style="font-family: Arial, sans-serif; font-size: 14px;">${escapeHtml(corpo || '').replace(/\r?\n/g, '<br>')}</div>` +
    (firmaHtml ? `<br><br>${firmaHtml}` : '')
  return [
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    `--${alt}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64ARighe(testo),
    `--${alt}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64ARighe(html),
    `--${alt}--`,
    ''
  ].join('\r\n')
}

export async function POST(request: NextRequest) {
  try {
    // Get logged-in user ID
    const decoded = await verifyJWT(request)
    const userId = decoded?.userId

    const contentType = request.headers.get('content-type')
    let to: string = ''
    let cc: string = ''
    let bcc: string = ''
    let subject: string = ''
    let emailBody: string = ''
    let replyTo: any = null
    let attachments: File[] = []

    // Check if request contains FormData (with files) or JSON
    if (contentType?.includes('multipart/form-data')) {
      // Parse FormData for emails with attachments
      const formData = await request.formData()

      to = formData.get('to') as string
      cc = formData.get('cc') as string || ''
      bcc = formData.get('bcc') as string || ''
      subject = formData.get('subject') as string
      emailBody = formData.get('body') as string
      replyTo = formData.get('replyTo') ? JSON.parse(formData.get('replyTo') as string) : null

      // Get attachments
      const attachmentFiles = formData.getAll('attachments') as File[]
      attachments = attachmentFiles.filter(file => file.size > 0)

      console.log('📧 Email send request (FormData):', {
        to, cc, bcc, subject,
        emailBody: emailBody?.substring(0, 100) + '...',
        bodyLength: emailBody?.length,
        attachmentCount: attachments.length,
        attachmentNames: attachments.map(f => f.name)
      })
    } else {
      // Parse JSON for simple emails without attachments
      const requestData = await request.json()
      to = requestData.to || ''
      cc = requestData.cc || ''
      bcc = requestData.bcc || ''
      subject = requestData.subject || ''
      emailBody = requestData.body || ''
      replyTo = requestData.replyTo || null

      console.log('📧 Email send request (JSON):', { to, cc, bcc, subject, emailBody: emailBody?.substring(0, 100) + '...', bodyLength: emailBody?.length })
    }

    // Get Gmail client with user's tokens (or system fallback)
    const gmail = await getGmailClient(userId)

    // Firma dell'utente collegato (se impostata)
    let firmaHtml: string | null = null
    if (userId) {
      const { data: firma } = await supabaseAdmin
        .from('scadenze_bandi_utenti')
        .select('firma_email_html')
        .eq('id', userId)
        .single()
      firmaHtml = firma?.firma_email_html?.trim() || null
    }

    let emailMessage: string

    if (attachments.length > 0) {
      // Create multipart MIME message with attachments
      const boundary = `boundary_${Date.now()}_${Math.random().toString(36)}`

      const headerParts = [
        `To: ${to}`,
        cc ? `Cc: ${cc}` : '',
        bcc ? `Bcc: ${bcc}` : '',
        `Subject: ${codificaOggetto(subject)}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`
      ].filter(part => part !== '')

      // Start building multipart message
      let multipartBody = headerParts.join('\r\n') + '\r\n\r\n'

      // Testo e HTML (con firma)
      multipartBody += `--${boundary}\r\n`
      multipartBody += parteTestoConFirma(emailBody, firmaHtml) + '\r\n'

      // Add attachments
      for (const attachment of attachments) {
        const buffer = await attachment.arrayBuffer()
        const base64Content = Buffer.from(buffer).toString('base64')

        multipartBody += `--${boundary}\r\n`
        multipartBody += `Content-Type: ${attachment.type || 'application/octet-stream'}; name="${attachment.name}"\r\n`
        multipartBody += `Content-Disposition: attachment; filename="${attachment.name}"\r\n`
        multipartBody += 'Content-Transfer-Encoding: base64\r\n\r\n'

        // Add base64 content in 76-character lines (RFC requirement)
        const lines = base64Content.match(/.{1,76}/g) || []
        multipartBody += lines.join('\r\n') + '\r\n\r\n'
      }

      // Close boundary
      multipartBody += `--${boundary}--\r\n`

      emailMessage = multipartBody

      console.log('📧 Multipart email created:')
      console.log('Headers:', headerParts)
      console.log('Body length:', (emailBody || '').length)
      console.log('Attachments:', attachments.length)
      console.log('Boundary:', boundary)
    } else {
      // Email senza allegati: testo e HTML (con firma)
      const headerParts = [
        `To: ${to}`,
        cc ? `Cc: ${cc}` : '',
        bcc ? `Bcc: ${bcc}` : '',
        `Subject: ${codificaOggetto(subject)}`,
        'MIME-Version: 1.0'
      ].filter(part => part !== '')

      emailMessage = headerParts.join('\r\n') + '\r\n' + parteTestoConFirma(emailBody, firmaHtml)

      console.log('📧 Simple text email created:')
      console.log('Headers:', headerParts)
      console.log('Body length:', (emailBody || '').length)
    }

    // Encode message
    const encodedMessage = Buffer.from(emailMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Prepare request body
    const requestBody: any = {
      raw: encodedMessage
    }

    // If it's a reply, add threading information
    if (replyTo) {
      requestBody.threadId = replyTo.threadId
    }

    // Send email
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody
    })

    // If it's a reply, mark original as read
    if (replyTo) {
      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id: replyTo.id,
          requestBody: {
            removeLabelIds: ['UNREAD']
          }
        })
      } catch (error) {
        console.warn('Could not mark original message as read:', error)
      }
    }

    return NextResponse.json({
      success: true,
      messageId: result.data.id,
      message: 'Email inviata con successo'
    })

  } catch (error: any) {
    console.error('Error sending Gmail:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante l\'invio dell\'email'
    }, { status: 500 })
  }
}