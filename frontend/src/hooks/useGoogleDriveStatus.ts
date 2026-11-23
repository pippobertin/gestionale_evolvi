'use client'

import { useState, useEffect } from 'react'

interface GoogleDriveStatus {
  isConnected: boolean
  loading: boolean
  error?: string
}

export function useGoogleDriveStatus(attivo = true): GoogleDriveStatus {
  const [status, setStatus] = useState<GoogleDriveStatus>({
    isConnected: false,
    loading: true
  })

  useEffect(() => {
    // Lo stato dell'account Google dello studio interessa solo agli amministratori
    if (!attivo) { setStatus({ isConnected: true, loading: false }); return }
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
    // Indicatore di stato: un controllo ogni 5 minuti basta (prima ogni 30 secondi per ogni scheda aperta)
    const interval = setInterval(checkGoogleStatus, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [attivo])

  return status
}