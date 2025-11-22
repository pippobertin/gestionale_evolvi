import { NextRequest, NextResponse } from 'next/server'
import { NotificationScheduler } from '@/lib/notifications/scheduler'
import { NotificationService } from '@/lib/notifications/notificationService'
import { EmailService } from '@/lib/notifications/emailService'

export async function POST(request: NextRequest) {
  try {
    const { type } = await request.json()

    switch (type) {
      case 'scadenze':
        await NotificationService.processScadenzeNotifications()
        return NextResponse.json({
          success: true,
          message: 'Notifiche scadenze processate con successo'
        })

      case 'weekly_digest':
        await NotificationService.sendWeeklyDigests()
        return NextResponse.json({
          success: true,
          message: 'Digest settimanali inviati con successo'
        })

      case 'email_queue':
        await EmailService.processEmailQueue()
        return NextResponse.json({
          success: true,
          message: 'Coda email processata con successo'
        })

      case 'manual_check':
        await NotificationScheduler.runManualCheck()
        return NextResponse.json({
          success: true,
          message: 'Controllo manuale completato con successo'
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Tipo di processamento non valido'
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Errore processamento notifiche:', error)
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const status = NotificationScheduler.getStatus()
    return NextResponse.json({
      success: true,
      data: status
    })
  } catch (error) {
    console.error('Errore recupero status:', error)
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}