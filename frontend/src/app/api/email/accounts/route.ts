import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ImapService, testSmtpConnection, createProviderPreset, EmailProvider, EMAIL_PROVIDERS } from '@/lib/email/imapService'
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
 * GET /api/email/accounts - Lista account email dell'utente
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(req)

    const { data: accounts, error } = await supabase
      .from('scadenze_bandi_email_accounts')
      .select(`
        id,
        name,
        email_address,
        provider_type,
        imap_server,
        imap_port,
        smtp_server,
        smtp_port,
        is_active,
        last_sync,
        sync_status,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return Response.json({
      success: true,
      data: accounts || []
    })

  } catch (error: any) {
    console.error('Errore GET email accounts:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore recupero account email'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}

/**
 * POST /api/email/accounts - Crea nuovo account email
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(req)
    const body = await req.json()

    const {
      name,
      email,
      password,
      provider,
      customConfig
    } = body

    // Validazione base
    if (!name || !email || !password) {
      return Response.json({
        success: false,
        message: 'Nome, email e password sono obbligatori'
      }, { status: 400 })
    }

    // Crea configurazione account
    let accountConfig: any

    if (provider && provider !== 'generic') {
      // Usa preset provider
      accountConfig = createProviderPreset(provider as EmailProvider, email, password)
      accountConfig.name = name
    } else if (customConfig) {
      // Configurazione manuale
      accountConfig = {
        name,
        email_address: email,
        username: email,
        encrypted_password: password,
        provider_type: 'generic',
        imap_server: customConfig.imapServer,
        imap_port: customConfig.imapPort || 993,
        imap_secure: customConfig.imapSecure !== false,
        smtp_server: customConfig.smtpServer,
        smtp_port: customConfig.smtpPort || 587,
        smtp_secure: customConfig.smtpSecure === true
      }
    } else {
      return Response.json({
        success: false,
        message: 'Specificare provider o configurazione personalizzata'
      }, { status: 400 })
    }

    // Aggiungi user_id
    accountConfig.user_id = userId

    // Test connessione prima di salvare
    const testAccount = { ...accountConfig, id: 'test' }

    // Test IMAP
    const imapService = new ImapService(testAccount as any)
    const imapTest = await imapService.testConnection()

    if (!imapTest.success) {
      return Response.json({
        success: false,
        message: `Errore connessione IMAP: ${imapTest.error}`
      }, { status: 400 })
    }

    // Test SMTP
    const smtpTest = await testSmtpConnection(testAccount as any)

    if (!smtpTest.success) {
      return Response.json({
        success: false,
        message: `Errore connessione SMTP: ${smtpTest.error}`
      }, { status: 400 })
    }

    // Salva account nel database
    const { data: newAccount, error } = await supabase
      .from('scadenze_bandi_email_accounts')
      .insert(accountConfig)
      .select()
      .single()

    if (error) {
      console.error('Errore salvataggio account:', error)
      return Response.json({
        success: false,
        message: 'Errore salvataggio account nel database'
      }, { status: 500 })
    }

    // Avvia sincronizzazione iniziale cartelle
    try {
      const service = new ImapService(newAccount)
      await service.syncFolders()
      await service.disconnect()

      // Aggiorna stato sync
      await supabase
        .from('scadenze_bandi_email_accounts')
        .update({
          last_sync: new Date().toISOString(),
          sync_status: 'success'
        })
        .eq('id', newAccount.id)

    } catch (syncError) {
      console.warn('Errore sincronizzazione iniziale:', syncError)

      // Aggiorna stato errore
      await supabase
        .from('scadenze_bandi_email_accounts')
        .update({
          sync_status: 'error',
          sync_error: String(syncError)
        })
        .eq('id', newAccount.id)
    }

    return Response.json({
      success: true,
      message: 'Account email creato con successo',
      data: {
        id: newAccount.id,
        name: newAccount.name,
        email_address: newAccount.email_address,
        provider_type: newAccount.provider_type,
        is_active: newAccount.is_active
      }
    })

  } catch (error: any) {
    console.error('Errore POST email account:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore creazione account email'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}

/**
 * DELETE /api/email/accounts?id=<account_id> - Elimina account email
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(req)
    const url = new URL(req.url)
    const accountId = url.searchParams.get('id')

    if (!accountId) {
      return Response.json({
        success: false,
        message: 'ID account obbligatorio'
      }, { status: 400 })
    }

    // Verifica proprietà account
    const { data: account, error: fetchError } = await supabase
      .from('scadenze_bandi_email_accounts')
      .select('id, email_address')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !account) {
      return Response.json({
        success: false,
        message: 'Account non trovato'
      }, { status: 404 })
    }

    // Elimina account (cascade eliminerà anche cartelle, messaggi, ecc.)
    const { error } = await supabase
      .from('scadenze_bandi_email_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId)

    if (error) {
      console.error('Errore eliminazione account:', error)
      return Response.json({
        success: false,
        message: 'Errore eliminazione account'
      }, { status: 500 })
    }

    return Response.json({
      success: true,
      message: `Account ${account.email_address} eliminato con successo`
    })

  } catch (error: any) {
    console.error('Errore DELETE email account:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore eliminazione account'
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}