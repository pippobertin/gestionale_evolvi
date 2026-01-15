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
 * POST /api/email/force-resync - Forza risincronizzazione completa di una cartella
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(req)
    const body = await req.json()
    const { accountId, folderId, maxMessages = 50 } = body

    if (!accountId || !folderId) {
      return Response.json({
        success: false,
        message: 'ID account e cartella obbligatori'
      }, { status: 400 })
    }

    console.log(`🔄 FORZA RISINCRONIZZAZIONE cartella ${folderId}`)

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

    console.log(`🗑️ Cancellazione messaggi esistenti per cartella ${folder.name}...`)

    // STEP 1: Cancella tutti i messaggi esistenti della cartella
    const { error: deleteError } = await supabase
      .from('scadenze_bandi_email_messages')
      .delete()
      .eq('folder_id', folderId)

    if (deleteError) {
      console.error('Errore cancellazione messaggi:', deleteError)
      return Response.json({
        success: false,
        message: 'Errore cancellazione messaggi esistenti'
      }, { status: 500 })
    }

    console.log(`✅ Messaggi cancellati. Inizio risincronizzazione...`)

    // STEP 2: Risincronizza completamente con il nuovo algoritmo
    const imapService = new ImapService(account)
    const messages = await imapService.syncMessages(folder.full_path, maxMessages)

    await imapService.disconnect()

    console.log(`✅ Risincronizzazione completata: ${messages.length} messaggi con nuovo algoritmo`)

    return Response.json({
      success: true,
      message: `Risincronizzati ${messages.length} messaggi con algoritmo migliorato`,
      data: messages
    })

  } catch (error: any) {
    console.error('Errore force resync:', error)

    return Response.json({
      success: false,
      message: error.message || 'Errore risincronizzazione forzata'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}