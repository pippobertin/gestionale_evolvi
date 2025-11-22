'use client'

import { useState, useEffect } from 'react'

interface GoogleDriveStatus {
  isConnected: boolean
  loading: boolean
  error?: string
}

export function useGoogleDriveStatus(): GoogleDriveStatus {
  const [status, setStatus] = useState<GoogleDriveStatus>({
    isConnected: false,
    loading: true
  })

  useEffect(() => {
    const checkGoogleStatus = async () => {
      try {
        // Controlla se Gmail è configurato (che ora include anche Drive)
        const response = await fetch('/api/gmail/status')
        if (response.ok) {
          const gmailStatus = await response.json()
          setStatus({
            isConnected: gmailStatus.configured || false,
            loading: false,
            error: gmailStatus.error
          })
        } else {
          setStatus({
            isConnected: false,
            loading: false,
            error: 'Errore verifica status Google'
          })
        }
      } catch (error) {
        console.error('Errore verifica Google Drive:', error)
        setStatus({
          isConnected: false,
          loading: false,
          error: 'Errore di connessione'
        })
      }
    }

    checkGoogleStatus()

    // Ricontrolla ogni 30 secondi
    const interval = setInterval(checkGoogleStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  return status
}