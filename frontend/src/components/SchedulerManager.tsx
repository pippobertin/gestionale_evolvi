'use client'

import { useState, useEffect } from 'react'
import { Play, Square, RotateCcw, Settings, Clock, Mail, Calendar } from 'lucide-react'

interface SchedulerStatus {
  active: boolean
  runningJobs: number
  config: {
    scadenzeNotifications: {
      enabled: boolean
      interval: number
      times: string[]
    }
    weeklyDigest: {
      enabled: boolean
      dayOfWeek: number
      time: string
    }
    emailQueue: {
      enabled: boolean
      interval: number
      batchSize: number
    }
  }
  nextScadenzeCheck: string | null
  nextWeeklyDigest: string | null
}

export default function SchedulerManager() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [tempConfig, setTempConfig] = useState<any>(null)

  const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/notifications/scheduler')
      const data = await response.json()
      if (data.success) {
        setStatus(data.data.status)
        setTempConfig(data.data.config)
      }
    } catch (error) {
      console.error('Errore recupero status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSchedulerAction = async (action: string, config?: any) => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/notifications/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, config })
      })

      const data = await response.json()
      if (data.success) {
        await fetchStatus() // Aggiorna status
      } else {
        alert(`Errore: ${data.error}`)
      }
    } catch (error) {
      console.error('Errore azione scheduler:', error)
      alert('Errore durante l\'operazione')
    } finally {
      setActionLoading(false)
    }
  }

  const handleManualCheck = async () => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/notifications/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'manual_check' })
      })

      const data = await response.json()
      if (data.success) {
        alert('Controllo manuale completato con successo!')
        await fetchStatus()
      } else {
        alert(`Errore: ${data.error}`)
      }
    } catch (error) {
      console.error('Errore controllo manuale:', error)
      alert('Errore durante il controllo manuale')
    } finally {
      setActionLoading(false)
    }
  }

  const updateConfig = (path: string, value: any) => {
    const keys = path.split('.')
    const newConfig = { ...tempConfig }
    let current = newConfig
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]]
    }
    current[keys[keys.length - 1]] = value
    setTempConfig(newConfig)
  }

  const saveConfig = () => {
    handleSchedulerAction('update_config', tempConfig)
    setShowConfig(false)
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // Aggiorna ogni 30 secondi
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Caricamento scheduler...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Clock className="mr-2 h-5 w-5" />
            Status Scheduler Notifiche
          </h3>

          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
              status?.active
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {status?.active ? 'Attivo' : 'Inattivo'}
            </span>
            {status?.active && (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                {status.runningJobs} job attivi
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => handleSchedulerAction('start')}
            disabled={actionLoading || status?.active}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <Play className="mr-2 h-4 w-4" />
            Avvia
          </button>

          <button
            onClick={() => handleSchedulerAction('stop')}
            disabled={actionLoading || !status?.active}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <Square className="mr-2 h-4 w-4" />
            Ferma
          </button>

          <button
            onClick={() => handleSchedulerAction('restart')}
            disabled={actionLoading}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Riavvia
          </button>

          <button
            onClick={handleManualCheck}
            disabled={actionLoading}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <Clock className="mr-2 h-4 w-4" />
            Controllo Manuale
          </button>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md flex items-center"
          >
            <Settings className="mr-2 h-4 w-4" />
            Configurazione
          </button>
        </div>

        {/* Next Executions */}
        {status?.active && (
          <div className="grid md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
            <div>
              <p className="font-semibold text-blue-800 mb-1">🔔 Prossime notifiche scadenze:</p>
              <p className="text-blue-600 text-sm">
                {status.nextScadenzeCheck || 'Non programmate'}
              </p>
            </div>
            <div>
              <p className="font-semibold text-blue-800 mb-1">📊 Prossimo digest settimanale:</p>
              <p className="text-blue-600 text-sm">
                {status.nextWeeklyDigest || 'Non programmato'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Configuration Panel */}
      {showConfig && tempConfig && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="text-lg font-semibold mb-4 flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Configurazione Scheduler
          </h4>

          <div className="space-y-6">
            {/* Scadenze Notifications */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium flex items-center">
                  <Mail className="mr-2 h-4 w-4" />
                  Notifiche Scadenze
                </h5>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempConfig.scadenzeNotifications.enabled}
                    onChange={(e) =>
                      updateConfig('scadenzeNotifications.enabled', e.target.checked)
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {tempConfig.scadenzeNotifications.enabled && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Intervallo controllo (minuti)
                    </label>
                    <input
                      type="number"
                      value={tempConfig.scadenzeNotifications.interval}
                      onChange={(e) =>
                        updateConfig('scadenzeNotifications.interval', parseInt(e.target.value))
                      }
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Orari di invio (HH:mm, separati da virgola)
                    </label>
                    <input
                      value={tempConfig.scadenzeNotifications.times.join(', ')}
                      onChange={(e) =>
                        updateConfig('scadenzeNotifications.times',
                          e.target.value.split(',').map(t => t.trim()))
                      }
                      placeholder="09:00, 14:00, 18:00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Weekly Digest */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium flex items-center">
                  <Calendar className="mr-2 h-4 w-4" />
                  Digest Settimanale
                </h5>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempConfig.weeklyDigest.enabled}
                    onChange={(e) =>
                      updateConfig('weeklyDigest.enabled', e.target.checked)
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {tempConfig.weeklyDigest.enabled && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Giorno della settimana
                    </label>
                    <select
                      value={tempConfig.weeklyDigest.dayOfWeek}
                      onChange={(e) =>
                        updateConfig('weeklyDigest.dayOfWeek', parseInt(e.target.value))
                      }
                      className="border rounded px-3 py-2"
                    >
                      {dayNames.map((day, index) => (
                        <option key={index} value={index}>{day}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Ora di invio (HH:mm)
                    </label>
                    <input
                      value={tempConfig.weeklyDigest.time}
                      onChange={(e) => updateConfig('weeklyDigest.time', e.target.value)}
                      placeholder="08:00"
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Email Queue */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium">Processamento Coda Email</h5>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempConfig.emailQueue.enabled}
                    onChange={(e) =>
                      updateConfig('emailQueue.enabled', e.target.checked)
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {tempConfig.emailQueue.enabled && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Intervallo (minuti)
                    </label>
                    <input
                      type="number"
                      value={tempConfig.emailQueue.interval}
                      onChange={(e) =>
                        updateConfig('emailQueue.interval', parseInt(e.target.value))
                      }
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Batch size
                    </label>
                    <input
                      type="number"
                      value={tempConfig.emailQueue.batchSize}
                      onChange={(e) =>
                        updateConfig('emailQueue.batchSize', parseInt(e.target.value))
                      }
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end mt-6">
            <button
              onClick={saveConfig}
              disabled={actionLoading}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Salva Configurazione
            </button>
          </div>
        </div>
      )}
    </div>
  )
}