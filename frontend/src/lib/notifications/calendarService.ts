import { supabase } from '@/lib/supabase'

// ID del calendario aziendale BLM Project
const CALENDAR_ID = 'c_84801bd792d0c8193bcd88e3cdeea8abbd02027491a283188f6fb653cf846920@group.calendar.google.com'
const CALENDAR_ID_ENCODED = encodeURIComponent(CALENDAR_ID)

export interface CalendarEvent {
  title: string
  description: string
  start: string // ISO datetime
  end: string // ISO datetime
  allDay?: boolean
  reminders?: CalendarReminder[]
  attendees?: string[] // email addresses
  location?: string
  recurrence?: string[] // es. ['RRULE:FREQ=YEARLY']
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
      // Propaga errori di permesso al chiamante (es. 403)
      if (error instanceof Error && error.message === 'insufficient_permissions_calendar') {
        throw error
      }
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
   * Pulizia di eventi "orfani" (non tracciati in scadenze_bandi_calendar_events).
   *
   * In passato cercava gli eventi anche per titolo, o cancellava l'unico evento
   * del gestionale presente: con titoli uguali tra progetti diversi (es. "Primo SAL")
   * rischiava di eliminare eventi di altre scadenze sul calendario aziendale condiviso.
   * Ora elimina solo eventi che contengono esplicitamente l'ID della scadenza;
   * se non ne trova, lascia il calendario invariato (meglio un evento orfano
   * che la cancellazione di eventi altrui).
   */
  static async deleteOrphanCalendarEvents(scadenzaId: string, _scadenzaTitolo?: string): Promise<boolean> {
    try {
      if (!scadenzaId) return false

      const accessToken = await this.getAccessToken()
      if (!accessToken) {
        return false
      }

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID_ENCODED}/events?q=${encodeURIComponent(scadenzaId)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      const events = (data.items || []).filter((event: any) =>
        (event.description && event.description.includes(scadenzaId)) ||
        JSON.stringify(event.extendedProperties || {}).includes(scadenzaId)
      )

      if (events.length === 0) {
        console.warn('⚠️ Nessun evento calendario riconducibile con certezza alla scadenza: calendario non modificato')
        return false
      }

      for (const event of events) {
        await this.deleteCalendarEvent(event.id)
      }
      return true
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

  /**
   * Promemoria delle scadenze della pratica (Modello 231, PR.01 §4.3.6): un
   * evento 30 giorni prima, uno 10 giorni prima e uno il giorno della scadenza,
   * con responsabile di pratica e revisore invitati. Restituisce quanti eventi
   * ha creato (le date già passate si saltano).
   */
  static async creaPromemoria231(p: {
    entityId: string
    titolo: string
    descrizione: string
    scadenza: string // AAAA-MM-GG
    partecipanti: string[]
    giorni?: number[]
    tipoEvento?: string
  }): Promise<number> {
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
    const quando = (p.giorni || [30, 10, 0]).map(g => ({ giorni: g, prefisso: g === 0 ? 'Scadenza oggi' : `Tra ${g} giorni` }))
    let creati = 0
    for (const q of quando) {
      const giorno = new Date(`${p.scadenza}T09:00:00`)
      giorno.setDate(giorno.getDate() - q.giorni)
      if (giorno < oggi) continue
      const fine = new Date(giorno); fine.setMinutes(30)
      const id = await this.createCalendarEvent({
        title: `${q.prefisso}: ${p.titolo}`,
        description: `${p.descrizione}\n\nScadenza: ${p.scadenza.split('-').reverse().join('/')}\nPromemoria del Gestionale Evolvi (Modello 231).`,
        start: giorno.toISOString(),
        end: fine.toISOString(),
        reminders: [{ method: 'popup', minutes: 60 }],
        attendees: Array.from(new Set(p.partecipanti.filter(Boolean))),
        location: 'Gestionale Evolvi'
      })
      if (id) {
        await this.saveEventReference(p.entityId, id, p.tipoEvento || 'promemoria_231')
        creati++
      }
    }
    return creati
  }

  /**
   * Promemoria dell'uscita di una persona (modulo M.06): una settimana prima e il
   * giorno della fine dell'accesso, per compilare la checklist di uscita. Se la
   * data cambia, i promemoria precedenti si sostituiscono; senza data si tolgono.
   */
  static async promemoriaUscita231(p: { utenteId: string; nome: string; data: string | null; partecipanti: string[] }): Promise<number> {
    const { data: vecchi } = await supabase
      .from('scadenze_bandi_calendar_events')
      .select('calendar_event_id')
      .eq('entity_id', p.utenteId)
      .eq('event_type', 'uscita_231')
    for (const v of vecchi || []) {
      try { await this.deleteCalendarEvent(v.calendar_event_id) } catch { /* evento già rimosso */ }
    }
    if ((vecchi || []).length) {
      await supabase.from('scadenze_bandi_calendar_events').delete().eq('entity_id', p.utenteId).eq('event_type', 'uscita_231')
    }
    if (!p.data) return 0
    return this.creaPromemoria231({
      entityId: p.utenteId,
      titolo: `uscita di ${p.nome}`,
      descrizione: `Fine dell'accesso al gestionale di ${p.nome}. Compilare la checklist di uscita (Modello 231, Ingressi e uscite): account disattivati, persona tolta dagli elenchi delle deleghe, riconsegna, promemoria di riservatezza.`,
      scadenza: p.data.slice(0, 10),
      partecipanti: p.partecipanti,
      giorni: [7, 0],
      tipoEvento: 'uscita_231'
    })
  }

  /**
   * Promemoria ricorrenti del report semestrale all'OdV (M.05): il 1° e il 21
   * luglio per il primo semestre, il 1° e il 21 gennaio per il secondo, ogni anno.
   * Restituisce quanti eventi ha creato.
   */
  static async promemoriaReportOdv(partecipanti: string[]): Promise<number> {
    const anno = new Date().getFullYear()
    const prossima = (mese: number, giorno: number) => {
      const d = new Date(anno, mese - 1, giorno, 9, 0, 0)
      if (d < new Date()) d.setFullYear(anno + 1)
      return d
    }
    const eventi = [
      { mese: 7, giorno: 1, titolo: 'Report semestrale all\'OdV: da preparare entro il 31 luglio' },
      { mese: 7, giorno: 21, titolo: 'Report semestrale all\'OdV: mancano 10 giorni (31 luglio)' },
      { mese: 1, giorno: 1, titolo: 'Report semestrale all\'OdV: da preparare entro il 31 gennaio' },
      { mese: 1, giorno: 21, titolo: 'Report semestrale all\'OdV: mancano 10 giorni (31 gennaio)' }
    ]
    let creati = 0
    for (const e of eventi) {
      const inizio = prossima(e.mese, e.giorno)
      const fine = new Date(inizio); fine.setMinutes(30)
      const id = await this.createCalendarEvent({
        title: e.titolo,
        description: 'Gestionale Evolvi, Modello 231, scheda Report semestrale all\'OdV: la bozza è già precompilata con i dati dei registri. Ogni responsabile completa e conferma la propria sezione, poi l\'AU la invia.',
        start: inizio.toISOString(), end: fine.toISOString(),
        reminders: [{ method: 'popup', minutes: 60 }],
        attendees: Array.from(new Set(partecipanti.filter(Boolean))),
        location: 'Gestionale Evolvi',
        recurrence: ['RRULE:FREQ=YEARLY']
      })
      if (id) creati++
    }
    return creati
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
    const accessToken = await this.getAccessToken()
    if (!accessToken) {
      // Calendar non disponibile (token assente/scaduto), continua senza eventi
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
      location: event.location || '',
      ...(event.recurrence ? { recurrence: event.recurrence } : {})
    }

    try {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID_ENCODED}/events`, {
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
          // Permessi insufficienti: propaga al chiamante per mostrare avviso all'utente
          throw new Error('insufficient_permissions_calendar')
        }

        return null
      }

      const createdEvent = await response.json()
      console.log(`✅ Evento Calendar creato:`, createdEvent.id)
      return createdEvent.id

    } catch (error) {
      // Re-throw errori di permesso, silenzioso per altri errori di rete
      if (error instanceof Error && error.message === 'insufficient_permissions_calendar') {
        throw error
      }
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

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID_ENCODED}/events/${eventId}`, {
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

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID_ENCODED}/events/${eventId}`, {
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