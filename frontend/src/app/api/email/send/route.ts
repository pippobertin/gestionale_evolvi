import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import * as nodemailer from 'nodemailer'

const JWT_SECRET = process.env.JWT_SECRET!

// Service role client per bypassare RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Helper per verificare autenticazione
async function getAuthenticatedUser(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Token mancante')
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }

    return decoded.userId
  } catch (error) {
    throw new Error('Non autorizzato')
  }
}

/**
 * POST /api/email/send - Invia una nuova email
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(req)

    // Gestisci sia FormData (con allegati) che JSON (senza allegati)
    const contentType = req.headers.get('content-type')
    let account_id: string
    let to: string[]
    let cc: string[]
    let subject: string
    let emailBody: string
    let reply_to_message_id: string | undefined
    let attachments: File[] = []

    if (contentType?.includes('multipart/form-data')) {
      // FormData con allegati
      const formData = await req.formData()

      account_id = formData.get('account_id') as string
      to = JSON.parse(formData.get('to') as string)
      cc = JSON.parse(formData.get('cc') as string || '[]')
      subject = formData.get('subject') as string
      emailBody = formData.get('body') as string
      reply_to_message_id = formData.get('reply_to_message_id') as string | undefined

      // Estrai allegati
      const attachmentFiles = formData.getAll('attachments') as File[]
      attachments = attachmentFiles.filter(file => file.size > 0)
    } else {
      // JSON senza allegati (backward compatibility)
      const body = await req.json()
      account_id = body.account_id
      to = body.to
      cc = body.cc || []
      subject = body.subject
      emailBody = body.body
      reply_to_message_id = body.reply_to_message_id
    }

    console.log(`📧 Invio email richiesto per account: ${account_id}`)

    if (!account_id || !to || to.length === 0 || !subject) {
      return Response.json({
        success: false,
        message: 'Account, destinatari e oggetto sono obbligatori'
      }, { status: 400 })
    }

    // Ottieni l'account email
    const { data: account, error: accountError } = await supabase
      .from('scadenze_bandi_email_accounts')
      .select('*')
      .eq('id', account_id)
      .eq('user_id', userId)
      .single()

    if (accountError || !account) {
      console.error('Errore recupero account:', accountError)
      return Response.json({
        success: false,
        message: 'Account non trovato'
      }, { status: 404 })
    }

    // Debug password fields
    console.log(`📧 Password fields disponibili per ${account.email_address}:`, {
      has_smtp_password: !!account.smtp_password,
      has_imap_password: !!account.imap_password,
      has_password: !!account.password,
      has_encrypted_password: !!account.encrypted_password,
      has_username: !!account.username,
      provider_type: account.provider_type
    })

    // Configurazione SMTP basata sul provider
    let smtpConfig: any

    switch (account.provider_type) {
      case 'aruba':
        smtpConfig = {
          host: account.smtp_host || 'smtps.aruba.it',
          port: parseInt(account.smtp_port) || 465,
          secure: true,
          auth: {
            user: account.username || account.email_address,
            pass: account.encrypted_password || account.smtp_password || account.imap_password || account.password
          }
        }
        break

      case 'gmail':
        smtpConfig = {
          service: 'gmail',
          auth: {
            user: account.username || account.email_address,
            pass: account.encrypted_password || account.smtp_password || account.imap_password || account.password
          }
        }
        break

      case 'outlook':
        smtpConfig = {
          host: 'smtp-mail.outlook.com',
          port: 587,
          secure: false,
          auth: {
            user: account.username || account.email_address,
            pass: account.encrypted_password || account.smtp_password || account.imap_password || account.password
          },
          tls: {
            ciphers: 'SSLv3'
          }
        }
        break

      default:
        // Provider personalizzato
        smtpConfig = {
          host: account.smtp_host,
          port: parseInt(account.smtp_port) || 587,
          secure: parseInt(account.smtp_port) === 465,
          auth: {
            user: account.username || account.email_address,
            pass: account.encrypted_password || account.smtp_password || account.imap_password || account.password
          }
        }
    }

    // Verifica che abbiamo le credenziali necessarie
    if (!smtpConfig.auth?.pass) {
      console.error('📧 SMTP password mancante per account:', account.email_address)
      return Response.json({
        success: false,
        message: 'Password SMTP non configurata per questo account'
      }, { status: 400 })
    }

    console.log(`📧 Configurazione SMTP per ${account.provider_type}:`, {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: smtpConfig.auth?.user,
      hasPassword: !!smtpConfig.auth?.pass
    })

    // Crea transporter
    const transporter = nodemailer.createTransport(smtpConfig)

    // Verifica connessione SMTP
    try {
      await transporter.verify()
      console.log('📧 Connessione SMTP verificata con successo')
    } catch (verifyError) {
      console.error('📧 Errore verifica SMTP:', verifyError)
      return Response.json({
        success: false,
        message: 'Errore configurazione SMTP'
      }, { status: 500 })
    }

    // Prepara allegati se presenti
    const mailAttachments = []
    for (const file of attachments) {
      const buffer = Buffer.from(await file.arrayBuffer())

      // Debug: verifica dimensione del file
      console.log(`📎 Processing attachment: ${file.name}, size: ${file.size} bytes, buffer size: ${buffer.length}`)

      // Usa Buffer direttamente - nodemailer gestisce la codifica automaticamente
      mailAttachments.push({
        filename: file.name,
        content: buffer,
        contentType: file.type
        // Rimuoviamo encoding: nodemailer auto-gestisce
      })
    }

    // Prepara opzioni email
    const mailOptions = {
      from: {
        name: account.name,
        address: account.email_address
      },
      to: Array.isArray(to) ? to : [to],
      cc: cc.length > 0 ? cc : undefined,
      subject: subject,
      text: emailBody,
      html: emailBody.replace(/\n/g, '<br>'), // Conversione base testo -> HTML
      attachments: mailAttachments.length > 0 ? mailAttachments : undefined,
      inReplyTo: reply_to_message_id || undefined,
      references: reply_to_message_id || undefined
    }

    console.log('📧 Invio email:', {
      from: mailOptions.from,
      to: mailOptions.to,
      cc: mailOptions.cc,
      subject: mailOptions.subject,
      attachments: mailAttachments.length,
      attachmentNames: mailAttachments.map(att => att.filename),
      attachmentDetails: mailAttachments.map(att => ({
        name: att.filename,
        size: att.content.length,
        type: att.contentType,
        encoding: att.encoding
      }))
    })

    // Invia email
    const info = await transporter.sendMail(mailOptions)

    console.log('📧 Email inviata con successo:', {
      messageId: info.messageId,
      response: info.response
    })

    // Salva copia nella cartella "Sent" se disponibile
    try {
      const { data: sentFolder } = await supabase
        .from('scadenze_bandi_email_folders')
        .select('*')
        .eq('account_id', account.id)
        .or('folder_type.eq.SENT,name.ilike.%sent%,name.ilike.%inviata%')
        .single()

      if (sentFolder) {
        // Salva il messaggio inviato nel database
        const { error: messageError } = await supabase
          .from('scadenze_bandi_email_messages')
          .insert({
            account_id: account.id,
            folder_id: sentFolder.id,
            message_id: info.messageId,
            uid: null, // Non applicabile per messaggi inviati via SMTP
            subject: subject,
            from_address: account.email_address,
            from_name: account.name,
            to_addresses: mailOptions.to,
            cc_addresses: mailOptions.cc || [],
            body_text: emailBody,
            body_html: mailOptions.html,
            body_preview: emailBody.substring(0, 200),
            date_sent: new Date(),
            date_received: new Date(),
            is_read: true, // I messaggi inviati sono sempre "letti"
            is_flagged: false,
            has_attachments: mailAttachments.length > 0,
            size_bytes: Buffer.byteLength(emailBody, 'utf8')
          })

        if (!messageError) {
          console.log('📧 Messaggio salvato nella cartella Sent')
        }
      }
    } catch (error) {
      console.warn('📧 Impossibile salvare nella cartella Sent:', error)
      // Non blocchiamo l'invio se non riusciamo a salvare
    }

    return Response.json({
      success: true,
      data: {
        messageId: info.messageId,
        response: info.response
      }
    })

  } catch (error: any) {
    console.error('Errore invio email:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore invio email'
    }, { status: 500 })
  }
}