import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Access token non disponibile'
      }, { status: 401 })
    }

    console.log('🔍 Debug Calendar API - Test permessi e lista eventi')

    // Test 1: Lista eventi del calendario
    const listResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=50', {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`
      }
    })

    if (!listResponse.ok) {
      const errorText = await listResponse.text()
      console.error('❌ Errore lista eventi:', listResponse.status, errorText)
      return NextResponse.json({
        success: false,
        error: 'Errore lista eventi',
        details: errorText,
        status: listResponse.status
      }, { status: 500 })
    }

    const eventsData = await listResponse.json()
    console.log(`📅 Trovati ${eventsData.items?.length || 0} eventi nel calendario`)

    // Filtra eventi che contengono "Gestionale" o "TEST SCADENZA"
    const relevantEvents = eventsData.items?.filter((event: any) =>
      event.summary?.includes('Gestionale') ||
      event.summary?.includes('TEST SCADENZA') ||
      event.description?.includes('Scadenza:') ||
      event.location === 'Gestionale Evolvi'
    ) || []

    console.log(`🎯 Eventi rilevanti trovati: ${relevantEvents.length}`)

    const eventDetails = relevantEvents.map((event: any) => ({
      id: event.id,
      summary: event.summary,
      description: event.description?.substring(0, 200) + '...',
      start: event.start,
      end: event.end,
      location: event.location,
      creator: event.creator?.email
    }))

    return NextResponse.json({
      success: true,
      totalEvents: eventsData.items?.length || 0,
      relevantEvents: relevantEvents.length,
      events: eventDetails,
      accessTokenPresent: !!session.accessToken,
      tokenLength: session.accessToken?.length || 0
    })

  } catch (error) {
    console.error('❌ Errore debug Calendar API:', error)

    return NextResponse.json({
      success: false,
      error: 'Errore interno del server',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 })
  }
}