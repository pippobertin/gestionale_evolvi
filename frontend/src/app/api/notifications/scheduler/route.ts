import { NextRequest, NextResponse } from 'next/server'

// Variabili globali per gestire lo scheduler server-side
declare global {
  var serverScheduler: {
    interval: NodeJS.Timeout | null
    active: boolean
    startTime: string
  } | undefined
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()

    let result = { success: true, message: '' }

    switch (action) {
      case 'start':
        await startServerScheduler()
        result.message = 'Scheduler server-side avviato'
        break

      case 'stop':
        stopServerScheduler()
        result.message = 'Scheduler server-side fermato'
        break

      case 'restart':
        stopServerScheduler()
        await startServerScheduler()
        result.message = 'Scheduler server-side riavviato'
        break

      case 'run_manual':
        await runManualNotifications()
        result.message = 'Esecuzione manuale completata'
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Azione non riconosciuta'
        }, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Errore controllo scheduler:', error)

    return NextResponse.json({
      success: false,
      error: 'Errore controllo scheduler'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const scheduler = global.serverScheduler || { interval: null, active: false, startTime: new Date().toISOString() }

    // Struttura compatibile con il SchedulerManager
    const defaultConfig = {
      scadenzeNotifications: {
        enabled: true,
        interval: 60,
        times: ['09:00', '14:00', '18:00']
      },
      weeklyDigest: {
        enabled: true,
        dayOfWeek: 1,
        time: '08:00'
      },
      emailQueue: {
        enabled: true,
        interval: 5,
        batchSize: 10
      }
    }

    // Calcola prossime esecuzioni
    const now = new Date()
    const targetHours = [9, 14, 18]
    let nextScadenzeCheck = null

    for (const hour of targetHours) {
      const nextTime = new Date(now)
      nextTime.setHours(hour, 0, 0, 0)
      if (nextTime > now) {
        nextScadenzeCheck = nextTime.toLocaleString('it-IT')
        break
      }
    }

    if (!nextScadenzeCheck) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      tomorrow.setHours(9, 0, 0, 0)
      nextScadenzeCheck = tomorrow.toLocaleString('it-IT')
    }

    const currentDay = now.getDay()
    let daysUntilMonday = (1 - currentDay + 7) % 7 || 7
    if (currentDay === 1 && now.getHours() < 8) {
      daysUntilMonday = 0
    }
    const nextMonday = new Date(now.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000)
    nextMonday.setHours(8, 0, 0, 0)

    return NextResponse.json({
      success: true,
      data: {
        status: {
          active: scheduler.active,
          runningJobs: scheduler.active ? 1 : 0,
          nextScadenzeCheck,
          nextWeeklyDigest: nextMonday.toLocaleString('it-IT')
        },
        config: defaultConfig
      }
    })
  } catch (error) {
    console.error('❌ Errore ottenimento status scheduler:', error)

    return NextResponse.json({
      success: false,
      error: 'Errore ottenimento status scheduler'
    }, { status: 500 })
  }
}

async function startServerScheduler() {
  if (!global.serverScheduler) {
    global.serverScheduler = {
      interval: null,
      active: false,
      startTime: new Date().toISOString()
    }
  }

  if (global.serverScheduler.active) {
    return // Già attivo
  }

  const { NotificationService } = await import('@/lib/notifications/notificationService')

  const runScheduledTasks = async () => {
    try {
      console.log('⏰ Esecuzione task schedulati...')

      const now = new Date()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()

      // Esegui notifiche negli orari configurati
      const targetHours = [9, 14, 18]
      if (targetHours.includes(currentHour) && currentMinute <= 5) {
        console.log(`🔔 Processamento notifiche scadenze ore ${currentHour}:${currentMinute}`)
        await NotificationService.processScadenzeNotifications()
      }

      // Digest settimanale (lunedì alle 8:00)
      if (now.getDay() === 1 && currentHour === 8 && currentMinute <= 5) {
        console.log('📊 Invio digest settimanale')
        await NotificationService.sendWeeklyDigests()
      }

    } catch (error) {
      console.error('❌ Errore task schedulati:', error)
    }
  }

  // Avvia interval ogni 5 minuti
  global.serverScheduler.interval = setInterval(runScheduledTasks, 5 * 60 * 1000)
  global.serverScheduler.active = true

  // Esegui una volta immediatamente
  await runScheduledTasks()

  console.log('✅ Server scheduler avviato')
}

function stopServerScheduler() {
  if (global.serverScheduler?.interval) {
    clearInterval(global.serverScheduler.interval)
    global.serverScheduler.interval = null
    global.serverScheduler.active = false
    console.log('🛑 Server scheduler fermato')
  }
}

async function runManualNotifications() {
  try {
    const { NotificationService } = await import('@/lib/notifications/notificationService')

    console.log('🔄 Esecuzione manuale notifiche...')
    await NotificationService.processScadenzeNotifications()
    console.log('✅ Esecuzione manuale completata')
  } catch (error) {
    console.error('❌ Errore esecuzione manuale:', error)
    throw error
  }
}