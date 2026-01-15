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
 * GET /api/email/messages?folderId=<id>&limit=50 - Ottieni messaggi per una cartella
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(req)
    const url = new URL(req.url)
    const folderId = url.searchParams.get('folderId')
    const limit = parseInt(url.searchParams.get('limit') || '50')

    if (!folderId) {
      return Response.json({
        success: false,
        message: 'ID cartella obbligatorio'
      }, { status: 400 })
    }

    // Verifica che la cartella appartenga a un account dell'utente
    const { data: folder, error: folderError } = await supabase
      .from('scadenze_bandi_email_folders')
      .select(`
        id,
        account_id,
        scadenze_bandi_email_accounts!inner(user_id)
      `)
      .eq('id', folderId)
      .single()

    if (folderError || !folder || folder.scadenze_bandi_email_accounts.user_id !== userId) {
      return Response.json({
        success: false,
        message: 'Cartella non trovata'
      }, { status: 404 })
    }

    // Ottieni messaggi
    const { data: messages, error } = await supabase
      .from('scadenze_bandi_email_messages')
      .select(`
        id,
        message_id,
        uid,
        subject,
        from_address,
        from_name,
        to_addresses,
        cc_addresses,
        body_preview,
        date_sent,
        date_received,
        is_read,
        is_flagged,
        has_attachments,
        size_bytes
      `)
      .eq('folder_id', folderId)
      .order('date_received', { ascending: false })
      .limit(limit)

    if (error) throw error

    return Response.json({
      success: true,
      data: messages || []
    })

  } catch (error: any) {
    console.error('Errore GET email messages:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore recupero messaggi'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}