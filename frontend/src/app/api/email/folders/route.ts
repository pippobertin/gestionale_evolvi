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
 * GET /api/email/folders?accountId=<id> - Ottieni cartelle per un account
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(req)
    const url = new URL(req.url)
    const accountId = url.searchParams.get('accountId')

    if (!accountId) {
      return Response.json({
        success: false,
        message: 'ID account obbligatorio'
      }, { status: 400 })
    }

    // Verifica che l'account appartenga all'utente
    const { data: account, error: accountError } = await supabase
      .from('scadenze_bandi_email_accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single()

    if (accountError || !account) {
      return Response.json({
        success: false,
        message: 'Account non trovato'
      }, { status: 404 })
    }

    // Ottieni cartelle
    const { data: folders, error } = await supabase
      .from('scadenze_bandi_email_folders')
      .select(`
        id,
        name,
        full_path,
        folder_type,
        total_messages,
        unread_messages,
        highest_uid,
        last_sync
      `)
      .eq('account_id', accountId)
      .order('folder_type', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error

    return Response.json({
      success: true,
      data: folders || []
    })

  } catch (error: any) {
    console.error('Errore GET email folders:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore recupero cartelle'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}