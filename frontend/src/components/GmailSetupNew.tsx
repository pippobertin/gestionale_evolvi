'use client'

import { useState, useEffect } from 'react'
import { Mail, CheckCircle, AlertCircle, RefreshCw, ExternalLink, Cloud, CloudOff } from 'lucide-react'

interface GmailStatus {
  configured: boolean
  email?: string
  lastTest?: string
  error?: string
}

interface GoogleDriveStatus {
  connected: boolean
  serviceAccount?: string
  lastTest?: string
  error?: string
}

export default function GmailSetupNew() {
  const [status, setStatus] = useState<GmailStatus>({ configured: false })
  const [driveStatus, setDriveStatus] = useState<GoogleDriveStatus>({ connected: false })
  const [loading, setLoading] = useState(true)
  const [driveLoading, setDriveLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkGmailStatus = async () => {
    try {
      setError(null)
      const response = await fetch('/api/gmail/status')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      setStatus(data)
    } catch (error: any) {
      console.error('Error checking Gmail status:', error)
      setError(`Errore controllo status: ${error.message}`)
      setStatus({ configured: false })
    } finally {
      setLoading(false)
    }
  }

  const initializeGmail = async () => {
    setActionLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/gmail')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.authUrl) {
        // Apri in nuova finestra per evitare di perdere lo stato
        window.open(data.authUrl, 'gmail-auth', 'width=600,height=600')
      } else {
        setError('Errore generazione URL autorizzazione Gmail')
      }
    } catch (error: any) {
      console.error('Error initializing Gmail:', error)
      setError(`Errore inizializzazione: ${error.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  const checkGoogleDriveStatus = async () => {
    try {
      setDriveLoading(true)
      const response = await fetch('/api/debug-drive')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      setDriveStatus({
        connected: data.success,
        serviceAccount: data.serviceAccount,
        lastTest: new Date().toISOString(),
        error: data.success ? undefined : data.error
      })
    } catch (error: any) {
      console.error('Error checking Google Drive status:', error)
      setDriveStatus({
        connected: false,
        error: `Errore controllo status: ${error.message}`
      })
    } finally {
      setDriveLoading(false)
    }
  }

  const testGmailConnection = async () => {
    setActionLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/gmail/test', { method: 'POST' })
      const data = await response.json()

      if (data.success) {
        alert('✅ Test Gmail completato con successo!')
        await checkGmailStatus()
      } else {
        setError(`Test fallito: ${data.error || 'Errore sconosciuto'}`)
      }
    } catch (error: any) {
      console.error('Error testing Gmail:', error)
      setError(`Errore test: ${error.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  useEffect(() => {
    checkGmailStatus()
    checkGoogleDriveStatus()

    // Check for auth callback parameters
    const urlParams = new URLSearchParams(window.location.search)
    const gmailSuccess = urlParams.get('gmail_success')
    const gmailError = urlParams.get('gmail_error')

    if (gmailSuccess) {
      alert('✅ Gmail configurato con successo!')
      window.history.replaceState({}, '', window.location.pathname)
      checkGmailStatus()
    }

    if (gmailError) {
      setError(`Errore configurazione: ${gmailError}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  if (loading || driveLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Caricamento configurazione...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center">
          <Mail className="mr-2 h-5 w-5 text-red-500" />
          Configurazione Gmail API
        </h3>

        <div className="flex items-center space-x-2">
          {status.configured ? (
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center">
              <CheckCircle className="mr-1 h-3 w-3" />
              Configurato
            </span>
          ) : (
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 flex items-center">
              <AlertCircle className="mr-1 h-3 w-3" />
              Non Configurato
            </span>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="ml-3">
              <h4 className="text-sm font-medium text-red-800">Errore</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {status.configured ? (
        /* Configured State */
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Gmail Configurato Correttamente
            </h4>
            {status.email && (
              <p className="text-green-700 text-sm mb-2">
                <strong>Account:</strong> {status.email}
              </p>
            )}
            {status.lastTest && (
              <p className="text-green-700 text-sm">
                <strong>Ultimo test:</strong> {new Date(status.lastTest).toLocaleString('it-IT')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={testGmailConnection}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              {actionLoading ? 'Testing...' : 'Testa Connessione'}
            </button>

            <button
              onClick={initializeGmail}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <ExternalLink className="w-5 h-5" />
              )}
              {actionLoading ? 'Riautorizzazione...' : 'Riautorizza Gmail'}
            </button>

            <button
              onClick={checkGmailStatus}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Aggiorna Status
            </button>
          </div>
        </div>
      ) : (
        /* Not Configured State */
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Configurazione Richiesta</h4>
            <p className="text-blue-700 text-sm mb-4">
              Per utilizzare il client Gmail integrato, è necessario autenticare l'applicazione
              con il tuo account Google Workspace.
            </p>

            <div className="space-y-2 text-sm text-blue-700">
              <p><strong>Cosa succede quando clicchi "Configura Gmail":</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Si aprirà una finestra di Google per l'autenticazione</li>
                <li>Dovrai autorizzare l'accesso al tuo Gmail</li>
                <li>L'applicazione potrà leggere e inviare email per tuo conto</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={initializeGmail}
              disabled={actionLoading}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <ExternalLink className="w-5 h-5" />
              )}
              {actionLoading ? 'Inizializzazione...' : 'Configura Gmail'}
            </button>

            <button
              onClick={checkGmailStatus}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Controlla Status
            </button>
          </div>
        </div>
      )}

      {/* Google Drive Configuration */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center">
            <Cloud className="mr-2 h-5 w-5 text-blue-500" />
            Configurazione Google Drive API
          </h3>

          <div className="flex items-center space-x-2">
            {driveStatus.connected ? (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center">
                <CheckCircle className="mr-1 h-3 w-3" />
                Connesso
              </span>
            ) : (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 flex items-center">
                <CloudOff className="mr-1 h-3 w-3" />
                Disconnesso
              </span>
            )}
          </div>
        </div>

        {driveStatus.connected ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2 flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                Google Drive Connesso
              </h4>
              {driveStatus.serviceAccount && (
                <p className="text-green-700 text-sm mb-2">
                  <strong>Service Account:</strong> {driveStatus.serviceAccount}
                </p>
              )}
              {driveStatus.lastTest && (
                <p className="text-green-700 text-sm">
                  <strong>Ultimo test:</strong> {new Date(driveStatus.lastTest).toLocaleString('it-IT')}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={checkGoogleDriveStatus}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Aggiorna Status Drive
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <h4 className="font-medium text-orange-800 mb-2">Drive Non Configurato</h4>
              <p className="text-orange-700 text-sm mb-4">
                Google Drive è utilizzato per gestire automaticamente i documenti e gli allegati.
                {driveStatus.error && (
                  <span className="block mt-2 font-medium">Errore: {driveStatus.error}</span>
                )}
              </p>

              <div className="space-y-2 text-sm text-orange-700">
                <p><strong>Il Service Account Google Drive consente di:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Gestire automaticamente i documenti di progetto</li>
                  <li>Organizzare allegati in cartelle strutturate</li>
                  <li>Sincronizzare file tra il gestionale e Google Workspace</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={checkGoogleDriveStatus}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Controlla Status Drive
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h5 className="font-medium text-gray-900 mb-2">Informazioni</h5>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• Il client Gmail integrato ti permetterà di gestire le email direttamente dal gestionale</p>
          <p>• Google Drive permette la gestione automatica di documenti e allegati</p>
          <p>• Le credenziali vengono salvate in modo sicuro nel database</p>
          <p>• Puoi revocare l'accesso in qualsiasi momento dalle impostazioni Google</p>
        </div>
      </div>
    </div>
  )
}