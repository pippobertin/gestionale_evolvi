import { google } from 'googleapis'

export interface GmailConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  refreshToken?: string
  accessToken?: string
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
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ]

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
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