import { NotificationService } from './notificationService'
import { EmailService } from './emailService'

export interface SchedulerConfig {
  scadenzeNotifications: {
    enabled: boolean
    interval: number // minuti
    times: string[] // HH:mm format
  }
  weeklyDigest: {
    enabled: boolean
    dayOfWeek: number // 0 = domenica, 1 = lunedi...
    time: string // HH:mm
  }
  emailQueue: {
    enabled: boolean
    interval: number // minuti
    batchSize: number
  }
}

export class NotificationScheduler {
  private static intervals: NodeJS.Timeout[] = []
  private static config: SchedulerConfig = {
    scadenzeNotifications: {
      enabled: true,
      interval: 60, // ogni ora
      times: ['09:00', '14:00', '18:00'] // 3 volte al giorno
    },
    weeklyDigest: {
      enabled: true,
      dayOfWeek: 1, // lunedì
      time: '08:00'
    },
    emailQueue: {
      enabled: true,
      interval: 5, // ogni 5 minuti
      batchSize: 10
    }
  }

  /**
   * Avvia tutti gli scheduler delle notifiche
   */
  static start(customConfig?: Partial<SchedulerConfig>): void {
    this.stop() // Ferma eventuali scheduler attivi

    if (customConfig) {
      this.config = { ...this.config, ...customConfig }
    }

    console.log('🚀 Avvio Notification Scheduler...')

    // Scheduler notifiche scadenze
    if (this.config.scadenzeNotifications.enabled) {
      this.startScadenzeNotificationsScheduler()
    }

    // Scheduler digest settimanale
    if (this.config.weeklyDigest.enabled) {
      this.startWeeklyDigestScheduler()
    }

    // Scheduler processamento coda email
    if (this.config.emailQueue.enabled) {
      this.startEmailQueueProcessor()
    }

    console.log('✅ Notification Scheduler attivo')
  }

  /**
   * Ferma tutti gli scheduler
   */
  static stop(): void {
    this.intervals.forEach(interval => clearInterval(interval))
    this.intervals = []
    console.log('🛑 Notification Scheduler fermato')
  }

  /**
   * Scheduler per notifiche scadenze
   */
  private static startScadenzeNotificationsScheduler(): void {
    console.log(`📋 Scheduler scadenze attivo (ogni ${this.config.scadenzeNotifications.interval} minuti)`)

    const interval = setInterval(async () => {
      try {
        const now = new Date()
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

        // Controlla se è uno dei momenti configurati per l'invio
        const shouldRun = this.config.scadenzeNotifications.times.some(time => {
          const [hours, minutes] = time.split(':')
          const targetMinutes = parseInt(hours) * 60 + parseInt(minutes)
          const currentMinutes = now.getHours() * 60 + now.getMinutes()

          // Tolleranza di 2 minuti
          return Math.abs(currentMinutes - targetMinutes) <= 2
        })

        if (shouldRun) {
          console.log(`🔔 Esecuzione notifiche scadenze alle ${currentTime}`)
          await NotificationService.processScadenzeNotifications()
        }
      } catch (error) {
        console.error('❌ Errore scheduler notifiche scadenze:', error)
      }
    }, this.config.scadenzeNotifications.interval * 60 * 1000)

    this.intervals.push(interval)
  }

  /**
   * Scheduler per digest settimanale
   */
  private static startWeeklyDigestScheduler(): void {
    console.log(`📊 Scheduler digest settimanale attivo (${this.getDayName(this.config.weeklyDigest.dayOfWeek)} ore ${this.config.weeklyDigest.time})`)

    const interval = setInterval(async () => {
      try {
        const now = new Date()
        const currentDay = now.getDay()
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

        // Controlla se è il giorno e l'ora corretti
        if (currentDay === this.config.weeklyDigest.dayOfWeek) {
          const [hours, minutes] = this.config.weeklyDigest.time.split(':')
          const targetMinutes = parseInt(hours) * 60 + parseInt(minutes)
          const currentMinutes = now.getHours() * 60 + now.getMinutes()

          // Tolleranza di 5 minuti
          if (Math.abs(currentMinutes - targetMinutes) <= 5) {
            console.log(`📊 Invio digest settimanali alle ${currentTime}`)
            await NotificationService.sendWeeklyDigests()
          }
        }
      } catch (error) {
        console.error('❌ Errore scheduler digest settimanali:', error)
      }
    }, 60 * 1000) // Controlla ogni minuto

    this.intervals.push(interval)
  }

  /**
   * Scheduler per processamento coda email
   */
  private static startEmailQueueProcessor(): void {
    console.log(`📧 Scheduler coda email attivo (ogni ${this.config.emailQueue.interval} minuti)`)

    const interval = setInterval(async () => {
      try {
        console.log(`📧 Processamento coda email...`)
        await EmailService.processEmailQueue()
      } catch (error) {
        console.error('❌ Errore processamento coda email:', error)
      }
    }, this.config.emailQueue.interval * 60 * 1000)

    this.intervals.push(interval)
  }

  /**
   * Esegue manualmente il processamento delle notifiche
   */
  static async runManualCheck(): Promise<void> {
    try {
      console.log('🔄 Esecuzione manuale notifiche...')

      await Promise.all([
        NotificationService.processScadenzeNotifications(),
        EmailService.processEmailQueue()
      ])

      console.log('✅ Esecuzione manuale completata')
    } catch (error) {
      console.error('❌ Errore esecuzione manuale:', error)
    }
  }

  /**
   * Aggiorna configurazione scheduler
   */
  static updateConfig(newConfig: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('📝 Configurazione scheduler aggiornata:', this.config)

    // Riavvia con nuova configurazione
    this.start()
  }

  /**
   * Ottieni configurazione attuale
   */
  static getConfig(): SchedulerConfig {
    return { ...this.config }
  }

  /**
   * Ottieni status scheduler
   */
  static getStatus(): {
    active: boolean
    runningJobs: number
    config: SchedulerConfig
    nextScadenzeCheck: string | null
    nextWeeklyDigest: string | null
  } {
    const nextScadenzeCheck = this.getNextScadenzeCheckTime()
    const nextWeeklyDigest = this.getNextWeeklyDigestTime()

    return {
      active: this.intervals.length > 0,
      runningJobs: this.intervals.length,
      config: this.config,
      nextScadenzeCheck,
      nextWeeklyDigest
    }
  }

  // === HELPER METHODS ===

  private static getDayName(dayNum: number): string {
    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
    return days[dayNum]
  }

  private static getNextScadenzeCheckTime(): string | null {
    if (!this.config.scadenzeNotifications.enabled) return null

    const now = new Date()
    const today = now.toISOString().split('T')[0]

    for (const time of this.config.scadenzeNotifications.times) {
      const [hours, minutes] = time.split(':')
      const checkTime = new Date(`${today}T${time}:00`)

      if (checkTime > now) {
        return checkTime.toLocaleString('it-IT')
      }
    }

    // Se tutti gli orari di oggi sono passati, prendi il primo orario di domani
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const firstTime = this.config.scadenzeNotifications.times[0]
    const nextCheckTime = new Date(`${tomorrow}T${firstTime}:00`)

    return nextCheckTime.toLocaleString('it-IT')
  }

  private static getNextWeeklyDigestTime(): string | null {
    if (!this.config.weeklyDigest.enabled) return null

    const now = new Date()
    const currentDay = now.getDay()
    const targetDay = this.config.weeklyDigest.dayOfWeek

    let daysUntilTarget = targetDay - currentDay
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7 // Prossima settimana
    }

    const nextDigestDate = new Date(now.getTime() + daysUntilTarget * 24 * 60 * 60 * 1000)
    const nextDigestDateStr = nextDigestDate.toISOString().split('T')[0]
    const nextDigestTime = new Date(`${nextDigestDateStr}T${this.config.weeklyDigest.time}:00`)

    return nextDigestTime.toLocaleString('it-IT')
  }
}