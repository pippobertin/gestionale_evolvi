import { supabase } from '@/lib/supabase'

export interface EmailNotification {
  to: string
  subject: string
  htmlContent: string
  type: 'scadenza_alert' | 'progetto_assegnato' | 'digest_giornaliero' | 'digest_settimanale'
  priority: 'low' | 'normal' | 'high'
  scheduledFor?: string // ISO date string
  metadata?: {
    scadenzaId?: string
    progettoId?: string
    clienteId?: string
  }
}

export interface ScadenzaEmailData {
  id: string
  titolo: string
  dataScadenza: string
  giorniRimanenti: number
  priorita: string
  clienteNome: string
  progettoTitolo: string
  responsabileEmail: string
}

export class EmailService {

  /**
   * Recupera tutti i destinatari aggiuntivi attivi
   */
  static async getAdditionalRecipients(): Promise<string[]> {
    try {
      const { data: recipients, error } = await supabase
        .from('scadenze_bandi_additional_recipients')
        .select('email')
        .eq('active', true)

      if (error) {
        console.error('Errore recupero destinatari aggiuntivi:', error)
        return []
      }

      return recipients?.map(r => r.email) || []
    } catch (err) {
      console.error('Errore recupero destinatari aggiuntivi:', err)
      return []
    }
  }

  /**
   * Crea notifica email per scadenza imminente
   */
  static async createScadenzaAlert(scadenza: ScadenzaEmailData, giorni: number): Promise<void> {
    const urgencyText = giorni <= 1 ? 'URGENTE' : giorni <= 3 ? 'IMPORTANTE' : giorni <= 7 ? 'PROMEMORIA' : 'ALERT PRECOCE'
    const urgencyColor = giorni <= 1 ? '#dc2626' : giorni <= 3 ? '#ea580c' : giorni <= 7 ? '#059669' : '#0ea5e9'

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Scadenza ${urgencyText}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

            <!-- Header -->
            <div style="background: linear-gradient(135deg, #06b6d4, #059669); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">
                🔔 Scadenza ${urgencyText}
              </h1>
              <p style="color: #e0f7fa; margin: 8px 0 0 0; font-size: 16px;">
                ${giorni === 0 ? 'OGGI' : giorni === 1 ? 'DOMANI' : 'Tra ' + giorni + ' giorni'}
              </p>
            </div>

            <!-- Content -->
            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">

              <!-- Alert Badge -->
              <div style="background: ${urgencyColor}; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-size: 12px; font-weight: bold; margin-bottom: 20px;">
                ${urgencyText}
              </div>

              <!-- Scadenza Info -->
              <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #111827; margin: 0 0 12px 0; font-size: 18px;">
                  📋 ${scadenza.titolo}
                </h2>

                <div style="margin-bottom: 8px;">
                  <strong>📅 Data scadenza:</strong>
                  <span style="color: ${urgencyColor}; font-weight: bold;">
                    ${new Date(scadenza.dataScadenza).toLocaleDateString('it-IT', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>

                <div style="margin-bottom: 8px;">
                  <strong>🏢 Cliente:</strong> ${scadenza.clienteNome}
                </div>

                <div style="margin-bottom: 8px;">
                  <strong>🎯 Progetto:</strong> ${scadenza.progettoTitolo}
                </div>

                <div>
                  <strong>⚡ Priorità:</strong>
                  <span style="color: ${scadenza.priorita === 'alta' ? '#dc2626' : scadenza.priorita === 'media' ? '#ea580c' : '#059669'};">
                    ${scadenza.priorita.toUpperCase()}
                  </span>
                </div>
              </div>

              <!-- Action Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}"
                   style="background: linear-gradient(135deg, #06b6d4, #059669); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  🚀 Apri Gestionale Evolvi
                </a>
              </div>

              <!-- Footer -->
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; color: #6b7280; font-size: 14px;">
                <p>Questa email è stata generata automaticamente dal sistema di gestione scadenze.</p>
                <p style="margin: 0;">Per modificare le impostazioni di notifica, accedi al gestionale.</p>
              </div>

            </div>
          </div>
        </body>
      </html>
    `

    // Recupera destinatari aggiuntivi
    const additionalRecipients = await this.getAdditionalRecipients()

    // Lista completa destinatari: responsabile + destinatari aggiuntivi
    const allRecipients = []
    if (scadenza.responsabileEmail) {
      allRecipients.push(scadenza.responsabileEmail)
    }
    allRecipients.push(...additionalRecipients)

    // Rimuovi duplicati
    const uniqueRecipients = allRecipients.filter((email, index, self) =>
      self.indexOf(email) === index
    )

    // Invia notifica a tutti i destinatari
    for (const recipient of uniqueRecipients) {
      const notification: EmailNotification = {
        to: recipient,
        subject: `${urgencyText}: ${scadenza.titolo} - ${giorni === 0 ? 'OGGI' : giorni === 1 ? 'Domani' : 'Tra ' + giorni + ' giorni'}`,
        htmlContent,
        type: 'scadenza_alert',
        priority: giorni <= 1 ? 'high' : giorni <= 3 ? 'normal' : 'low',
        metadata: {
          scadenzaId: scadenza.id
        }
      }

      await this.queueEmail(notification)
    }
  }

  /**
   * Crea digest settimanale scadenze per tutti i destinatari
   */
  static async createWeeklyDigest(scadenze: ScadenzaEmailData[]): Promise<void> {
    const urgenti = scadenze.filter(s => s.giorniRimanenti <= 1)
    const imminenti = scadenze.filter(s => s.giorniRimanenti > 1 && s.giorniRimanenti <= 7)

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Digest Settimanale Scadenze</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

            <!-- Header -->
            <div style="background: linear-gradient(135deg, #06b6d4, #059669); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">
                📊 Digest Settimanale
              </h1>
              <p style="color: #e0f7fa; margin: 8px 0 0 0;">
                Riepilogo scadenze della settimana
              </p>
            </div>

            <!-- Content -->
            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">

              <!-- Stats -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px;">
                <div style="background: #fee2e2; padding: 16px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${urgenti.length}</div>
                  <div style="color: #7f1d1d; font-size: 14px;">Urgenti</div>
                </div>
                <div style="background: #fef3c7; padding: 16px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 24px; font-weight: bold; color: #d97706;">${imminenti.length}</div>
                  <div style="color: #92400e; font-size: 14px;">Imminenti</div>
                </div>
              </div>

              ${urgenti.length > 0 ? `
              <!-- Urgenti -->
              <div style="margin-bottom: 24px;">
                <h3 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 8px;">🚨 Urgenti (${urgenti.length})</h3>
                ${urgenti.map(s => `
                <div style="background: #fee2e2; padding: 12px; margin-bottom: 8px; border-radius: 6px; border-left: 4px solid #dc2626;">
                  <strong>${s.titolo}</strong><br>
                  <small style="color: #7f1d1d;">${s.clienteNome} • ${new Date(s.dataScadenza).toLocaleDateString('it-IT')}</small>
                </div>
                `).join('')}
              </div>
              ` : ''}

              ${imminenti.length > 0 ? `
              <!-- Imminenti -->
              <div style="margin-bottom: 24px;">
                <h3 style="color: #d97706; border-bottom: 2px solid #d97706; padding-bottom: 8px;">⏰ Imminenti (${imminenti.length})</h3>
                ${imminenti.map(s => `
                <div style="background: #fef3c7; padding: 12px; margin-bottom: 8px; border-radius: 6px; border-left: 4px solid #d97706;">
                  <strong>${s.titolo}</strong><br>
                  <small style="color: #92400e;">${s.clienteNome} • ${new Date(s.dataScadenza).toLocaleDateString('it-IT')} (${s.giorniRimanenti} giorni)</small>
                </div>
                `).join('')}
              </div>
              ` : ''}

              <!-- Action Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/scadenze"
                   style="background: linear-gradient(135deg, #06b6d4, #059669); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  📋 Visualizza Scadenziario
                </a>
              </div>

            </div>
          </div>
        </body>
      </html>
    `

    // Recupera tutti i destinatari per il digest settimanale
    const additionalRecipients = await this.getAdditionalRecipients()

    // Per il digest settimanale, invio solo ai destinatari aggiuntivi
    // (i responsabili ricevono già le notifiche singole)
    for (const recipient of additionalRecipients) {
      const notification: EmailNotification = {
        to: recipient,
        subject: `Digest Settimanale: ${urgenti.length + imminenti.length} scadenze da monitorare`,
        htmlContent,
        type: 'digest_settimanale',
        priority: 'normal'
      }

      await this.queueEmail(notification)
    }
  }

  /**
   * Accoda email per invio
   */
  private static async queueEmail(notification: EmailNotification): Promise<void> {
    try {
      const { error } = await supabase
        .from('scadenze_bandi_email_queue')
        .insert({
          to_email: notification.to,
          subject: notification.subject,
          html_content: notification.htmlContent,
          notification_type: notification.type,
          priority: notification.priority,
          scheduled_for: notification.scheduledFor || new Date().toISOString(),
          metadata: notification.metadata,
          status: 'pending',
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('Errore accodamento email:', error)
        throw error
      }

      console.log(`Email accodata per ${notification.to}: ${notification.subject}`)
    } catch (error) {
      console.error('Errore nel servizio email:', error)
      throw error
    }
  }

  /**
   * Processa coda email (da chiamare con cron job)
   */
  static async processEmailQueue(): Promise<void> {
    try {
      const { data: emails, error } = await supabase
        .from('scadenze_bandi_email_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(10)

      if (error) throw error

      for (const email of emails || []) {
        try {
          // Qui implementeremo l'invio effettivo via Gmail API
          await this.sendEmailViaGmail(email)

          // Aggiorna status a 'sent'
          await supabase
            .from('scadenze_bandi_email_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', email.id)

        } catch (error) {
          console.error(`Errore invio email ${email.id}:`, error)

          // Aggiorna status a 'failed'
          await supabase
            .from('scadenze_bandi_email_queue')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Errore sconosciuto'
            })
            .eq('id', email.id)
        }
      }
    } catch (error) {
      console.error('Errore processamento coda email:', error)
    }
  }

  /**
   * Invio email tramite Gmail API
   */
  private static async sendEmailViaGmail(email: any): Promise<void> {
    try {
      // Importa dinamicamente per evitare errori server-side
      const { GmailService } = await import('@/lib/gmail')
      const { supabase } = await import('@/lib/supabase')

      // Recupera tokens dal database
      const { data: refreshTokenData } = await supabase
        .from('scadenze_bandi_system_settings')
        .select('value')
        .eq('key', 'gmail_refresh_token')
        .single()

      const { data: accessTokenData } = await supabase
        .from('scadenze_bandi_system_settings')
        .select('value')
        .eq('key', 'gmail_access_token')
        .single()

      if (!refreshTokenData?.value) {
        throw new Error('Gmail non configurato - manca refresh token')
      }

      // Inizializza Gmail service
      const gmailService = new GmailService({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`,
        refreshToken: refreshTokenData.value,
        accessToken: accessTokenData?.value
      })

      // Invia email
      const success = await gmailService.sendEmail(
        email.to_email,
        email.subject,
        email.html_content
      )

      if (!success) {
        throw new Error('Invio Gmail fallito')
      }

      console.log(`✅ Email inviata tramite Gmail a ${email.to_email}: ${email.subject}`)

    } catch (error) {
      console.error(`❌ Errore invio Gmail a ${email.to_email}:`, error)
      throw error
    }
  }
}