import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

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
 * GET /api/email/message/[messageId] - Ottieni contenuto completo di un messaggio
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const userId = await getAuthenticatedUser(req)

    // Resolve params se è una Promise (Next.js 15+)
    const resolvedParams = await Promise.resolve(params)
    const messageId = resolvedParams.messageId

    console.log(`📧 DEBUG: messageId ricevuto:`, messageId, typeof messageId)

    if (!messageId) {
      console.error(`❌ ID messaggio mancante. params:`, resolvedParams)
      return Response.json({
        success: false,
        message: 'ID messaggio obbligatorio'
      }, { status: 400 })
    }

    console.log(`📧 Recupero messaggio completo: ${messageId}`)

    // Ottieni messaggio completo con verifica proprietà
    const { data: message, error } = await supabase
      .from('scadenze_bandi_email_messages')
      .select(`
        *,
        scadenze_bandi_email_folders!inner(
          account_id,
          scadenze_bandi_email_accounts!inner(user_id)
        )
      `)
      .eq('id', messageId)
      .single()

    if (error || !message) {
      console.error('Errore recupero messaggio:', error)
      return Response.json({
        success: false,
        message: 'Messaggio non trovato'
      }, { status: 404 })
    }

    // Verifica che il messaggio appartenga all'utente
    if (message.scadenze_bandi_email_folders.scadenze_bandi_email_accounts.user_id !== userId) {
      return Response.json({
        success: false,
        message: 'Non autorizzato'
      }, { status: 403 })
    }

    // Pulisci il contenuto HTML per la visualizzazione
    const cleanHtml = (html: string) => {
      if (!html) return ''

      // Rimuovi script e style tags
      let cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

      // Mantieni formattazione base
      return cleaned
    }

    // Helper per decodificare Buffer se necessario
    const decodeBuffer = (content: any) => {
      if (!content) return null
      if (typeof content === 'string') return content
      if (content && typeof content === 'object' && content.type === 'Buffer' && content.data) {
        return Buffer.from(content.data).toString('utf8')
      }
      return content?.toString() || null
    }

    // Decodifica i contenuti
    const bodyText = decodeBuffer(message.body_text)
    const bodyHtml = decodeBuffer(message.body_html)

    console.log(`📧 Decodifica completata per messaggio ${messageId}:`, {
      bodyText: bodyText ? 'presente' : 'vuoto',
      bodyHtml: bodyHtml ? 'presente' : 'vuoto'
    })

    // Estrai allegati se presenti
    let attachments: any[] = []
    if (message.has_attachments) {
      try {
        console.log(`📎 Estrazione allegati REALE per messaggio ${messageId}`)

        // Trova l'account email associato al messaggio
        const { data: accountData } = await supabase
          .from('scadenze_bandi_email_accounts')
          .select('*')
          .eq('id', message.scadenze_bandi_email_folders.account_id)
          .single()

        if (!accountData) {
          throw new Error('Account email non trovato')
        }

        // Trova la cartella associata
        const { data: folderData } = await supabase
          .from('scadenze_bandi_email_folders')
          .select('*')
          .eq('id', message.folder_id)
          .single()

        if (!folderData) {
          throw new Error('Cartella email non trovata')
        }

        // Importa e usa ImapService per estrarre allegati
        const { ImapService } = await import('@/lib/email/imapService')
        const imapService = new ImapService(accountData)

        await imapService.connect()
        attachments = await imapService.extractAttachments(message.uid.toString(), folderData.full_path)
        await imapService.disconnect()

        console.log(`📎 Estratti ${attachments.length} allegati reali`)

      } catch (error: any) {
        console.error('📎 Errore estrazione allegati reale:', error)
        // Fallback a lista vuota se fallisce
        attachments = []
      }
    }

    const responseData = {
      id: message.id,
      message_id: message.message_id,
      subject: message.subject,
      from_address: message.from_address,
      from_name: message.from_name,
      to_addresses: message.to_addresses,
      cc_addresses: message.cc_addresses,
      body_text: bodyText,
      body_html: bodyHtml ? cleanHtml(bodyHtml) : null,
      body_preview: message.body_preview,
      date_sent: message.date_sent,
      date_received: message.date_received,
      is_read: message.is_read,
      is_flagged: message.is_flagged,
      has_attachments: message.has_attachments,
      size_bytes: message.size_bytes,
      attachments: attachments
    }

    return Response.json({
      success: true,
      data: responseData
    })

  } catch (error: any) {
    console.error('Errore GET message detail:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore recupero messaggio'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}

/**
 * DELETE /api/email/message/[messageId] - Elimina un messaggio email
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const userId = await getAuthenticatedUser(req)

    // Resolve params se è una Promise (Next.js 15+)
    const resolvedParams = await Promise.resolve(params)
    const messageId = resolvedParams.messageId

    console.log(`🗑️ Eliminazione messaggio richiesta: ${messageId}`)

    if (!messageId) {
      return Response.json({
        success: false,
        message: 'ID messaggio obbligatorio'
      }, { status: 400 })
    }

    // Verifica che il messaggio appartenga a un account dell'utente
    const { data: message, error: checkError } = await supabase
      .from('scadenze_bandi_email_messages')
      .select('id, account_id, scadenze_bandi_email_accounts!inner(user_id)')
      .eq('id', messageId)
      .single()

    if (checkError || !message) {
      console.error('Messaggio non trovato:', checkError)
      return Response.json({
        success: false,
        message: 'Messaggio non trovato'
      }, { status: 404 })
    }

    // Verifica ownership tramite l'account
    const accountUserId = (message as any).scadenze_bandi_email_accounts?.user_id
    if (accountUserId !== userId) {
      return Response.json({
        success: false,
        message: 'Non autorizzato'
      }, { status: 403 })
    }

    // Elimina allegati associati (a cascata dovrebbe farlo automaticamente il DB)
    const { error: attachmentsError } = await supabase
      .from('scadenze_bandi_email_attachments')
      .delete()
      .eq('message_id', messageId)

    if (attachmentsError) {
      console.warn('Errore eliminazione allegati:', attachmentsError)
      // Non blocchiamo l'eliminazione del messaggio per questo
    }

    // Elimina il messaggio
    const { error: deleteError } = await supabase
      .from('scadenze_bandi_email_messages')
      .delete()
      .eq('id', messageId)

    if (deleteError) {
      console.error('Errore eliminazione messaggio:', deleteError)
      return Response.json({
        success: false,
        message: 'Errore eliminazione messaggio'
      }, { status: 500 })
    }

    console.log(`🗑️ Messaggio eliminato con successo: ${messageId}`)

    return Response.json({
      success: true,
      message: 'Messaggio eliminato con successo'
    })

  } catch (error: any) {
    console.error('Errore eliminazione messaggio:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore eliminazione messaggio'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}