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
 * POST /api/email/sync/folders - Sincronizza cartelle per un account
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(req)
    const body = await req.json()
    const { accountId } = body

    if (!accountId) {
      return Response.json({
        success: false,
        message: 'ID account obbligatorio'
      }, { status: 400 })
    }

    console.log(`🔄 Inizio sincronizzazione cartelle per account ${accountId}`)

    // Ottieni account dal database
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

    // Aggiorna stato sync
    await supabase
      .from('scadenze_bandi_email_accounts')
      .update({ sync_status: 'syncing' })
      .eq('id', accountId)

    // Sincronizza cartelle
    const imapService = new ImapService(account)
    const folders = await imapService.syncFolders()

    await imapService.disconnect()

    // Aggiorna stato completato
    await supabase
      .from('scadenze_bandi_email_accounts')
      .update({
        sync_status: 'success',
        last_sync: new Date().toISOString()
      })
      .eq('id', accountId)

    console.log(`✅ Sincronizzazione cartelle completata: ${folders.length} cartelle`)

    return Response.json({
      success: true,
      message: `Sincronizzate ${folders.length} cartelle`,
      data: folders
    })

  } catch (error: any) {
    console.error('Errore sincronizzazione cartelle:', error)

    // Aggiorna stato errore se possibile
    const body = await req.json().catch(() => ({}))
    if (body.accountId) {
      await supabase
        .from('scadenze_bandi_email_accounts')
        .update({
          sync_status: 'error',
          sync_error: error.message
        })
        .eq('id', body.accountId)
        .catch(() => {}) // Ignora errori di aggiornamento
    }

    return Response.json({
      success: false,
      message: error.message || 'Errore sincronizzazione cartelle'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}