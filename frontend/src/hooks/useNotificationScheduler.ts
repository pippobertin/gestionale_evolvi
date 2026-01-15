'use client'

import { useEffect, useState } from 'react'

interface SchedulerStatus {
  active: boolean
  lastCheck: string | null
  runningJobs: number
  nextScadenzeCheck: string | null
  nextWeeklyDigest: string | null
}

export function useNotificationScheduler() {
  const [isActive, setIsActive] = useState(false)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [status, setStatus] = useState<SchedulerStatus>({
    active: false,
    lastCheck: null,
    runningJobs: 0,
    nextScadenzeCheck: null,
    nextWeeklyDigest: null
  })

  useEffect(() => {
    // Inizializza comunicando solo con il server
    const initializeScheduler = async () => {
      try {
        console.log('🚀 Inizializzazione automatica NotificationScheduler (server-side)...')

        // Avvia il server-side scheduler
        const response = await fetch('/api/notifications/scheduler/health', {
          method: 'POST'
        })

        if (response.ok) {
          const data = await response.json()
          setIsActive(data.success || data.serverSchedulerActive || false)
          setLastCheck(new Date())
          console.log('✅ NotificationScheduler server-side attivato')
        } else {
          console.warn('⚠️ Errore attivazione scheduler:', response.status)
        }
      } catch (error) {
        console.error('❌ Errore avvio automatico scheduler:', error)
      }
    }

    initializeScheduler()

    // Health check periodico (ogni 5 minuti) - solo comunicazione con server
    const healthCheckInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/notifications/scheduler/health', {
          method: 'POST'
        })

        if (response.ok) {
          const data = await response.json()
          setIsActive(data.success || data.serverSchedulerActive || false)
          setLastCheck(new Date())

          // Aggiorna status
          try {
            const statusResponse = await fetch('/api/notifications/scheduler/status')
            if (statusResponse.ok) {
              const statusData = await statusResponse.json()
              setStatus({
                active: statusData.active || false,
                lastCheck: statusData.lastCheck || null,
                runningJobs: statusData.runningJobs || 0,
                nextScadenzeCheck: statusData.nextScadenzeCheck || null,
                nextWeeklyDigest: statusData.nextWeeklyDigest || null
              })
            }
          } catch (statusError) {
            console.warn('⚠️ Errore aggiornamento status:', statusError)
          }
        } else {
          setIsActive(false)
        }
      } catch (error) {
        console.error('❌ Errore health check scheduler:', error)
        setIsActive(false)
      }
    }, 5 * 60 * 1000) // Ogni 5 minuti

    // Cleanup
    return () => {
      clearInterval(healthCheckInterval)
    }
  }, [])

  // Funzione per riavvio manuale
  const restart = async () => {
    try {
      console.log('🔄 Riavvio manuale scheduler...')

      const response = await fetch('/api/notifications/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' })
      })

      if (response.ok) {
        setIsActive(true)
        setLastCheck(new Date())
        console.log('✅ Scheduler riavviato')
      }
    } catch (error) {
      console.error('❌ Errore riavvio scheduler:', error)
    }
  }

  return {
    isActive,
    lastCheck,
    restart,
    status
  }
}