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
 * POST /api/email/sync/[accountId] - Sincronizza email di un account
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const userId = await getAuthenticatedUser(req)

    // Resolve params se è una Promise (Next.js 15+)
    const resolvedParams = await Promise.resolve(params)
    const accountId = resolvedParams.accountId

    if (!accountId) {
      return Response.json({
        success: false,
        message: 'ID account obbligatorio'
      }, { status: 400 })
    }

    console.log(`🔄 Sincronizzazione richiesta per account: ${accountId}`)

    // Verifica che l'account appartenga all'utente
    const { data: account, error: accountError } = await supabase
      .from('scadenze_bandi_email_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single()

    if (accountError || !account) {
      console.error('Account non trovato o non autorizzato:', accountError)
      return Response.json({
        success: false,
        message: 'Account non trovato'
      }, { status: 404 })
    }

    // Importa e usa ImapService per la sincronizzazione
    const { ImapService } = await import('@/lib/email/imapService')
    const imapService = new ImapService(account)

    // Aggiorna stato di sincronizzazione
    await supabase
      .from('scadenze_bandi_email_accounts')
      .update({
        sync_status: 'syncing',
        last_sync: new Date().toISOString()
      })
      .eq('id', accountId)

    try {
      // Connetti e sincronizza
      await imapService.connect()

      // Sincronizza cartelle
      console.log('🔄 Sincronizzazione cartelle...')
      const folders = await imapService.syncFolders()
      console.log(`🔄 Sincronizzate ${folders.length} cartelle`)

      // Sincronizza messaggi per ogni cartella (limitato alle principali)
      let totalMessages = 0
      for (const folder of folders.slice(0, 5)) { // Limita a prime 5 cartelle
        if (['INBOX', 'Sent', 'Inviati', 'Draft', 'Trash'].some(type =>
          folder.folder_type === type || folder.name.toLowerCase().includes(type.toLowerCase())
        )) {
          console.log(`🔄 Sincronizzazione messaggi cartella: ${folder.name}`)
          // Riduciamo il limite per sincronizzazioni più veloci
          const maxMessages = folder.name === 'INBOX' ? 50 : 20
          const messages = await imapService.syncMessages(folder.full_path, maxMessages)
          totalMessages += messages.length
          console.log(`🔄 Sincronizzati ${messages.length} messaggi da ${folder.name}`)
        }
      }

      await imapService.disconnect()

      // Aggiorna stato completato
      await supabase
        .from('scadenze_bandi_email_accounts')
        .update({
          sync_status: 'completed',
          last_sync: new Date().toISOString()
        })
        .eq('id', accountId)

      console.log(`🔄 Sincronizzazione completata: ${totalMessages} messaggi totali`)

      return Response.json({
        success: true,
        data: {
          folders_synced: folders.length,
          messages_synced: totalMessages,
          last_sync: new Date().toISOString()
        }
      })

    } catch (syncError: any) {
      console.error('🔄 Errore durante sincronizzazione:', syncError)

      // Aggiorna stato errore
      await supabase
        .from('scadenze_bandi_email_accounts')
        .update({
          sync_status: 'error',
          last_sync: new Date().toISOString()
        })
        .eq('id', accountId)

      throw syncError
    }

  } catch (error: any) {
    console.error('Errore sincronizzazione:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore sincronizzazione'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}