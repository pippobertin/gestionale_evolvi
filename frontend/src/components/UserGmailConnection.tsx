'use client'

import { useState, useEffect } from 'react'
import { Mail, CheckCircle, AlertCircle, Loader2, X, Calendar, HardDrive, Globe } from 'lucide-react'

export default function UserGmailConnection() {
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [calendarTesting, setCalendarTesting] = useState(false)
  const [calendarOk, setCalendarOk] = useState<boolean | null>(null)
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
      fetchStatus()
      window.history.replaceState({}, '', '/impostazioni')
    }

    if (error) {
      alert(`Errore connessione Gmail: ${error}`)
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
        // If connected, test calendar access too
        if (data.connected) {
          testCalendar()
        }
      }
    } catch (error) {
      console.error('Error fetching Gmail status:', error)
    } finally {
      setLoading(false)
    }
  }

  const testCalendar = async () => {
    try {
      setCalendarTesting(true)
      const res = await fetch('/api/calendar/token')
      const data = await res.json()
      setCalendarOk(data.success === true)
    } catch {
      setCalendarOk(false)
    } finally {
      setCalendarTesting(false)
    }
  }

  const handleConnect = async () => {
    try {
      setConnecting(true)
      const response = await fetch('/api/user/gmail/connect')
      const data = await response.json()

      if (data.success && data.authUrl) {
        window.location.href = data.authUrl
      } else {
        alert(`Errore durante la connessione: ${data.error || 'Risposta non valida'}`)
      }
    } catch (error) {
      console.error('Error connecting Gmail:', error)
      alert(`Errore durante la connessione: ${error}`)
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Sei sicuro di voler disconnettere il tuo account Google? Gmail, Calendar e Drive personale verranno scollegati.')) {
      return
    }

    try {
      setDisconnecting(true)
      const response = await fetch('/api/user/gmail/disconnect', {
        method: 'POST'
      })
      const data = await response.json()

      if (data.success) {
        setStatus({ connected: false, email: null, connectedAt: null })
        setCalendarOk(null)
      } else {
        alert('Errore durante la disconnessione')
      }
    } catch (error) {
      console.error('Error disconnecting:', error)
      alert('Errore durante la disconnessione')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Connection Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-teal-100 rounded-lg flex items-center justify-center">
              <Globe className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Account Google</h3>
              <p className="text-sm text-gray-600">
                Connetti il tuo account Google per Gmail, Calendar e Drive
              </p>
            </div>
          </div>
        </div>

        <div className="p-4">
          {status.connected ? (
            <div className="space-y-4">
              {/* Connected Status */}
              <div className="flex items-start space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">Account Google connesso</p>
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

              {/* API Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Gmail */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Gmail</p>
                    <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Connesso
                    </p>
                  </div>
                </div>

                {/* Calendar */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Calendar</p>
                    {calendarTesting ? (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Verifica...
                      </p>
                    ) : calendarOk ? (
                      <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Connesso
                      </p>
                    ) : calendarOk === false ? (
                      <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Riconnetti
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Drive */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <HardDrive className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Drive</p>
                    <p className="text-xs text-gray-500 font-medium">Via service account</p>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="flex-1 text-sm text-blue-900">
                    <p className="font-medium mb-1">Servizi inclusi nella connessione</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                      <li>Gmail: invio e ricezione email dal gestionale</li>
                      <li>Calendar: sincronizzazione scadenze con Google Calendar</li>
                      <li>Drive: gestito centralmente dall'amministratore</li>
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
                    <span>Disconnetti account Google</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Not Connected Status */}
              <div className="flex items-start space-x-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Nessun account Google connesso</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Collega il tuo account Google aziendale per abilitare Gmail, Calendar e le altre integrazioni
                  </p>
                </div>
              </div>

              {/* Benefits */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="flex-1 text-sm text-blue-900">
                    <p className="font-medium mb-1">Collegando il tuo account ottieni:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                      <li>Email inviate dal tuo account Gmail aziendale</li>
                      <li>Sincronizzazione scadenze con Google Calendar</li>
                      <li>Risposte dirette nella tua casella Gmail</li>
                      <li>Nessuna configurazione aggiuntiva richiesta</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Connect Button */}
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connessione in corso...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    <span>Connetti account Google</span>
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                Verrai reindirizzato a Google per autorizzare l'accesso a Gmail e Calendar
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
