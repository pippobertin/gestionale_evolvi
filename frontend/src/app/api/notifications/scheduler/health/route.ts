import { NextResponse } from 'next/server'

// Variabile globale per tracciare lo stato del scheduler server-side
let serverSchedulerActive = false
let lastServerCheck = new Date()

export async function POST() {
  try {
    console.log('🔍 Health check server-side scheduler...')

    // Aggiorna timestamp ultimo check
    lastServerCheck = new Date()

    if (!serverSchedulerActive) {
      console.log('🚀 Avvio server-side scheduler...')

      // Avvia il processamento delle notifiche se non è già attivo
      await startServerScheduler()
      serverSchedulerActive = true
    }

    return NextResponse.json({
      success: true,
      serverSchedulerActive,
      lastServerCheck: lastServerCheck.toISOString(),
      message: 'Server scheduler health check completato'
    })

  } catch (error) {
    console.error('❌ Errore server scheduler health check:', error)

    return NextResponse.json({
      success: false,
      error: 'Errore health check server scheduler',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    serverSchedulerActive,
    lastServerCheck: lastServerCheck.toISOString(),
    uptime: Date.now() - lastServerCheck.getTime()
  })
}

// Funzione per avviare il scheduler server-side
async function startServerScheduler() {
  try {
    // Importa dinamicamente il servizio per evitare problemi di dipendenze circolari
    const { NotificationService } = await import('@/lib/notifications/notificationService')

    // Scheduler server-side che si esegue indipendentemente dal client
    const runScheduledTasks = async () => {
      try {
        console.log('⏰ Esecuzione task schedulati server-side...')

        const now = new Date()
        const currentHour = now.getHours()
        const currentMinute = now.getMinutes()

        // Esegui notifiche scadenze negli orari configurati (9:00, 14:00, 18:00)
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

        lastServerCheck = new Date()

      } catch (error) {
        console.error('❌ Errore task schedulati:', error)
      }
    }

    // Esegui ogni 5 minuti
    setInterval(runScheduledTasks, 5 * 60 * 1000)

    // Esegui immediatamente una volta
    await runScheduledTasks()

    console.log('✅ Server scheduler avviato')

  } catch (error) {
    console.error('❌ Errore avvio server scheduler:', error)
    throw error
  }
}

// Auto-start quando il modulo viene caricato (se in ambiente server)
if (typeof window === 'undefined') {
  // Solo server-side
  startServerScheduler().catch(console.error)
}