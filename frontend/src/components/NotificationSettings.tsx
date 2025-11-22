'use client'

import { useState, useEffect } from 'react'
import {
  Bell,
  Mail,
  Calendar,
  Clock,
  Save,
  TestTube,
  CheckCircle,
  AlertCircle,
  Moon,
  Users,
  X
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface NotificationSettings {
  // Email
  emailEnabled: boolean
  emailScadenze1Giorno: boolean
  emailScadenze3Giorni: boolean
  emailScadenze7Giorni: boolean
  emailScadenze15Giorni: boolean
  emailDigestSettimanale: boolean
  emailProgettiAssegnati: boolean

  // Destinatari aggiuntivi
  additionalRecipients: string[]

  // Calendar
  calendarEnabled: boolean
  calendarId: string
  calendarSyncScadenze: boolean
  calendarSyncMilestones: boolean

  // Orari non disturbare
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
}

export default function NotificationSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<NotificationSettings>({
    emailEnabled: true,
    emailScadenze1Giorno: true,
    emailScadenze3Giorni: true,
    emailScadenze7Giorni: true,
    emailScadenze15Giorni: true,
    emailDigestSettimanale: true,
    emailProgettiAssegnati: true,
    additionalRecipients: [],
    calendarEnabled: false,
    calendarId: '',
    calendarSyncScadenze: true,
    calendarSyncMilestones: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00'
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [error, setError] = useState('')
  const [newRecipient, setNewRecipient] = useState('')

  useEffect(() => {
    if (user) {
      loadSettings()
      loadAdditionalRecipients()
    }
  }, [user])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/notifications/settings?email=${encodeURIComponent(user?.email || '')}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Errore caricamento impostazioni')
      }

      if (result.data) {
        setSettings({
          emailEnabled: result.data.email_enabled,
          emailScadenze1Giorno: result.data.email_scadenze_1_giorno,
          emailScadenze3Giorni: result.data.email_scadenze_3_giorni,
          emailScadenze7Giorni: result.data.email_scadenze_7_giorni,
          emailScadenze15Giorni: result.data.email_scadenze_15_giorni,
          emailDigestSettimanale: result.data.email_digest_settimanale,
          emailProgettiAssegnati: result.data.email_progetti_assegnati,
          calendarEnabled: result.data.calendar_enabled,
          calendarId: result.data.calendar_id || '',
          calendarSyncScadenze: result.data.calendar_sync_scadenze,
          calendarSyncMilestones: result.data.calendar_sync_milestones,
          quietHoursEnabled: result.data.quiet_hours_enabled,
          quietHoursStart: result.data.quiet_hours_start,
          quietHoursEnd: result.data.quiet_hours_end
        })
      }
    } catch (err) {
      console.error('Errore caricamento impostazioni:', err)
      setError('Errore nel caricamento delle impostazioni')
    } finally {
      setLoading(false)
    }
  }

  const loadAdditionalRecipients = async () => {
    try {
      const response = await fetch('/api/notifications/additional-recipients')
      const result = await response.json()

      if (result.success) {
        setSettings(prev => ({
          ...prev,
          additionalRecipients: result.data || []
        }))
      }
    } catch (err) {
      console.error('Errore caricamento destinatari aggiuntivi:', err)
    }
  }

  const saveSettings = async () => {
    if (!user?.email) return

    try {
      setSaving(true)
      setError('')

      const requestBody = {
        userEmail: user.email,
        settings: {
          emailNotifications: {
            enabled: settings.emailEnabled,
            scadenze_1_giorno: settings.emailScadenze1Giorno,
            scadenze_3_giorni: settings.emailScadenze3Giorni,
            scadenze_7_giorni: settings.emailScadenze7Giorni,
            scadenze_15_giorni: settings.emailScadenze15Giorni,
            digest_settimanale: settings.emailDigestSettimanale,
            progetti_assegnati: settings.emailProgettiAssegnati
          },
          calendarSync: {
            enabled: settings.calendarEnabled,
            calendarId: settings.calendarId,
            syncScadenze: settings.calendarSyncScadenze,
            syncMilestones: settings.calendarSyncMilestones
          },
          orariNonDisturbare: {
            enabled: settings.quietHoursEnabled,
            start: settings.quietHoursStart,
            end: settings.quietHoursEnd
          }
        }
      }

      const response = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Errore salvataggio impostazioni')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)

    } catch (err) {
      console.error('Errore salvataggio impostazioni:', err)
      setError('Errore nel salvataggio delle impostazioni')
    } finally {
      setSaving(false)
    }
  }

  const testEmailNotification = async () => {
    if (!user?.email) return

    try {
      setTestingEmail(true)

      const response = await fetch('/api/notifications/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: user.email
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Errore invio email test')
      }

      alert('Email di test accodata con successo! Controlla la coda email nell\'admin.')

    } catch (err) {
      console.error('Errore invio email test:', err)
      setError('Errore nell\'invio dell\'email di test')
    } finally {
      setTestingEmail(false)
    }
  }

  const addRecipient = async () => {
    if (!newRecipient || !newRecipient.includes('@') || (settings.additionalRecipients || []).includes(newRecipient)) {
      return
    }

    try {
      const response = await fetch('/api/notifications/additional-recipients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newRecipient.toLowerCase().trim(),
          createdBy: user?.email
        })
      })

      const result = await response.json()

      if (result.success) {
        setSettings(prev => ({
          ...prev,
          additionalRecipients: [...(prev.additionalRecipients || []), newRecipient.toLowerCase().trim()]
        }))
        setNewRecipient('')
      } else {
        setError(result.error || 'Errore aggiunta destinatario')
      }
    } catch (err) {
      console.error('Errore aggiunta destinatario:', err)
      setError('Errore aggiunta destinatario')
    }
  }

  const removeRecipient = async (email: string) => {
    try {
      const response = await fetch(`/api/notifications/additional-recipients?email=${encodeURIComponent(email)}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        setSettings(prev => ({
          ...prev,
          additionalRecipients: (prev.additionalRecipients || []).filter(r => r !== email)
        }))
      } else {
        setError(result.error || 'Errore rimozione destinatario')
      }
    } catch (err) {
      console.error('Errore rimozione destinatario:', err)
      setError('Errore rimozione destinatario')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Impostazioni Notifiche</h2>
          <p className="text-gray-600 mt-1">Configura come e quando ricevere le notifiche</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={testEmailNotification}
            disabled={testingEmail || !settings.emailEnabled}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
          >
            <TestTube className="w-4 h-4" />
            {testingEmail ? 'Invio...' : 'Test Email'}
          </button>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg flex items-center gap-2"
          >
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : saved ? 'Salvato!' : 'Salva'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Email Notifications */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Notifiche Email</h3>
            <p className="text-sm text-gray-600">Ricevi alert e digest via email</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Enable Email */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Abilita notifiche email</h4>
              <p className="text-sm text-gray-600">Attiva/disattiva tutte le notifiche email</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailEnabled}
                onChange={(e) => setSettings({...settings, emailEnabled: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {settings.emailEnabled && (
            <>
              {/* Scadenze Alerts */}
              <div className="pl-6 space-y-3">
                <h5 className="font-medium text-gray-800">Alert Scadenze</h5>

                {[
                  { key: 'emailScadenze1Giorno', label: '1 giorno prima', desc: 'Notifica critica il giorno prima' },
                  { key: 'emailScadenze3Giorni', label: '3 giorni prima', desc: 'Notifica importante 3 giorni prima' },
                  { key: 'emailScadenze7Giorni', label: '7 giorni prima', desc: 'Promemoria una settimana prima' },
                  { key: 'emailScadenze15Giorni', label: '15 giorni prima', desc: 'Alert precoce due settimane prima' }
                ].map(item => (
                  <label key={item.key} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900">{item.label}</div>
                      <div className="text-sm text-gray-600">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings[item.key as keyof NotificationSettings] as boolean}
                      onChange={(e) => setSettings({...settings, [item.key]: e.target.checked})}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>

              {/* Other Email Settings */}
              <div className="pl-6 space-y-3">
                <h5 className="font-medium text-gray-800">Altri Alert</h5>

                {[
                  { key: 'emailDigestSettimanale', label: 'Digest settimanale', desc: 'Riepilogo scadenze ogni lunedì mattina' },
                  { key: 'emailProgettiAssegnati', label: 'Progetti assegnati', desc: 'Notifica quando ti viene assegnato un nuovo progetto' }
                ].map(item => (
                  <label key={item.key} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900">{item.label}</div>
                      <div className="text-sm text-gray-600">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings[item.key as keyof NotificationSettings] as boolean}
                      onChange={(e) => setSettings({...settings, [item.key]: e.target.checked})}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Destinatari Aggiuntivi */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Destinatari Aggiuntivi</h3>
            <p className="text-sm text-gray-600">Email che riceveranno TUTTE le notifiche di scadenze</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Aggiungi nuovo destinatario */}
          <div className="flex items-center gap-3">
            <input
              type="email"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              placeholder="Inserisci email destinatario (es: direzione@blmproject.com)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              onKeyPress={(e) => e.key === 'Enter' && addRecipient()}
            />
            <button
              onClick={addRecipient}
              disabled={!newRecipient || !newRecipient.includes('@')}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Aggiungi
            </button>
          </div>

          {/* Lista destinatari attuali */}
          {(settings.additionalRecipients || []).length > 0 ? (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">Destinatari configurati:</h4>
              {(settings.additionalRecipients || []).map((email, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-purple-600" />
                    <span className="text-gray-900">{email}</span>
                  </div>
                  <button
                    onClick={() => removeRecipient(email)}
                    className="text-red-600 hover:text-red-800"
                    title="Rimuovi destinatario"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-gray-600">Nessun destinatario aggiuntivo configurato</p>
              <p className="text-sm text-gray-500 mt-1">Le notifiche andranno solo ai responsabili specifici delle scadenze</p>
            </div>
          )}
        </div>
      </div>

      {/* Google Calendar Integration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-green-100 p-2 rounded-lg">
            <Calendar className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Google Calendar</h3>
            <p className="text-sm text-gray-600">Sincronizza scadenze e milestone con Google Calendar</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Enable Calendar */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Abilita sincronizzazione</h4>
              <p className="text-sm text-gray-600">Crea eventi automaticamente nel tuo Google Calendar</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.calendarEnabled}
                onChange={(e) => setSettings({...settings, calendarEnabled: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          {settings.calendarEnabled && (
            <>
              {/* Calendar ID */}
              <div className="pl-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID Google Calendar (opzionale)
                </label>
                <input
                  type="text"
                  value={settings.calendarId}
                  onChange={(e) => setSettings({...settings, calendarId: e.target.value})}
                  placeholder="esempio@gmail.com o calendar_id_specifico"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Lascia vuoto per usare il calendar principale
                </p>
              </div>

              {/* Sync Options */}
              <div className="pl-6 space-y-3">
                <h5 className="font-medium text-gray-800">Cosa sincronizzare</h5>

                {[
                  { key: 'calendarSyncScadenze', label: 'Scadenze', desc: 'Crea eventi per tutte le scadenze con promemoria' },
                  { key: 'calendarSyncMilestones', label: 'Milestone progetti', desc: 'Crea eventi per le milestone importanti dei progetti' }
                ].map(item => (
                  <label key={item.key} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900">{item.label}</div>
                      <div className="text-sm text-gray-600">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings[item.key as keyof NotificationSettings] as boolean}
                      onChange={(e) => setSettings({...settings, [item.key]: e.target.checked})}
                      className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Moon className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Orari Non Disturbare</h3>
            <p className="text-sm text-gray-600">Blocca le notifiche in determinati orari</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Enable Quiet Hours */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Abilita orari non disturbare</h4>
              <p className="text-sm text-gray-600">Impedisce l'invio di notifiche in determinati orari</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.quietHoursEnabled}
                onChange={(e) => setSettings({...settings, quietHoursEnabled: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {settings.quietHoursEnabled && (
            <div className="pl-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Ora inizio
                </label>
                <input
                  type="time"
                  value={settings.quietHoursStart}
                  onChange={(e) => setSettings({...settings, quietHoursStart: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Ora fine
                </label>
                <input
                  type="time"
                  value={settings.quietHoursEnd}
                  onChange={(e) => setSettings({...settings, quietHoursEnd: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Come funzionano le notifiche</h4>
            <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
              <li>Le email vengono inviate automaticamente in base alle tue impostazioni</li>
              <li>Gli eventi Google Calendar vengono sincronizzati una volta al giorno</li>
              <li>Le notifiche urgenti (1 giorno prima) ignorano gli orari non disturbare</li>
              <li>Puoi sempre disabilitare tutte le notifiche temporaneamente</li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  )
}