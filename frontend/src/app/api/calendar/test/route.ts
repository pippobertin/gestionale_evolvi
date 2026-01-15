import { NextRequest, NextResponse } from 'next/server'
import { CalendarService } from '@/lib/notifications/calendarService'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Test creazione evento Calendar...')

    // Evento di test
    const testEvent = {
      title: '🧪 Test Evento - Gestionale Evolvi',
      description: 'Questo è un evento di test creato automaticamente dal sistema di notifiche.\n\nSe vedi questo evento, significa che l\'integrazione con Google Calendar funziona correttamente!',
      start: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // Tra 1 ora
      end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // Tra 2 ore
      allDay: false,
      reminders: [
        { method: 'email' as const, minutes: 15 },
        { method: 'popup' as const, minutes: 5 }
      ],
      attendees: [],
      location: 'Gestionale Evolvi - Test',
      metadata: {
        type: 'meeting' as const
      }
    }

    // Testa la creazione
    const eventId = await CalendarService.createScadenzaEvent({
      id: 'test-scadenza-123',
      titolo: 'Test Scadenza Gestionale',
      descrizione: 'Test automatico sistema notifiche',
      dataScadenza: testEvent.start,
      priorita: 'media',
      clienteNome: 'Cliente Test',
      progettoTitolo: 'Progetto Test',
      responsabileEmail: 'test@blmproject.it',
      note: 'Questo è un test del sistema Calendar'
    })

    if (eventId) {
      return NextResponse.json({
        success: true,
        message: 'Evento Calendar creato con successo!',
        eventId,
        eventDetails: {
          title: testEvent.title,
          start: testEvent.start,
          end: testEvent.end
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Errore creazione evento Calendar'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Errore test Calendar API:', error)

    return NextResponse.json({
      success: false,
      error: 'Errore interno del server',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 })
  }
}