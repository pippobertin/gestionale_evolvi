import { NextRequest, NextResponse } from 'next/server'
import { NotificationScheduler } from '@/lib/notifications/scheduler'

export async function POST(request: NextRequest) {
  try {
    const { action, config } = await request.json()

    switch (action) {
      case 'start':
        NotificationScheduler.start(config)
        return NextResponse.json({
          success: true,
          message: 'Scheduler avviato con successo'
        })

      case 'stop':
        NotificationScheduler.stop()
        return NextResponse.json({
          success: true,
          message: 'Scheduler fermato con successo'
        })

      case 'restart':
        NotificationScheduler.start(config)
        return NextResponse.json({
          success: true,
          message: 'Scheduler riavviato con successo'
        })

      case 'update_config':
        NotificationScheduler.updateConfig(config)
        return NextResponse.json({
          success: true,
          message: 'Configurazione aggiornata con successo'
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Azione non valida'
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Errore gestione scheduler:', error)
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const status = NotificationScheduler.getStatus()
    const config = NotificationScheduler.getConfig()

    return NextResponse.json({
      success: true,
      data: {
        status,
        config
      }
    })
  } catch (error) {
    console.error('Errore recupero status scheduler:', error)
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}