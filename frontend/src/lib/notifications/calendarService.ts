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
        title: `${priorityEmoji} ${scadenza.clienteNome} - ${scadenza.titolo}`,
        description: this.formatScadenzaDescription(scadenza),
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        reminders: this.getScadenzaReminders(scadenza.priorita),
        attendees: [scadenza.responsabileEmail, 'info@blmproject.com'],
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
        title: `${priorityEmoji} ${scadenza.clienteNome} - ${scadenza.titolo}`,
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
      console.log('🔍 Cerca evento calendario per entityId:', entityId, 'eventType:', eventType)

      const { data: eventRef, error } = await supabase
        .from('scadenze_bandi_calendar_events')
        .select('calendar_event_id')
        .eq('entity_id', entityId)
        .eq('event_type', eventType)
        .single()

      if (error) {
        console.log('⚠️ Errore ricerca evento calendario nel DB:', error)
        // Se la tabella non esiste o c'è un errore di struttura, non considerarlo successo
        if (error.code === 'PGRST116' || error.message?.includes('does not exist') || error.message?.includes('406')) {
          console.log('❌ Tabella calendar_events non esiste o non accessibile')
          return false // Forza la chiamata a deleteOrphanCalendarEvents
        }
        return true // Altri errori = già eliminato
      }

      if (!eventRef) {
        console.log('⚠️ Evento calendario non trovato nel DB per entityId:', entityId)
        return false // Non trovato = prova la ricerca orfani
      }

      console.log('🎯 Evento calendario trovato, ID:', eventRef.calendar_event_id)
      console.log('🗑️ Eliminazione evento da Google Calendar...')

      await this.deleteCalendarEvent(eventRef.calendar_event_id)

      // Rimuovi riferimento dal database
      await supabase
        .from('scadenze_bandi_calendar_events')
        .delete()
        .eq('entity_id', entityId)
        .eq('event_type', eventType)

      console.log('✅ Evento calendario eliminato completamente')
      return true

    } catch (error) {
      console.error('❌ Errore eliminazione evento calendar:', error)
      return false
    }
  }

  /**
   * Elimina tutti gli eventi calendario che contengono un ID scadenza specifico
   * Utile per eventi "orfani" non tracciati nel database
   */
  static async deleteOrphanCalendarEvents(scadenzaId: string, scadenzaTitolo?: string): Promise<boolean> {
    try {
      console.log('🧹 Pulizia eventi orfani per scadenza:', scadenzaId, 'titolo:', scadenzaTitolo)

      const accessToken = await this.getAccessToken()
      if (!accessToken) {
        console.error('❌ Access token non disponibile per pulizia eventi orfani')
        return false
      }

      // Prima cerca per ID scadenza
      let response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${scadenzaId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Errore ricerca eventi Calendar per ID:', response.status, errorText)
        return false
      }

      let data = await response.json()
      let events = data.items || []

      console.log(`🔍 Trovati ${events.length} eventi cercando per ID scadenza`)

      // Se non trova eventi per ID e abbiamo il titolo, cerca per titolo
      if (events.length === 0 && scadenzaTitolo) {
        console.log('🔍 Ricerca per titolo scadenza:', scadenzaTitolo)

        const encodedTitle = encodeURIComponent(scadenzaTitolo)
        response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${encodedTitle}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (response.ok) {
          data = await response.json()
          events = data.items || []
          console.log(`🔍 Trovati ${events.length} eventi cercando per titolo`)
        }
      }

      // Se ancora non trova, cerca eventi del Gestionale Evolvi
      if (events.length === 0) {
        console.log('🔍 Ricerca eventi Gestionale Evolvi generici...')

        response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?q=Gestionale+Evolvi`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (response.ok) {
          data = await response.json()
          events = data.items || []
          console.log(`🔍 Trovati ${events.length} eventi del Gestionale Evolvi`)

          // Filtra solo quelli che potrebbero essere della scadenza
          if (scadenzaTitolo) {
            events = events.filter((event: any) =>
              event.summary?.includes(scadenzaTitolo) ||
              event.description?.includes(scadenzaTitolo) ||
              (event.description && event.description.includes(scadenzaId))
            )
            console.log(`🎯 Filtrati a ${events.length} eventi potenzialmente collegati`)
          }
        }
      }

      let deletedCount = 0
      for (const event of events) {
        console.log('🔍 Controllo evento:', {
          id: event.id,
          summary: event.summary,
          description: event.description?.substring(0, 100) + '...'
        })

        // Controlla se l'evento è collegato alla scadenza
        const isRelated = (
          (event.description && event.description.includes(scadenzaId)) ||
          (scadenzaTitolo && event.summary && event.summary.includes(scadenzaTitolo)) ||
          (scadenzaTitolo && event.description && event.description.includes(scadenzaTitolo)) ||
          (event.location === 'Gestionale Evolvi' && events.length === 1) // Se è l'unico del gestionale
        )

        if (isRelated) {
          console.log('🗑️ Eliminazione evento collegato:', event.id)
          await this.deleteCalendarEvent(event.id)
          deletedCount++
        }
      }

      console.log(`✅ Eliminati ${deletedCount} eventi orfani`)
      return deletedCount > 0

    } catch (error) {
      console.error('❌ Errore pulizia eventi orfani:', error)
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
👤 Responsabile: ${scadenza.responsabileEmail}

${scadenza.note ? `📝 Note:\\n${scadenza.note}\\n\\n` : ''}🚀 Apri Gestionale: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}

---
📧 Evento condiviso con: info@blmproject.com`
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

  // === GOOGLE CALENDAR API METHODS ===

  private static async createCalendarEvent(event: CalendarEvent): Promise<string | null> {
    try {
      const accessToken = await this.getAccessToken()
      if (!accessToken) {
        // Calendar non disponibile, continua senza eventi
        return null
      }

      const calendarEvent = {
        summary: event.title,
        description: event.description,
        start: {
          dateTime: event.start,
          timeZone: 'Europe/Rome'
        },
        end: {
          dateTime: event.end,
          timeZone: 'Europe/Rome'
        },
        reminders: {
          useDefault: false,
          overrides: event.reminders?.map(r => ({
            method: r.method,
            minutes: r.minutes
          })) || []
        },
        attendees: event.attendees?.map(email => ({ email })) || [],
        location: event.location || ''
      }

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(calendarEvent)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Errore creazione evento Calendar:', response.status, errorText)

        if (response.status === 403) {
          throw new Error('insufficient_permissions_calendar')
        }

        return null
      }

      const createdEvent = await response.json()
      console.log(`✅ Evento Calendar creato:`, createdEvent.id)
      return createdEvent.id

    } catch (error) {
      console.error('❌ Errore chiamata Calendar API:', error)
      return null
    }
  }

  private static async updateCalendarEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<void> {
    try {
      const accessToken = await this.getAccessToken()
      if (!accessToken) {
        console.error('❌ Access token non disponibile per aggiornamento Calendar')
        return
      }

      const updateData: any = {}
      if (updates.title) updateData.summary = updates.title
      if (updates.description) updateData.description = updates.description
      if (updates.start) {
        updateData.start = {
          dateTime: updates.start,
          timeZone: 'Europe/Rome'
        }
      }
      if (updates.end) {
        updateData.end = {
          dateTime: updates.end,
          timeZone: 'Europe/Rome'
        }
      }
      if (updates.location) updateData.location = updates.location

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Errore aggiornamento evento Calendar:', response.status, errorText)
        return
      }

      console.log(`✅ Evento Calendar aggiornato:`, eventId)

    } catch (error) {
      console.error('❌ Errore aggiornamento Calendar API:', error)
    }
  }

  private static async deleteCalendarEvent(eventId: string): Promise<void> {
    try {
      const accessToken = await this.getAccessToken()
      if (!accessToken) {
        console.error('❌ Access token non disponibile per eliminazione Calendar')
        return
      }

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Errore eliminazione evento Calendar:', response.status, errorText)
        return
      }

      console.log(`✅ Evento Calendar eliminato:`, eventId)

    } catch (error) {
      console.error('❌ Errore eliminazione Calendar API:', error)
    }
  }

  // Helper per ottenere access token
  private static async getAccessToken(): Promise<string | null> {
    try {
      const response = await fetch('/api/calendar/token')
      if (!response.ok) {
        // Errore silenzioso per 401 (Calendar non configurato)
        if (response.status === 401) {
          console.warn('⚠️ Calendar API non configurato (ignorato)')
        } else {
          console.error('❌ Errore richiesta token Calendar:', response.status)
        }
        return null
      }

      const data = await response.json()
      if (data.success) {
        return data.accessToken
      }

      console.error('❌ Token Calendar non disponibile:', data.error)
      return null
    } catch (error) {
      console.error('❌ Errore recupero access token Calendar:', error)
      return null
    }
  }
}