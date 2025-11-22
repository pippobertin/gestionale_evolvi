'use client'

import { useState, useEffect } from 'react'
import { Mail, CheckCircle, AlertCircle, FolderOpen } from 'lucide-react'
import { useGoogleDriveStatus } from '@/hooks/useGoogleDriveStatus'
import GoogleDriveDebug from './GoogleDriveDebug'

interface GmailStatus {
  configured: boolean
  email?: string
  lastTest?: string
  error?: string
}

export default function GmailSetup() {
  const [status, setStatus] = useState<GmailStatus>({ configured: false })
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const { isConnected: isDriveConnected, loading: driveLoading, error: driveError } = useGoogleDriveStatus()

  const checkGmailStatus = async () => {
    try {
      const response = await fetch('/api/gmail/status')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Errore controllo Gmail status:', error)
    }
  }

  const initializeGmail = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/gmail')
      const data = await response.json()

      if (data.success && data.authUrl) {
        window.location.href = data.authUrl
      } else {
        alert('Errore generazione URL autorizzazione Gmail')
      }
    } catch (error) {
      console.error('Errore inizializzazione Gmail:', error)
      alert('Errore durante l\'inizializzazione Gmail')
    } finally {
      setLoading(false)
    }
  }

  const testGmailConnection = async () => {
    setTestLoading(true)
    try {
      const response = await fetch('/api/gmail/test', { method: 'POST' })
      const data = await response.json()

      if (data.success) {
        alert('✅ Test Gmail completato con successo!')
        await checkGmailStatus()
      } else {
        alert(`❌ Test Gmail fallito: ${data.error}`)
      }
    } catch (error) {
      console.error('Errore test Gmail:', error)
      alert('Errore durante il test Gmail')
    } finally {
      setTestLoading(false)
    }
  }

  useEffect(() => {
    checkGmailStatus()

    // Controlla parametri URL per feedback autorizzazione
    const urlParams = new URLSearchParams(window.location.search)
    const gmailSuccess = urlParams.get('gmail_success')
    const gmailError = urlParams.get('gmail_error')

    if (gmailSuccess) {
      alert('✅ Gmail configurato con successo!')
      // Rimuovi parametro dall'URL
      window.history.replaceState({}, '', window.location.pathname)
      checkGmailStatus()
    }

    if (gmailError) {
      alert(`❌ Errore configurazione Gmail: ${gmailError}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Mail className="mr-2 h-5 w-5" />
          Configurazione Google API
        </h3>

        <div className="flex items-center space-x-2">
          {status.configured ? (
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center">
              <CheckCircle className="mr-1 h-3 w-3" />
              Configurato
            </span>
          ) : (
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 flex items-center">
              <AlertCircle className="mr-1 h-3 w-3" />
              Non Configurato
            </span>
          )}
        </div>
      </div>

      {status.configured ? (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2">✅ Gmail Configurato</h4>
            {status.email && (
              <p className="text-green-600 text-sm mb-2">
                Account: <strong>{status.email}</strong>
              </p>
            )}
            {status.lastTest && (
              <p className="text-green-600 text-sm">
                Ultimo test: {new Date(status.lastTest).toLocaleString('it-IT')}
              </p>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={testGmailConnection}
              disabled={testLoading}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testLoading ? 'Test in corso...' : '🧪 Test Connessione'}
            </button>

            <button
              onClick={initializeGmail}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              🔄 Riconfigura
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">⚙️ Configurazione Necessaria</h4>
            <p className="text-yellow-600 text-sm mb-3">
              Per inviare email reali tramite Gmail API, è necessario configurare l'autorizzazione.
            </p>
            <p className="text-yellow-600 text-sm">
              <strong>Account email:</strong> info@blmproject.com
            </p>
          </div>

          {status.error && (
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-red-600 text-sm">
                <strong>Errore:</strong> {status.error}
              </p>
            </div>
          )}

          <button
            onClick={initializeGmail}
            disabled={loading}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Inizializzazione...' : '🚀 Configura Gmail API'}
          </button>

          <div className="text-sm text-gray-500">
            <p className="mb-1"><strong>Passaggi:</strong></p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Clicca "Configura Gmail API"</li>
              <li>Autorizza l'accesso con account info@blmproject.com</li>
              <li>Conferma i permessi richiesti</li>
              <li>Verrai reindirizzato al sistema</li>
            </ol>
          </div>
        </div>
      )}

      {/* Sezione Google Drive */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <FolderOpen className="mr-2 h-5 w-5" />
            Configurazione Google Drive
          </h3>

          <div className="flex items-center space-x-2">
            {driveLoading ? (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 flex items-center">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-1"></div>
                Controllo...
              </span>
            ) : isDriveConnected ? (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center">
                <CheckCircle className="mr-1 h-3 w-3" />
                Connesso
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 flex items-center">
                <AlertCircle className="mr-1 h-3 w-3" />
                Disconnesso
              </span>
            )}
          </div>
        </div>

        {isDriveConnected ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">✅ Google Drive Connesso</h4>
              <p className="text-green-600 text-sm mb-2">
                Il sistema ha accesso ai Drive Condivisi per la gestione automatica delle cartelle bandi e progetti.
              </p>
              <p className="text-green-600 text-sm">
                <strong>Account:</strong> info@blmproject.com
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">⚙️ Google Drive Non Connesso</h4>
              <p className="text-yellow-600 text-sm mb-3">
                Per abilitare la sincronizzazione automatica delle cartelle bandi e progetti, è necessario configurare l'accesso a Google Drive.
              </p>
              <p className="text-yellow-600 text-sm mb-2">
                <strong>Funzionalità disponibili con Drive:</strong>
              </p>
              <ul className="text-yellow-600 text-sm list-disc list-inside space-y-1">
                <li>Creazione automatica cartelle bandi</li>
                <li>Organizzazione documenti per progetto</li>
                <li>Accesso al Drive Condiviso "Gestionale Evolvi"</li>
              </ul>
            </div>

            {driveError && (
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-red-600 text-sm">
                  <strong>Errore:</strong> {driveError}
                </p>
              </div>
            )}

            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">ℹ️ Come collegare Google Drive</h4>
              <p className="text-blue-600 text-sm mb-3">
                Google Drive utilizza gli stessi token di Gmail. Se hai già configurato Gmail, Drive dovrebbe funzionare automaticamente.
              </p>
              <p className="text-blue-600 text-sm">
                Se Drive non funziona, prova a riconfigurare Gmail (includerà automaticamente i permessi Drive).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sezione Debug Google Drive */}
      <div className="mt-6">
        <GoogleDriveDebug />
      </div>
    </div>
  )
}