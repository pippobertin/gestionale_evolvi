import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * POST /api/email/reprocess-attachment - Force reprocess corrupted attachments
 */
export async function POST(req: NextRequest) {
  try {
    console.log('🔧 Riprocessamento allegati corrotti richiesto')

    // Trova e cancella allegati corrotti per l'email TEST NUOVO CLIENT
    const { data: messages, error: messagesError } = await supabase
      .from('scadenze_bandi_email_messages')
      .select('id, subject')
      .ilike('subject', '%TEST NUOVO CLIENT%')

    if (messagesError) {
      console.error('Errore ricerca messaggi:', messagesError)
      return Response.json({ success: false, message: 'Errore ricerca messaggi' }, { status: 500 })
    }

    if (messages && messages.length > 0) {
      console.log(`🔧 Trovati ${messages.length} messaggi da riprocessare`)

      for (const message of messages) {
        // Cancella allegati esistenti per forzare riprocessamento
        const { error: deleteError } = await supabase
          .from('scadenze_bandi_email_attachments')
          .delete()
          .eq('message_id', message.id)

        if (deleteError) {
          console.error(`Errore cancellazione allegati per ${message.subject}:`, deleteError)
        } else {
          console.log(`🔧 Allegati cancellati per: ${message.subject}`)
        }
      }

      return Response.json({
        success: true,
        message: `Allegati corrotti cancellati per ${messages.length} messaggi`,
        processedMessages: messages.length
      })
    } else {
      return Response.json({
        success: false,
        message: 'Nessun messaggio TEST NUOVO CLIENT trovato'
      })
    }

  } catch (error: any) {
    console.error('Errore riprocessamento allegati:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore riprocessamento allegati'
    }, { status: 500 })
  }
}