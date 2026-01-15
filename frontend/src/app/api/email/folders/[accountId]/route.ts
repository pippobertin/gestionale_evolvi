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
 * GET /api/email/folders/[accountId] - Ottieni cartelle di un account
 */
export async function GET(
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

    console.log(`📁 Recupero cartelle per account: ${accountId}`)

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

    // Ottieni cartelle
    const { data: folders, error: foldersError } = await supabase
      .from('scadenze_bandi_email_folders')
      .select('*')
      .eq('account_id', accountId)
      .order('name')

    if (foldersError) {
      console.error('Errore recupero cartelle:', foldersError)
      return Response.json({
        success: false,
        message: 'Errore recupero cartelle'
      }, { status: 500 })
    }

    console.log(`📁 Trovate ${folders?.length || 0} cartelle`)

    return Response.json({
      success: true,
      data: folders || []
    })

  } catch (error: any) {
    console.error('Errore GET folders:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore recupero cartelle'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}