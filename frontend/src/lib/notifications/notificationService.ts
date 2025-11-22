import { EmailService, ScadenzaEmailData } from './emailService'
import { CalendarService, ScadenzaCalendarData } from './calendarService'
import { supabase } from '@/lib/supabase'

export interface NotificationSettings {
  userId: string
  emailNotifications: {
    enabled: boolean
    scadenze_1_giorno: boolean
    scadenze_3_giorni: boolean
    scadenze_7_giorni: boolean
    scadenze_15_giorni: boolean
    digest_settimanale: boolean
    progetti_assegnati: boolean
  }
  calendarSync: {
    enabled: boolean
    calendarId?: string // Google Calendar ID
    syncScadenze: boolean
    syncMilestones: boolean
  }
  orariNonDisturbare: {
    enabled: boolean
    start: string // HH:mm
    end: string   // HH:mm
  }
}

export class NotificationService {

  /**
   * Processa notifiche scadenze in base alle impostazioni utente
   */
  static async processScadenzeNotifications(): Promise<void> {
    try {
      console.log('🔄 Inizio processamento notifiche scadenze...')

      // Ottieni tutte le scadenze imminenti
      const today = new Date()
      const in15Days = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000)

      const { data: scadenze, error } = await supabase
        .from('scadenze_bandi_scadenze')
        .select('*')
        .in('stato', ['non_iniziata', 'in_corso'])
        .gte('data_scadenza', today.toISOString().split('T')[0])
        .lte('data_scadenza', in15Days.toISOString().split('T')[0])

      if (error) throw error

      console.log(`📋 Trovate ${scadenze?.length || 0} scadenze imminenti`)

      // Raggruppa per utente
      const scadenzePerUtente = new Map<string, any[]>()
      for (const scadenza of scadenze || []) {
        const email = scadenza.responsabile_email
        if (!scadenzePerUtente.has(email)) {
          scadenzePerUtente.set(email, [])
        }
        scadenzePerUtente.get(email)!.push(scadenza)
      }

      // Processa notifiche per ogni utente
      for (const [userEmail, userScadenze] of scadenzePerUtente) {
        await this.processUserNotifications(userEmail, userScadenze)
      }

      console.log('✅ Processamento notifiche completato')

    } catch (error) {
      console.error('❌ Errore processamento notifiche scadenze:', error)
    }
  }

  /**
   * Processa notifiche per un singolo utente
   */
  private static async processUserNotifications(userEmail: string, scadenze: any[]): Promise<void> {
    try {
      // Ottieni impostazioni utente
      const settings = await this.getUserNotificationSettings(userEmail)

      if (!settings.emailNotifications.enabled && !settings.calendarSync.enabled) {
        return // Notifiche disabilitate
      }

      // Controlla orari non disturbare
      if (settings.orariNonDisturbare.enabled && this.isInQuietHours(settings.orariNonDisturbare)) {
        console.log(`⏰ Utente ${userEmail} in orario non disturbare, salto notifiche`)
        return
      }

      console.log(`👤 Processamento notifiche per ${userEmail}: ${scadenze.length} scadenze`)

      for (const scadenza of scadenze) {
        const giorniRimanenti = this.getGiorniRimanenti(scadenza.data_scadenza)

        // Email notifications
        if (settings.emailNotifications.enabled) {
          const shouldSendEmail = (
            (giorniRimanenti <= 1 && settings.emailNotifications.scadenze_1_giorno) ||
            (giorniRimanenti <= 3 && settings.emailNotifications.scadenze_3_giorni) ||
            (giorniRimanenti <= 7 && settings.emailNotifications.scadenze_7_giorni) ||
            (giorniRimanenti <= 15 && settings.emailNotifications.scadenze_15_giorni)
          )

          if (shouldSendEmail && !await this.wasNotificationSent(scadenza.id, giorniRimanenti)) {
            await this.sendScadenzaEmailNotification(scadenza, giorniRimanenti)
            await this.markNotificationSent(scadenza.id, giorniRimanenti, 'email')
          }
        }

        // Calendar sync
        if (settings.calendarSync.enabled && settings.calendarSync.syncScadenze) {
          await this.syncScadenzaToCalendar(scadenza)
        }
      }

    } catch (error) {
      console.error(`❌ Errore processamento notifiche utente ${userEmail}:`, error)
    }
  }

  /**
   * Invia digest settimanale a tutti i destinatari aggiuntivi
   */
  static async sendWeeklyDigests(): Promise<void> {
    try {
      console.log('📊 Inizio invio digest settimanale...')

      // Ottieni tutte le scadenze della settimana (per tutti i clienti/progetti)
      const today = new Date()
      const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

      const { data: scadenze, error } = await supabase
        .from('scadenze_bandi_scadenze')
        .select(`
          *,
          scadenze_bandi_clienti(denominazione),
          scadenze_bandi_progetti(titolo_progetto)
        `)
        .in('stato', ['non_iniziata', 'in_corso'])
        .gte('data_scadenza', today.toISOString().split('T')[0])
        .lte('data_scadenza', in7Days.toISOString().split('T')[0])

      if (error) throw error

      if (scadenze && scadenze.length > 0) {
        const scadenzeData: ScadenzaEmailData[] = scadenze.map(s => ({
          id: s.id,
          titolo: s.titolo,
          dataScadenza: s.data_scadenza,
          giorniRimanenti: this.getGiorniRimanenti(s.data_scadenza),
          priorita: s.priorita,
          clienteNome: s.scadenze_bandi_clienti?.denominazione || 'N/A',
          progettoTitolo: s.scadenze_bandi_progetti?.titolo_progetto || 'N/A',
          responsabileEmail: s.responsabile_email || ''
        }))

        // Invia un unico digest con tutte le scadenze ai destinatari aggiuntivi
        await EmailService.createWeeklyDigest(scadenzeData)
        console.log(`📧 Digest settimanale inviato: ${scadenze.length} scadenze`)
      } else {
        console.log('📊 Nessuna scadenza per il digest settimanale')
      }

    } catch (error) {
      console.error('❌ Errore invio digest settimanale:', error)
    }
  }


  /**
   * Notifica assegnazione nuovo progetto
   */
  static async notifyProgettoAssigned(progettoId: string, userEmail: string): Promise<void> {
    try {
      const settings = await this.getUserNotificationSettings(userEmail)

      if (!settings.emailNotifications.enabled || !settings.emailNotifications.progetti_assegnati) {
        return
      }

      // Ottieni dettagli progetto
      const { data: progetto, error } = await supabase
        .from('scadenze_bandi_progetti')
        .select(`
          *,
          cliente:scadenze_clienti(*),
          bando:scadenze_bandi_bandi(*)
        `)
        .eq('id', progettoId)
        .single()

      if (error) throw error

      // Invia email di notifica (da implementare template specifico)
      console.log(`📧 Notifica assegnazione progetto a ${userEmail}: ${progetto.titolo_progetto}`)

      // Calendar: crea milestone iniziali
      if (settings.calendarSync.enabled && settings.calendarSync.syncMilestones) {
        if (progetto.scadenza_accettazione_esiti) {
          await CalendarService.createProgettoMilestone(
            progettoId,
            'Scadenza Accettazione Esiti',
            progetto.scadenza_accettazione_esiti,
            `Scadenza per l'accettazione degli esiti del progetto ${progetto.titolo_progetto}`,
            [userEmail]
          )
        }
      }

    } catch (error) {
      console.error('❌ Errore notifica assegnazione progetto:', error)
    }
  }

  // === HELPER METHODS ===

  private static async sendScadenzaEmailNotification(scadenza: any, giorniRimanenti: number): Promise<void> {
    const scadenzaData: ScadenzaEmailData = {
      id: scadenza.id,
      titolo: scadenza.titolo,
      dataScadenza: scadenza.data_scadenza,
      giorniRimanenti,
      priorita: scadenza.priorita,
      clienteNome: scadenza.cliente_nome,
      progettoTitolo: scadenza.progetto_titolo,
      responsabileEmail: scadenza.responsabile_email
    }

    await EmailService.createScadenzaAlert(scadenzaData, giorniRimanenti)
  }

  private static async syncScadenzaToCalendar(scadenza: any): Promise<void> {
    const scadenzaData: ScadenzaCalendarData = {
      id: scadenza.id,
      titolo: scadenza.titolo,
      descrizione: scadenza.note,
      dataScadenza: scadenza.data_scadenza,
      priorita: scadenza.priorita,
      clienteNome: scadenza.cliente_nome,
      progettoTitolo: scadenza.progetto_titolo,
      responsabileEmail: scadenza.responsabile_email,
      note: scadenza.note
    }

    // Verifica se evento già esiste, altrimenti crea/aggiorna
    await CalendarService.updateScadenzaEvent(scadenzaData)
  }

  private static getGiorniRimanenti(dataScadenza: string): number {
    const oggi = new Date()
    oggi.setHours(0, 0, 0, 0)
    const scadenza = new Date(dataScadenza)
    scadenza.setHours(0, 0, 0, 0)
    return Math.ceil((scadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24))
  }

  private static isInQuietHours(orari: { start: string; end: string }): boolean {
    const now = new Date()
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    return currentTime >= orari.start && currentTime <= orari.end
  }

  private static async wasNotificationSent(scadenzaId: string, giorniRimanenti: number): Promise<boolean> {
    const { data, error } = await supabase
      .from('scadenze_bandi_notification_log')
      .select('id')
      .eq('entity_id', scadenzaId)
      .eq('notification_type', `scadenza_${giorniRimanenti}_giorni`)
      .eq('sent_date', new Date().toISOString().split('T')[0])
      .single()

    return !error && !!data
  }

  private static async markNotificationSent(scadenzaId: string, giorniRimanenti: number, channel: string): Promise<void> {
    await supabase
      .from('scadenze_bandi_notification_log')
      .insert({
        entity_id: scadenzaId,
        notification_type: `scadenza_${giorniRimanenti}_giorni`,
        channel,
        sent_date: new Date().toISOString().split('T')[0],
        sent_at: new Date().toISOString()
      })
  }

  private static async getUserNotificationSettings(userEmail: string): Promise<NotificationSettings> {
    const { data, error } = await supabase
      .from('scadenze_bandi_notification_settings')
      .select('*')
      .eq('user_email', userEmail)
      .single()

    if (error) {
      // Ritorna impostazioni di default se non trovate
      return {
        userId: userEmail,
        emailNotifications: {
          enabled: true,
          scadenze_1_giorno: true,
          scadenze_3_giorni: true,
          scadenze_7_giorni: true,
          scadenze_15_giorni: true,
          digest_settimanale: true,
          progetti_assegnati: true
        },
        calendarSync: {
          enabled: false,
          syncScadenze: true,
          syncMilestones: true
        },
        orariNonDisturbare: {
          enabled: false,
          start: '22:00',
          end: '08:00'
        }
      }
    }

    return {
      userId: data.user_email,
      emailNotifications: {
        enabled: data.email_enabled,
        scadenze_1_giorno: data.email_scadenze_1_giorno,
        scadenze_3_giorni: data.email_scadenze_3_giorni,
        scadenze_7_giorni: data.email_scadenze_7_giorni,
        scadenze_15_giorni: data.email_scadenze_15_giorni,
        digest_settimanale: data.email_digest_settimanale,
        progetti_assegnati: data.email_progetti_assegnati
      },
      calendarSync: {
        enabled: data.calendar_enabled,
        calendarId: data.calendar_id,
        syncScadenze: data.calendar_sync_scadenze,
        syncMilestones: data.calendar_sync_milestones
      },
      orariNonDisturbare: {
        enabled: data.quiet_hours_enabled,
        start: data.quiet_hours_start,
        end: data.quiet_hours_end
      }
    }
  }
}