import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ImapService } from '@/lib/email/imapService'
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
 * POST /api/email/sync/messages - Sincronizza messaggi per una cartella
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(req)
    const body = await req.json()
    const { accountId, folderId, maxMessages = 200 } = body

    if (!accountId || !folderId) {
      return Response.json({
        success: false,
        message: 'ID account e cartella obbligatori'
      }, { status: 400 })
    }

    console.log(`🔄 Inizio sincronizzazione messaggi per cartella ${folderId}`)

    // Ottieni account
    const { data: account, error: accountError } = await supabase
      .from('scadenze_bandi_email_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single()

    if (accountError || !account) {
      return Response.json({
        success: false,
        message: 'Account non trovato'
      }, { status: 404 })
    }

    // Ottieni cartella
    const { data: folder, error: folderError } = await supabase
      .from('scadenze_bandi_email_folders')
      .select('*')
      .eq('id', folderId)
      .eq('account_id', accountId)
      .single()

    if (folderError || !folder) {
      return Response.json({
        success: false,
        message: 'Cartella non trovata'
      }, { status: 404 })
    }

    // Sincronizza messaggi
    const imapService = new ImapService(account)
    const messages = await imapService.syncMessages(folder.full_path, maxMessages)

    await imapService.disconnect()

    console.log(`✅ Sincronizzazione messaggi completata: ${messages.length} messaggi`)

    return Response.json({
      success: true,
      message: `Sincronizzati ${messages.length} messaggi`,
      data: messages
    })

  } catch (error: any) {
    console.error('Errore sincronizzazione messaggi:', error)

    return Response.json({
      success: false,
      message: error.message || 'Errore sincronizzazione messaggi'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}