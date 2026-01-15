'use client'

import { useNotificationScheduler } from '@/hooks/useNotificationScheduler'
import { ReactNode } from 'react'

interface AutoSchedulerProviderProps {
  children: ReactNode
}

export default function AutoSchedulerProvider({ children }: AutoSchedulerProviderProps) {
  // Il hook si occupa automaticamente dell'avvio e del mantenimento dello scheduler
  const { isActive, lastCheck } = useNotificationScheduler()

  // Opzionale: mostra un indicatore discreto dello stato (solo in dev)
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <>
      {children}

      {/* Indicatore discreto per sviluppatori (solo in dev mode) */}
      {isDev && (
        <div
          className="fixed bottom-4 right-4 z-50 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-75 hover:opacity-100 transition-opacity"
          title={`Scheduler: ${isActive ? 'Attivo' : 'Inattivo'} - Ultimo check: ${lastCheck?.toLocaleTimeString() || 'Mai'}`}
        >
          🔔 {isActive ? '✅' : '❌'}
        </div>
      )}
    </>
  )
}