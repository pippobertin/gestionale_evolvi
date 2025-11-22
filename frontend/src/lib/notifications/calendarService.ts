import { supabase } from '@/lib/supabase'

export interface CalendarEvent {
  title: string
  description: string
  start: string // ISO datetime
  end: string // ISO datetime
  allDay?: boolean
  reminders?: CalendarReminder[]
  attendees?: string[] // email addresses
  location?: string
  metadata?: {
    scadenzaId?: string
    progettoId?: string
    clienteId?: string
    type: 'scadenza' | 'progetto_milestone' | 'meeting'
  }
}

export interface CalendarReminder {
  method: 'email' | 'popup'
  minutes: number // minuti prima dell'evento
}

export interface ScadenzaCalendarData {
  id: string
  titolo: string
  descrizione?: string
  dataScadenza: string
  priorita: string
  clienteNome: string
  progettoTitolo: string
  responsabileEmail: string
  note?: string
}

export class CalendarService {

  /**
   * Crea evento calendar per scadenza
   */
  static async createScadenzaEvent(scadenza: ScadenzaCalendarData): Promise<string | null> {
    try {
      const eventDate = new Date(scadenza.dataScadenza)

      // Evento all-day per scadenze
      const startDate = new Date(eventDate)
      startDate.setHours(9, 0, 0, 0) // 9:00 AM

      const endDate = new Date(eventDate)
      endDate.setHours(10, 0, 0, 0) // 10:00 AM

      const priorityEmoji = scadenza.priorita === 'alta' ? '🔴' : scadenza.priorita === 'media' ? '🟡' : '🟢'

      const event: CalendarEvent = {
        title: `${priorityEmoji} Scadenza: ${scadenza.titolo}`,
        description: this.formatScadenzaDescription(scadenza),
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        reminders: this.getScadenzaReminders(scadenza.priorita),
        attendees: [scadenza.responsabileEmail],
        location: 'Gestionale Evolvi',
        metadata: {
          scadenzaId: scadenza.id,
          type: 'scadenza'
        }
      }

      const eventId = await this.createCalendarEvent(event)

      // Salva riferimento evento nel database
      if (eventId) {
        await this.saveEventReference(scadenza.id, eventId, 'scadenza')
      }

      return eventId

    } catch (error) {
      console.error('Errore creazione evento calendar scadenza:', error)
      return null
    }
  }

  /**
   * Crea evento calendar per milestone progetto
   */
  static async createProgettoMilestone(
    progettoId: string,
    milestoneTitle: string,
    milestoneDate: string,
    description?: string,
    attendees: string[] = []
  ): Promise<string | null> {
    try {
      const eventDate = new Date(milestoneDate)

      const startDate = new Date(eventDate)
      startDate.setHours(14, 0, 0, 0) // 2:00 PM

      const endDate = new Date(eventDate)
      endDate.setHours(15, 0, 0, 0) // 3:00 PM

      const event: CalendarEvent = {
        title: `🎯 Milestone: ${milestoneTitle}`,
        description: description || `Milestone del progetto\\n\\nDettagli disponibili nel Gestionale Evolvi`,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        reminders: [
          { method: 'email', minutes: 24 * 60 }, // 1 giorno prima
          { method: 'popup', minutes: 60 }        // 1 ora prima
        ],
        attendees,
        location: 'Gestionale Evolvi',
        metadata: {
          progettoId,
          type: 'progetto_milestone'
        }
      }

      const eventId = await this.createCalendarEvent(event)

      if (eventId) {
        await this.saveEventReference(progettoId, eventId, 'progetto_milestone')
      }

      return eventId

    } catch (error) {
      console.error('Errore creazione evento calendar milestone:', error)
      return null
    }
  }

  /**
   * Aggiorna evento calendar esistente
   */
  static async updateScadenzaEvent(scadenza: ScadenzaCalendarData): Promise<boolean> {
    try {
      // Trova evento esistente
      const { data: eventRef, error } = await supabase
        .from('scadenze_bandi_calendar_events')
        .select('calendar_event_id')
        .eq('entity_id', scadenza.id)
        .eq('event_type', 'scadenza')
        .single()

      if (error || !eventRef) {
        // Se non esiste, crealo
        await this.createScadenzaEvent(scadenza)
        return true
      }

      // Aggiorna evento esistente
      const eventDate = new Date(scadenza.dataScadenza)
      const startDate = new Date(eventDate)
      startDate.setHours(9, 0, 0, 0)
      const endDate = new Date(eventDate)
      endDate.setHours(10, 0, 0, 0)

      const priorityEmoji = scadenza.priorita === 'alta' ? '🔴' : scadenza.priorita === 'media' ? '🟡' : '🟢'

      const updatedEvent: Partial<CalendarEvent> = {
        title: `${priorityEmoji} Scadenza: ${scadenza.titolo}`,
        description: this.formatScadenzaDescription(scadenza),
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        reminders: this.getScadenzaReminders(scadenza.priorita)
      }

      await this.updateCalendarEvent(eventRef.calendar_event_id, updatedEvent)
      return true

    } catch (error) {
      console.error('Errore aggiornamento evento calendar:', error)
      return false
    }
  }

  /**
   * Elimina evento calendar
   */
  static async deleteEvent(entityId: string, eventType: string): Promise<boolean> {
    try {
      const { data: eventRef, error } = await supabase
        .from('scadenze_bandi_calendar_events')
        .select('calendar_event_id')
        .eq('entity_id', entityId)
        .eq('event_type', eventType)
        .single()

      if (error || !eventRef) {
        return true // Già eliminato o non esistente
      }

      await this.deleteCalendarEvent(eventRef.calendar_event_id)

      // Rimuovi riferimento dal database
      await supabase
        .from('scadenze_bandi_calendar_events')
        .delete()
        .eq('entity_id', entityId)
        .eq('event_type', eventType)

      return true

    } catch (error) {
      console.error('Errore eliminazione evento calendar:', error)
      return false
    }
  }

  /**
   * Sync batch di scadenze con calendar
   */
  static async syncScadenzeToCalendar(userEmail: string): Promise<void> {
    try {
      // Ottieni scadenze attive dell'utente
      const { data: scadenze, error } = await supabase
        .from('scadenze_bandi_scadenze')
        .select('*')
        .eq('responsabile_email', userEmail)
        .in('stato', ['non_iniziata', 'in_corso'])
        .gte('data_scadenza', new Date().toISOString().split('T')[0])

      if (error) throw error

      for (const scadenza of scadenze || []) {
        await this.createScadenzaEvent({
          id: scadenza.id,
          titolo: scadenza.titolo,
          descrizione: scadenza.note,
          dataScadenza: scadenza.data_scadenza,
          priorita: scadenza.priorita,
          clienteNome: scadenza.cliente_id || 'N/A',
          progettoTitolo: scadenza.progetto_id || 'N/A',
          responsabileEmail: scadenza.responsabile_email,
          note: scadenza.note
        })
      }

      console.log(`Sync completato: ${scadenze?.length || 0} scadenze`)

    } catch (error) {
      console.error('Errore sync scadenze to calendar:', error)
    }
  }

  // === HELPER METHODS ===

  private static formatScadenzaDescription(scadenza: ScadenzaCalendarData): string {
    return `📋 Scadenza: ${scadenza.titolo}

🏢 Cliente: ${scadenza.clienteNome}
🎯 Progetto: ${scadenza.progettoTitolo}
⚡ Priorità: ${scadenza.priorita.toUpperCase()}

${scadenza.note ? `📝 Note:\\n${scadenza.note}\\n\\n` : ''}🚀 Apri Gestionale: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}

---
Generato automaticamente dal Gestionale Evolvi`
  }

  private static getScadenzaReminders(priorita: string): CalendarReminder[] {
    switch (priorita) {
      case 'alta':
        return [
          { method: 'email', minutes: 7 * 24 * 60 }, // 1 settimana prima
          { method: 'email', minutes: 3 * 24 * 60 }, // 3 giorni prima
          { method: 'email', minutes: 1 * 24 * 60 }, // 1 giorno prima
          { method: 'popup', minutes: 2 * 60 }       // 2 ore prima
        ]
      case 'media':
        return [
          { method: 'email', minutes: 3 * 24 * 60 }, // 3 giorni prima
          { method: 'email', minutes: 1 * 24 * 60 }, // 1 giorno prima
          { method: 'popup', minutes: 4 * 60 }       // 4 ore prima
        ]
      default:
        return [
          { method: 'email', minutes: 1 * 24 * 60 }, // 1 giorno prima
          { method: 'popup', minutes: 60 }           // 1 ora prima
        ]
    }
  }

  private static async saveEventReference(entityId: string, calendarEventId: string, eventType: string): Promise<void> {
    await supabase
      .from('scadenze_bandi_calendar_events')
      .insert({
        entity_id: entityId,
        calendar_event_id: calendarEventId,
        event_type: eventType,
        created_at: new Date().toISOString()
      })
  }

  // === GOOGLE CALENDAR API METHODS (da implementare) ===

  private static async createCalendarEvent(event: CalendarEvent): Promise<string | null> {
    // TODO: Implementare Google Calendar API
    console.log(`📅 Creazione evento calendar simulata:`, event.title)

    // Simulazione - ritorna un ID fittizio
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private static async updateCalendarEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<void> {
    // TODO: Implementare Google Calendar API
    console.log(`📅 Aggiornamento evento calendar simulato:`, eventId, updates.title)
  }

  private static async deleteCalendarEvent(eventId: string): Promise<void> {
    // TODO: Implementare Google Calendar API
    console.log(`📅 Eliminazione evento calendar simulata:`, eventId)
  }
}