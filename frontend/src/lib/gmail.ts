import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

export interface GmailConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  refreshToken?: string
  accessToken?: string
}

/**
 * Creates a configured OAuth2 client for Google APIs
 * @param redirectUri - Optional custom redirect URI, defaults to Gmail callback
 */
export function createGoogleAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
  )
}

/**
 * Retrieves Gmail client with tokens from database
 * Supports both per-user tokens and system-wide fallback
 *
 * @param userId - Optional user ID to use per-user Gmail tokens
 * @returns Configured Gmail client
 */
export async function getGmailClient(userId?: string) {
  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let refreshToken: string | null = null
  let accessToken: string | null = null
  let gmailEmail: string | null = null

  // If userId provided, try to get user-specific tokens first
  if (userId) {
    const { data: userData, error: userError } = await supabase
      .from('scadenze_bandi_utenti')
      .select('gmail_refresh_token, gmail_access_token, gmail_email')
      .eq('id', userId)
      .single()

    if (!userError && userData?.gmail_refresh_token) {
      refreshToken = userData.gmail_refresh_token
      accessToken = userData.gmail_access_token
      gmailEmail = userData.gmail_email
      console.log(`✅ Using Gmail tokens for user ${gmailEmail || userId}`)
    } else {
      console.log(`⚠️ User ${userId} has no Gmail connected, falling back to system settings`)
    }
  }

  // Fallback to system-wide tokens if user tokens not found
  if (!refreshToken) {
    const { data: refreshTokenData, error: refreshError } = await supabase
      .from('scadenze_bandi_system_settings')
      .select('value')
      .eq('key', 'gmail_refresh_token')
      .single()

    if (refreshError || !refreshTokenData) {
      throw new Error(userId
        ? `User ${userId} has no Gmail connected and system Gmail is not configured`
        : 'Gmail refresh token not found in system settings'
      )
    }

    const { data: accessTokenData } = await supabase
      .from('scadenze_bandi_system_settings')
      .select('value')
      .eq('key', 'gmail_access_token')
      .single()

    refreshToken = refreshTokenData.value
    accessToken = accessTokenData?.value
    console.log('✅ Using system-wide Gmail tokens')
  }

  // Create OAuth2 client with tokens
  const oauth2Client = createGoogleAuthClient()
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken || undefined
  })

  // Return configured Gmail client
  return google.gmail({ version: 'v1', auth: oauth2Client })
}

export class GmailService {
  private oauth2Client: any

  constructor(config: GmailConfig) {
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    )

    if (config.refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: config.refreshToken,
        access_token: config.accessToken
      })
    }
  }

  /**
   * Genera URL per autorizzazione Gmail
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels'
    ]

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      include_granted_scopes: true
    })
  }

  /**
   * Scambia codice autorizzazione con tokens
   */
  async getTokensFromCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    const { tokens } = await this.oauth2Client.getToken(code)

    this.oauth2Client.setCredentials(tokens)

    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!
    }
  }

  /**
   * Invia email tramite Gmail API
   */
  async sendEmail(
    to: string,
    subject: string,
    htmlContent: string,
    fromEmail = 'info@blmproject.com'
  ): Promise<boolean> {
    try {
      // Refresh token se necessario
      await this.oauth2Client.getAccessToken()

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })

      // Crea messaggio email in formato RFC 2822
      const rawMessage = this.createRawMessage(to, fromEmail, subject, htmlContent)

      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: rawMessage
        }
      })

      console.log('✅ Email inviata tramite Gmail:', result.data.id)
      return true

    } catch (error) {
      console.error('❌ Errore invio Gmail:', error)
      return false
    }
  }

  /**
   * Crea messaggio raw in formato RFC 2822
   */
  private createRawMessage(
    to: string,
    from: string,
    subject: string,
    htmlContent: string
  ): string {
    const boundary = '----=_Part_0_1234567890.1234567890'

    const message = [
      `To: ${to}`,
      `From: BLM Project <${from}>`,
      `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(htmlContent, 'utf8').toString('base64'),
      '',
      `--${boundary}--`
    ].join('\r\n')

    // Encode in base64url
    return Buffer.from(message, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }


  /**
   * Test connessione Gmail
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test solo refresh del token (senza richiedere profilo)
      const { token } = await this.oauth2Client.getAccessToken()

      if (!token) {
        throw new Error('Impossibile ottenere access token')
      }

      console.log('✅ Gmail connesso: Token valido')
      return true
    } catch (error) {
      console.error('❌ Errore connessione Gmail:', error)
      return false
    }
  }
}