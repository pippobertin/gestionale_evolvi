import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ImapService, testSmtpConnection, createProviderPreset, EmailProvider } from '@/lib/email/imapService'
import jwt from 'jsonwebtoken'
import * as nodemailer from 'nodemailer'

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
 * POST /api/email/test-connection - Test configurazione email senza salvare
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(req)
    const body = await req.json()

    const {
      email,
      password,
      provider,
      customConfig,
      testType = 'both' // 'imap', 'smtp', 'both'
    } = body

    // Validazione base
    if (!email || !password) {
      return Response.json({
        success: false,
        message: 'Email e password sono obbligatori'
      }, { status: 400 })
    }

    // Crea configurazione temporanea
    let testConfig: any

    if (provider && provider !== 'generic') {
      // Usa preset provider
      testConfig = createProviderPreset(provider as EmailProvider, email, password)
    } else if (customConfig) {
      // Configurazione manuale
      testConfig = {
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

    // Account temporaneo per test
    const testAccount = { ...testConfig, id: 'test-' + Date.now() }

    const results: any = {
      email: email,
      provider: provider || 'generic'
    }

    // Test IMAP
    if (testType === 'imap' || testType === 'both') {
      try {
        console.log(`🔍 Test IMAP per ${email}...`)
        const imapService = new ImapService(testAccount as any)
        const imapResult = await imapService.testConnection()

        results.imap = {
          success: imapResult.success,
          error: imapResult.error,
          server: `${testConfig.imap_server}:${testConfig.imap_port}`,
          secure: testConfig.imap_secure
        }

        if (imapResult.success) {
          console.log(`✅ IMAP OK per ${email}`)
        } else {
          console.log(`❌ IMAP ERRORE per ${email}: ${imapResult.error}`)
        }

      } catch (error: any) {
        console.log(`❌ IMAP EXCEPTION per ${email}:`, error)
        results.imap = {
          success: false,
          error: error.message,
          server: `${testConfig.imap_server}:${testConfig.imap_port}`,
          secure: testConfig.imap_secure
        }
      }
    }

    // Test SMTP
    if (testType === 'smtp' || testType === 'both') {
      try {
        console.log(`🔍 Test SMTP per ${email}...`)
        const smtpResult = await testSmtpConnection(testAccount as any)

        results.smtp = {
          success: smtpResult.success,
          error: smtpResult.error,
          server: `${testConfig.smtp_server}:${testConfig.smtp_port}`,
          secure: testConfig.smtp_secure
        }

        if (smtpResult.success) {
          console.log(`✅ SMTP OK per ${email}`)
        } else {
          console.log(`❌ SMTP ERRORE per ${email}: ${smtpResult.error}`)
        }

      } catch (error: any) {
        console.log(`❌ SMTP EXCEPTION per ${email}:`, error)
        results.smtp = {
          success: false,
          error: error.message,
          server: `${testConfig.smtp_server}:${testConfig.smtp_port}`,
          secure: testConfig.smtp_secure
        }
      }
    }

    // Determina successo complessivo
    const overallSuccess =
      (!results.imap || results.imap.success) &&
      (!results.smtp || results.smtp.success)

    return Response.json({
      success: overallSuccess,
      message: overallSuccess
        ? 'Test connessione completato con successo'
        : 'Test connessione fallito',
      data: results
    })

  } catch (error: any) {
    console.error('Errore test connessione email:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore test connessione',
      data: {
        email: 'N/A',
        error: error.message
      }
    }, { status: error.message === 'Non autorizzato' ? 401 : 500 })
  }
}