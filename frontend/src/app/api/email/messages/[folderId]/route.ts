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
 * GET /api/email/messages/[folderId] - Ottieni messaggi di una cartella
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { folderId: string } }
) {
  try {
    const userId = await getAuthenticatedUser(req)

    // Resolve params se è una Promise (Next.js 15+)
    const resolvedParams = await Promise.resolve(params)
    const folderId = resolvedParams.folderId

    if (!folderId) {
      return Response.json({
        success: false,
        message: 'ID cartella obbligatorio'
      }, { status: 400 })
    }

    console.log(`📧 Recupero messaggi per cartella: ${folderId}`)

    // Verifica che la cartella appartenga all'utente
    const { data: folder, error: folderError } = await supabase
      .from('scadenze_bandi_email_folders')
      .select(`
        *,
        scadenze_bandi_email_accounts!inner(user_id)
      `)
      .eq('id', folderId)
      .single()

    if (folderError || !folder || folder.scadenze_bandi_email_accounts.user_id !== userId) {
      console.error('Cartella non trovata o non autorizzata:', folderError)
      return Response.json({
        success: false,
        message: 'Cartella non trovata'
      }, { status: 404 })
    }

    // Ottieni messaggi
    const { data: messages, error: messagesError } = await supabase
      .from('scadenze_bandi_email_messages')
      .select('*')
      .eq('folder_id', folderId)
      .order('date_sent', { ascending: false })
      .limit(100) // Limita a 100 messaggi per performance

    if (messagesError) {
      console.error('Errore recupero messaggi:', messagesError)
      return Response.json({
        success: false,
        message: 'Errore recupero messaggi'
      }, { status: 500 })
    }

    console.log(`📧 Trovati ${messages?.length || 0} messaggi`)

    return Response.json({
      success: true,
      data: messages || []
    })

  } catch (error: any) {
    console.error('Errore GET messages:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore recupero messaggi'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}