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
 * PUT /api/email/accounts/[accountId] - Aggiorna un account email
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const userId = await getAuthenticatedUser(req)

    // Resolve params se è una Promise (Next.js 15+)
    const resolvedParams = await Promise.resolve(params)
    const accountId = resolvedParams.accountId

    const body = await req.json()
    const {
      name,
      email_address,
      username,
      encrypted_password,
      provider_type,
      imap_server,
      imap_port,
      imap_secure,
      smtp_server,
      smtp_port,
      smtp_secure
    } = body

    console.log(`⚙️ Aggiornamento account richiesto: ${accountId}`)

    if (!accountId) {
      return Response.json({
        success: false,
        message: 'ID account obbligatorio'
      }, { status: 400 })
    }

    // Verifica che l'account appartenga all'utente
    const { data: existingAccount, error: checkError } = await supabase
      .from('scadenze_bandi_email_accounts')
      .select('user_id')
      .eq('id', accountId)
      .single()

    if (checkError || !existingAccount) {
      console.error('Account non trovato:', checkError)
      return Response.json({
        success: false,
        message: 'Account non trovato'
      }, { status: 404 })
    }

    if (existingAccount.user_id !== userId) {
      return Response.json({
        success: false,
        message: 'Non autorizzato'
      }, { status: 403 })
    }

    // Prepara i dati da aggiornare (solo i campi forniti)
    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (email_address !== undefined) updateData.email_address = email_address
    if (username !== undefined) updateData.username = username
    if (encrypted_password !== undefined) updateData.encrypted_password = encrypted_password
    if (provider_type !== undefined) updateData.provider_type = provider_type
    if (imap_server !== undefined) updateData.imap_server = imap_server
    if (imap_port !== undefined) updateData.imap_port = imap_port
    if (imap_secure !== undefined) updateData.imap_secure = imap_secure
    if (smtp_server !== undefined) updateData.smtp_server = smtp_server
    if (smtp_port !== undefined) updateData.smtp_port = smtp_port
    if (smtp_secure !== undefined) updateData.smtp_secure = smtp_secure

    // Aggiorna timestamp
    updateData.updated_at = new Date().toISOString()

    console.log('⚙️ Campi da aggiornare:', Object.keys(updateData))

    // Aggiorna l'account nel database
    const { data: updatedAccount, error: updateError } = await supabase
      .from('scadenze_bandi_email_accounts')
      .update(updateData)
      .eq('id', accountId)
      .select()
      .single()

    if (updateError) {
      console.error('Errore aggiornamento account:', updateError)
      return Response.json({
        success: false,
        message: 'Errore aggiornamento account'
      }, { status: 500 })
    }

    console.log(`⚙️ Account aggiornato con successo: ${updatedAccount.email_address}`)

    return Response.json({
      success: true,
      data: {
        id: updatedAccount.id,
        name: updatedAccount.name,
        email_address: updatedAccount.email_address,
        provider_type: updatedAccount.provider_type,
        is_active: updatedAccount.is_active
      }
    })

  } catch (error: any) {
    console.error('Errore aggiornamento account:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore aggiornamento account'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}

/**
 * DELETE /api/email/accounts/[accountId] - Elimina un account email
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const userId = await getAuthenticatedUser(req)

    // Resolve params se è una Promise (Next.js 15+)
    const resolvedParams = await Promise.resolve(params)
    const accountId = resolvedParams.accountId

    console.log(`🗑️ Eliminazione account richiesta: ${accountId}`)

    if (!accountId) {
      return Response.json({
        success: false,
        message: 'ID account obbligatorio'
      }, { status: 400 })
    }

    // Verifica che l'account appartenga all'utente
    const { data: existingAccount, error: checkError } = await supabase
      .from('scadenze_bandi_email_accounts')
      .select('user_id, email_address')
      .eq('id', accountId)
      .single()

    if (checkError || !existingAccount) {
      console.error('Account non trovato:', checkError)
      return Response.json({
        success: false,
        message: 'Account non trovato'
      }, { status: 404 })
    }

    if (existingAccount.user_id !== userId) {
      return Response.json({
        success: false,
        message: 'Non autorizzato'
      }, { status: 403 })
    }

    // Elimina l'account (a cascata eliminerà cartelle, messaggi, allegati)
    const { error: deleteError } = await supabase
      .from('scadenze_bandi_email_accounts')
      .delete()
      .eq('id', accountId)

    if (deleteError) {
      console.error('Errore eliminazione account:', deleteError)
      return Response.json({
        success: false,
        message: 'Errore eliminazione account'
      }, { status: 500 })
    }

    console.log(`🗑️ Account eliminato con successo: ${existingAccount.email_address}`)

    return Response.json({
      success: true,
      message: `Account ${existingAccount.email_address} eliminato con successo`
    })

  } catch (error: any) {
    console.error('Errore eliminazione account:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore eliminazione account'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}