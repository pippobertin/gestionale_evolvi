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
 * Client Gmail della casella personale dell'utente. Chi non l'ha collegata
 * riceve un messaggio che dice dove farlo.
 */
export const MESSAGGIO_GMAIL_NON_COLLEGATO = 'La tua casella Gmail non è collegata: collegala in Impostazioni, Il mio account Google.'

export async function getGmailClient(userId?: string) {
  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let refreshToken: string | null = null
  let accessToken: string | null = null
  let gmailEmail: string | null = null

  // Solo la casella personale: nessun ripiego sulla casella di sistema (le email
  // partono sempre da chi le scrive)
  void gmailEmail
  if (userId) {
    const { data: userData, error: userError } = await supabase
      .from('scadenze_bandi_utenti')
      .select('gmail_refresh_token, gmail_access_token')
      .eq('id', userId)
      .single()
    if (!userError && userData?.gmail_refresh_token) {
      refreshToken = userData.gmail_refresh_token
      accessToken = userData.gmail_access_token
    }
  }
  if (!refreshToken) throw new Error(MESSAGGIO_GMAIL_NON_COLLEGATO)

  // Accesso a Google: si riusa quello ancora valido tenuto in memoria; il token
  // salvato nel database risale al collegamento ed è quasi sempre scaduto, e
  // presentarlo costava a ogni richiesta un rifiuto di Google e un secondo giro.
  void accessToken
  const oauth2Client = createGoogleAuthClient()
  const inMemoria = accessiGoogle.get(refreshToken!)
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    ...(inMemoria && inMemoria.expiry_date > Date.now() + 60_000 ? inMemoria : {})
  })
  oauth2Client.on('tokens', t => {
    if (t.access_token && t.expiry_date) accessiGoogle.set(refreshToken!, { access_token: t.access_token, expiry_date: t.expiry_date })
  })

  // Return configured Gmail client
  return google.gmail({ version: 'v1', auth: oauth2Client })
}

/** Accessi a Google ancora validi, per utente (memoria della funzione server). */
const accessiGoogle = new Map<string, { access_token: string; expiry_date: number }>()

/**
 * Metadati di più messaggi in una sola richiesta a Gmail (richiesta "batch"),
 * invece di una richiesta per messaggio. Se la richiesta multipla non riesce,
 * si torna alle richieste singole in parallelo.
 */
export async function metadatiMessaggi(gmail: ReturnType<typeof google.gmail>, ids: string[], intestazioni = ['From', 'To', 'Subject', 'Date']): Promise<any[]> {
  if (!ids.length) return []
  try {
    const { token } = await (gmail.context._options.auth as any).getAccessToken()
    if (!token) throw new Error('nessun accesso')
    const confine = `batch_${Date.now()}`
    const query = `format=metadata&${intestazioni.map(h => `metadataHeaders=${encodeURIComponent(h)}`).join('&')}&fields=id,threadId,labelIds,snippet,internalDate,sizeEstimate,payload/headers`
    const corpo = ids.map((id, i) =>
      `--${confine}\r\nContent-Type: application/http\r\nContent-ID: <m${i}>\r\n\r\nGET /gmail/v1/users/me/messages/${id}?${query}\r\n\r\n`
    ).join('') + `--${confine}--`
    const r = await fetch('https://gmail.googleapis.com/batch/gmail/v1', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/mixed; boundary=${confine}` },
      body: corpo
    })
    if (!r.ok) throw new Error(`batch ${r.status}`)
    const tipo = r.headers.get('content-type') || ''
    const confineRisposta = /boundary=([^;]+)/.exec(tipo)?.[1]
    if (!confineRisposta) throw new Error('risposta senza confine')
    const testo = await r.text()
    const perId = new Map<string, any>()
    for (const parte of testo.split(`--${confineRisposta}`)) {
      const inizio = parte.indexOf('{'), fine = parte.lastIndexOf('}')
      if (inizio < 0 || fine < inizio) continue
      try {
        const m = JSON.parse(parte.slice(inizio, fine + 1))
        if (m.id) perId.set(m.id, m)
      } catch { /* parte non valida: si ignora */ }
    }
    const mancanti = ids.filter(id => !perId.has(id))
    if (mancanti.length === ids.length) throw new Error('batch vuoto')
    // Le poche parti non riuscite (per esempio per limiti di frequenza) si chiedono singolarmente
    for (const m of await singoli(gmail, mancanti, intestazioni)) if (m?.id) perId.set(m.id, m)
    return ids.map(id => perId.get(id)).filter(Boolean)
  } catch (e) {
    console.warn('Richiesta multipla a Gmail non riuscita, uso le richieste singole:', e)
    return (await singoli(gmail, ids, intestazioni)).filter(Boolean)
  }
}

async function singoli(gmail: ReturnType<typeof google.gmail>, ids: string[], intestazioni: string[]) {
  return Promise.all(ids.map(async id => {
    try {
      const d = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: intestazioni })
      return d.data
    } catch {
      return null
    }
  }))
}

/**
 * Checks the delivery status of a Gmail message
 * @param messageId - The Gmail message ID
 * @param userId - Optional user ID for per-user tokens
 */
export async function getMessageStatus(messageId: string, userId?: string): Promise<{
  status: 'SENT' | 'DELIVERED' | 'BOUNCED' | 'FAILED' | 'UNKNOWN'
  error?: string
}> {
  try {
    const gmail = await getGmailClient(userId)
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: ['X-Failed-Recipients']
    })

    if (!message.data) {
      return { status: 'UNKNOWN' }
    }

    const labels = message.data.labelIds || []
    if (labels.includes('SENT')) {
      return { status: 'DELIVERED' }
    }

    return { status: 'SENT' }
  } catch (error: any) {
    if (error.code === 404) {
      return { status: 'FAILED', error: 'Message not found' }
    }
    return { status: 'UNKNOWN', error: error.message }
  }
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
   * Controlla lo stato di delivery di un messaggio Gmail
   */
  async getMessageStatus(messageId: string): Promise<{
    status: 'SENT' | 'DELIVERED' | 'BOUNCED' | 'FAILED' | 'UNKNOWN'
    error?: string
  }> {
    try {
      await this.oauth2Client.getAccessToken()
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })

      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['X-Failed-Recipients', 'X-Mailer-Daemon-Error']
      })

      if (!message.data) {
        return { status: 'UNKNOWN' }
      }

      const labels = message.data.labelIds || []

      // Check for bounce indicators
      if (labels.includes('BOUNCED') || labels.includes('DRAFT')) {
        return { status: 'BOUNCED', error: 'Message bounced' }
      }

      // If message exists in SENT folder, it was at least sent
      if (labels.includes('SENT')) {
        return { status: 'DELIVERED' }
      }

      return { status: 'SENT' }
    } catch (error: any) {
      console.error('Error checking message status:', error)
      if (error.code === 404) {
        return { status: 'FAILED', error: 'Message not found' }
      }
      return { status: 'UNKNOWN', error: error.message }
    }
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