'use client'

import { useState, useEffect } from 'react'
import { Mail, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react'

export default function UserGmailConnection() {
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [status, setStatus] = useState<{
    connected: boolean
    email: string | null
    connectedAt: string | null
  }>({
    connected: false,
    email: null,
    connectedAt: null
  })

  // Check URL parameters for success/error messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('gmail_success')
    const error = params.get('gmail_error')

    if (success) {
      // Refresh status after successful connection
      fetchStatus()
      // Clean URL
      window.history.replaceState({}, '', '/impostazioni')
    }

    if (error) {
      alert(`Errore connessione Gmail: ${error}`)
      // Clean URL
      window.history.replaceState({}, '', '/impostazioni')
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/gmail/status')
      const data = await response.json()

      if (data.success) {
        setStatus({
          connected: data.connected,
          email: data.email,
          connectedAt: data.connectedAt
        })
      }
    } catch (error) {
      console.error('Error fetching Gmail status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    try {
      setConnecting(true)
      const response = await fetch('/api/user/gmail/connect')
      const data = await response.json()

      if (data.success && data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl
      } else {
        alert('Errore durante la connessione')
      }
    } catch (error) {
      console.error('Error connecting Gmail:', error)
      alert('Errore durante la connessione')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Sei sicuro di voler disconnettere il tuo account Gmail?')) {
      return
    }

    try {
      setDisconnecting(true)
      const response = await fetch('/api/user/gmail/disconnect', {
        method: 'POST'
      })
      const data = await response.json()

      if (data.success) {
        setStatus({
          connected: false,
          email: null,
          connectedAt: null
        })
      } else {
        alert('Errore durante la disconnessione')
      }
    } catch (error) {
      console.error('Error disconnecting Gmail:', error)
      alert('Errore durante la disconnessione')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <Mail className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Account Gmail Personale</h3>
            <p className="text-sm text-gray-600">
              Collega il tuo account Gmail aziendale per inviare email
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {status.connected ? (
          <div className="space-y-4">
            {/* Connected Status */}
            <div className="flex items-start space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Gmail connesso</p>
                <p className="text-sm text-green-700 mt-1">
                  Account: <strong>{status.email}</strong>
                </p>
                {status.connectedAt && (
                  <p className="text-xs text-green-600 mt-1">
                    Connesso il {new Date(status.connectedAt).toLocaleDateString('it-IT', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1 text-sm text-blue-900">
                  <p className="font-medium mb-1">Come funziona</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>Le email che invii dal gestionale verranno inviate dal tuo account Gmail</li>
                    <li>Le risposte arriveranno direttamente nella tua casella Gmail</li>
                    <li>Puoi disconnettere l'account in qualsiasi momento</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Disconnect Button */}
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {disconnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Disconnessione...</span>
                </>
              ) : (
                <>
                  <X className="w-4 h-4" />
                  <span>Disconnetti Gmail</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Not Connected Status */}
            <div className="flex items-start space-x-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-gray-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Nessun account Gmail connesso</p>
                <p className="text-sm text-gray-600 mt-1">
                  Collega il tuo account Gmail aziendale per inviare email dal gestionale
                </p>
              </div>
            </div>

            {/* Benefits */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1 text-sm text-blue-900">
                  <p className="font-medium mb-2">Vantaggi della connessione:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>Email inviate dal tuo account personale aziendale</li>
                    <li>Risposte dirette nella tua casella Gmail</li>
                    <li>Sincronizzazione automatica con Gmail</li>
                    <li>Nessuna configurazione aggiuntiva richiesta</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Connect Button */}
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Connessione in corso...</span>
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  <span>Connetti account Gmail</span>
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center">
              Verrai reindirizzato a Google per autorizzare l'accesso al tuo account Gmail
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
