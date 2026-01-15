import { NextResponse } from 'next/server'

// Variabili globali per tracciare stato scheduler
declare global {
  var schedulerStatus: {
    active: boolean
    lastCheck: string | null
    runningJobs: number
    startTime: string
    nextScadenzeCheck: string | null
    nextWeeklyDigest: string | null
  } | undefined
}

export async function GET() {
  try {
    const status = global.schedulerStatus || {
      active: false,
      lastCheck: null,
      runningJobs: 0,
      startTime: new Date().toISOString(),
      nextScadenzeCheck: null,
      nextWeeklyDigest: null
    }

    // Calcola prossime esecuzioni
    const now = new Date()

    // Prossimo check scadenze (9:00, 14:00, 18:00)
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
      // Prossimo 9:00 di domani
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      tomorrow.setHours(9, 0, 0, 0)
      nextScadenzeCheck = tomorrow.toLocaleString('it-IT')
    }

    // Prossimo digest settimanale (lunedì 8:00)
    let nextWeeklyDigest = null
    const currentDay = now.getDay()
    let daysUntilMonday = (1 - currentDay + 7) % 7 || 7

    if (currentDay === 1 && now.getHours() < 8) {
      daysUntilMonday = 0 // Oggi stesso se lunedì prima delle 8
    }

    const nextMonday = new Date(now.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000)
    nextMonday.setHours(8, 0, 0, 0)
    nextWeeklyDigest = nextMonday.toLocaleString('it-IT')

    const response = {
      active: status.active,
      lastCheck: status.lastCheck,
      runningJobs: status.runningJobs,
      uptime: status.startTime ? Date.now() - new Date(status.startTime).getTime() : 0,
      nextScadenzeCheck,
      nextWeeklyDigest
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Errore status scheduler:', error)

    return NextResponse.json({
      active: false,
      lastCheck: null,
      runningJobs: 0,
      uptime: 0,
      nextScadenzeCheck: null,
      nextWeeklyDigest: null,
      error: 'Errore ottenimento status'
    }, { status: 500 })
  }
}