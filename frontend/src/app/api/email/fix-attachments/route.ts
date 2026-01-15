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
 * POST /api/email/fix-attachments - Ricaricola lo stato allegati per tutti i messaggi dell'utente
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(req)

    console.log(`🔧 Fix allegati richiesto per utente: ${userId}`)

    // Ottieni tutti i messaggi dell'utente
    const { data: messages, error: messagesError } = await supabase
      .from('scadenze_bandi_email_messages')
      .select(`
        *,
        scadenze_bandi_email_folders!inner(
          account_id,
          scadenze_bandi_email_accounts!inner(user_id)
        )
      `)
      .eq('scadenze_bandi_email_folders.scadenze_bandi_email_accounts.user_id', userId)

    if (messagesError) {
      console.error('Errore recupero messaggi:', messagesError)
      return Response.json({
        success: false,
        message: 'Errore recupero messaggi'
      }, { status: 500 })
    }

    console.log(`🔧 Trovati ${messages?.length || 0} messaggi da controllare`)

    // Importa ImapService per usare la logica di controllo allegati
    const { ImapService } = await import('@/lib/email/imapService')

    let fixedCount = 0
    let errors = 0

    for (const message of messages || []) {
      try {
        // Usa la logica IMAP per controllare se ha davvero allegati
        // Per ora impostiamo has_attachments = false per tutti i messaggi che non hanno disposition=attachment esplicita

        // Logica semplificata: se il messaggio ha "has_attachments = true" ma nessun record
        // nella tabella allegati, probabilmente è un falso positivo
        const { data: attachments } = await supabase
          .from('scadenze_bandi_email_attachments')
          .select('id')
          .eq('message_id', message.id)

        const reallyHasAttachments = attachments && attachments.length > 0

        if (message.has_attachments !== reallyHasAttachments) {
          const { error: updateError } = await supabase
            .from('scadenze_bandi_email_messages')
            .update({ has_attachments: reallyHasAttachments })
            .eq('id', message.id)

          if (updateError) {
            console.error(`Errore aggiornamento messaggio ${message.id}:`, updateError)
            errors++
          } else {
            fixedCount++
            console.log(`📎 Fix messaggio ${message.id}: ${message.has_attachments} -> ${reallyHasAttachments}`)
          }
        }

      } catch (error) {
        console.error(`Errore elaborazione messaggio ${message.id}:`, error)
        errors++
      }
    }

    console.log(`🔧 Fix completato: ${fixedCount} corretti, ${errors} errori`)

    return Response.json({
      success: true,
      data: {
        total_messages: messages?.length || 0,
        fixed_count: fixedCount,
        errors_count: errors
      }
    })

  } catch (error: any) {
    console.error('Errore fix allegati:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore fix allegati'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}