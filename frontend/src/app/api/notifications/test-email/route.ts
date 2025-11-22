import { NextRequest, NextResponse } from 'next/server'
import { EmailService } from '@/lib/notifications/emailService'

export async function POST(request: NextRequest) {
  try {
    const { userEmail } = await request.json()

    if (!userEmail) {
      return NextResponse.json({
        success: false,
        error: 'Email utente richiesta'
      }, { status: 400 })
    }

    // Crea dati di test per una scadenza fittizia
    const testScadenza = {
      id: 'test-' + Date.now(),
      titolo: 'Test Notifica Email',
      dataScadenza: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Domani
      giorniRimanenti: 1,
      priorita: 'alta',
      clienteNome: 'Cliente di Test',
      progettoTitolo: 'Progetto di Test',
      responsabileEmail: userEmail
    }

    // Invia email di test
    await EmailService.createScadenzaAlert(testScadenza, 1)

    return NextResponse.json({
      success: true,
      message: 'Email di test accodata con successo! Controlla la coda email nell\'admin.'
    })

  } catch (error) {
    console.error('Errore invio email test:', error)
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}