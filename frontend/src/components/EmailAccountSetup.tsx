'use client'

import React, { useState, useEffect } from 'react'
import { Mail, Settings, CheckCircle, XCircle, Loader, Eye, EyeOff } from 'lucide-react'

// Hook per bloccare scroll del body quando modal è aperto
function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (isLocked) {
      // Salva stato corrente
      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = '15px'

      // Cleanup
      return () => {
        document.body.style.overflow = originalStyle
        document.body.style.paddingRight = '0px'
      }
    }
  }, [isLocked])
}

interface EmailProvider {
  id: string
  name: string
  icon: string
  config: {
    imap: { host: string; port: number; secure: boolean }
    smtp: { host: string; port: number; secure: boolean }
  }
}

const EMAIL_PROVIDERS: EmailProvider[] = [
  {
    id: 'aruba',
    name: 'Aruba',
    icon: '🏢',
    config: {
      imap: { host: 'imaps.aruba.it', port: 993, secure: true },
      smtp: { host: 'smtps.aruba.it', port: 465, secure: true }
    }
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '📬',
    config: {
      imap: { host: 'imap.gmail.com', port: 993, secure: true },
      smtp: { host: 'smtp.gmail.com', port: 587, secure: false }
    }
  },
  {
    id: 'outlook',
    name: 'Outlook',
    icon: '📧',
    config: {
      imap: { host: 'outlook.office365.com', port: 993, secure: true },
      smtp: { host: 'smtp-mail.outlook.com', port: 587, secure: false }
    }
  },
  {
    id: 'libero',
    name: 'Libero/TIM',
    icon: '📪',
    config: {
      imap: { host: 'imapmail.libero.it', port: 993, secure: true },
      smtp: { host: 'smtp.libero.it', port: 465, secure: true }
    }
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    icon: '💜',
    config: {
      imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
      smtp: { host: 'smtp.mail.yahoo.com', port: 587, secure: false }
    }
  }
]

interface EmailAccountSetupProps {
  onAccountCreated?: (account: any) => void
  onClose?: () => void
}

export default function EmailAccountSetup({ onAccountCreated, onClose }: EmailAccountSetupProps) {
  const [step, setStep] = useState<'provider' | 'credentials' | 'test' | 'success'>('provider')
  const [selectedProvider, setSelectedProvider] = useState<EmailProvider | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    // Configurazione personalizzata
    imapServer: '',
    imapPort: 993,
    imapSecure: true,
    smtpServer: '',
    smtpPort: 587,
    smtpSecure: false
  })

  // Stati
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleProviderSelect = (provider: EmailProvider | null) => {
    setSelectedProvider(provider)
    setIsCustom(provider === null)

    if (provider) {
      // Pre-compila configurazione
      setFormData(prev => ({
        ...prev,
        imapServer: provider.config.imap.host,
        imapPort: provider.config.imap.port,
        imapSecure: provider.config.imap.secure,
        smtpServer: provider.config.smtp.host,
        smtpPort: provider.config.smtp.port,
        smtpSecure: provider.config.smtp.secure
      }))
    }
  }

  const handleTestConnection = async () => {
    if (!formData.email || !formData.password) {
      setError('Email e password sono obbligatori')
      return
    }

    setTesting(true)
    setError('')
    setTestResults(null)

    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        provider: selectedProvider?.id,
        customConfig: isCustom ? {
          imapServer: formData.imapServer,
          imapPort: formData.imapPort,
          imapSecure: formData.imapSecure,
          smtpServer: formData.smtpServer,
          smtpPort: formData.smtpPort,
          smtpSecure: formData.smtpSecure
        } : null
      }

      const response = await fetch('/api/email/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      setTestResults(result.data)

      if (result.success) {
        setStep('test')
      } else {
        setError(result.message || 'Test connessione fallito')
      }

    } catch (err: any) {
      setError('Errore test connessione: ' + err.message)
    } finally {
      setTesting(false)
    }
  }

  const handleCreateAccount = async () => {
    setCreating(true)
    setError('')

    try {
      const payload = {
        name: formData.name || `${formData.email} (${selectedProvider?.name || 'Custom'})`,
        email: formData.email,
        password: formData.password,
        provider: selectedProvider?.id,
        customConfig: isCustom ? {
          imapServer: formData.imapServer,
          imapPort: formData.imapPort,
          imapSecure: formData.imapSecure,
          smtpServer: formData.smtpServer,
          smtpPort: formData.smtpPort,
          smtpSecure: formData.smtpSecure
        } : null
      }

      const response = await fetch('/api/email/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (result.success) {
        setStep('success')
        onAccountCreated?.(result.data)
      } else {
        setError(result.message || 'Errore creazione account')
      }

    } catch (err: any) {
      setError('Errore creazione account: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const renderProviderSelection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Seleziona Provider Email</h3>
        <p className="text-gray-600 text-sm">Scegli il tuo provider email per configurare automaticamente i server IMAP e SMTP</p>
      </div>

      {/* Provider predefiniti */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {EMAIL_PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            onClick={() => handleProviderSelect(provider)}
            className={`p-6 border-2 rounded-xl text-center transition-all duration-200 hover:shadow-md ${
              selectedProvider?.id === provider.id
                ? 'border-blue-500 bg-blue-50 shadow-lg'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-4xl mb-3">{provider.icon}</div>
            <div className="font-semibold text-base text-gray-900 mb-1">{provider.name}</div>
            <div className="text-xs text-gray-500">{provider.config.imap.host}</div>
          </button>
        ))}

        {/* Configurazione personalizzata */}
        <button
          onClick={() => handleProviderSelect(null)}
          className={`p-6 border-2 rounded-xl text-center transition-all duration-200 hover:shadow-md ${
            isCustom
              ? 'border-blue-500 bg-blue-50 shadow-lg'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Settings className="mx-auto mb-3 h-10 w-10 text-gray-600" />
          <div className="font-semibold text-base text-gray-900 mb-1">Configurazione</div>
          <div className="text-xs text-gray-500">Server personalizzati</div>
        </button>
      </div>

      {/* Configurazione personalizzata */}
      {isCustom && (
        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
          <h4 className="font-medium mb-3">Configurazione Server</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* IMAP */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Server IMAP
              </label>
              <input
                type="text"
                value={formData.imapServer}
                onChange={(e) => setFormData(prev => ({ ...prev, imapServer: e.target.value }))}
                placeholder="mail.example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Porta IMAP
              </label>
              <input
                type="number"
                value={formData.imapPort}
                onChange={(e) => setFormData(prev => ({ ...prev, imapPort: parseInt(e.target.value) || 993 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
              />
            </div>

            {/* SMTP */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Server SMTP
              </label>
              <input
                type="text"
                value={formData.smtpServer}
                onChange={(e) => setFormData(prev => ({ ...prev, smtpServer: e.target.value }))}
                placeholder="smtp.example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Porta SMTP
              </label>
              <input
                type="number"
                value={formData.smtpPort}
                onChange={(e) => setFormData(prev => ({ ...prev, smtpPort: parseInt(e.target.value) || 587 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
              />
            </div>

            {/* SSL/TLS */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.imapSecure}
                  onChange={(e) => setFormData(prev => ({ ...prev, imapSecure: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 mr-2"
                />
                <span className="text-sm">IMAP SSL/TLS</span>
              </label>
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.smtpSecure}
                  onChange={(e) => setFormData(prev => ({ ...prev, smtpSecure: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 mr-2"
                />
                <span className="text-sm">SMTP SSL/TLS</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {(selectedProvider || isCustom) && (
        <button
          onClick={() => setStep('credentials')}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          Continua
        </button>
      )}
    </div>
  )

  const renderCredentials = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Credenziali Account</h3>
        <button
          onClick={() => setStep('provider')}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          ← Indietro
        </button>
      </div>

      {/* Info provider selezionato */}
      {selectedProvider && (
        <div className="flex items-center p-3 bg-blue-50 rounded-lg">
          <span className="text-2xl mr-3">{selectedProvider.icon}</span>
          <div>
            <div className="font-medium">{selectedProvider.name}</div>
            <div className="text-sm text-gray-600">
              {selectedProvider.config.imap.host}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Nome account */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome Account (opzionale)
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Email Aziendale"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Indirizzo Email *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => {
              console.log('Email change:', e.target.value)
              setFormData(prev => ({ ...prev, email: e.target.value }))
            }}
            placeholder="nome@azienda.it"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 bg-white"
            required
            autoComplete="email"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password *
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => {
                console.log('Password change:', e.target.value)
                setFormData(prev => ({ ...prev, password: e.target.value }))
              }}
              placeholder="Password email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md pr-10 text-gray-900 placeholder-gray-500 bg-white"
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
          {selectedProvider?.id === 'gmail' && (
            <p className="text-xs text-amber-600 mt-1">
              Per Gmail, usa una Password App anziché la password normale
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleTestConnection}
        disabled={testing || !formData.email || !formData.password}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
      >
        {testing ? (
          <>
            <Loader className="animate-spin h-4 w-4 mr-2" />
            Test connessione...
          </>
        ) : (
          'Test Connessione'
        )}
      </button>
    </div>
  )

  const renderTestResults = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Risultati Test</h3>
        <button
          onClick={() => setStep('credentials')}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          ← Modifica
        </button>
      </div>

      {testResults && (
        <div className="space-y-3">
          {/* Test IMAP */}
          {testResults.imap && (
            <div className={`p-4 rounded-lg border-2 ${testResults.imap.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center mb-2">
                {testResults.imap.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mr-2" />
                )}
                <span className="font-medium">IMAP (Ricezione)</span>
              </div>
              <div className="text-sm text-gray-600">
                Server: {testResults.imap.server}
              </div>
              {!testResults.imap.success && (
                <div className="text-sm text-red-600 mt-1">
                  {testResults.imap.error}
                </div>
              )}
            </div>
          )}

          {/* Test SMTP */}
          {testResults.smtp && (
            <div className={`p-4 rounded-lg border-2 ${testResults.smtp.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center mb-2">
                {testResults.smtp.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mr-2" />
                )}
                <span className="font-medium">SMTP (Invio)</span>
              </div>
              <div className="text-sm text-gray-600">
                Server: {testResults.smtp.server}
              </div>
              {!testResults.smtp.success && (
                <div className="text-sm text-red-600 mt-1">
                  {testResults.smtp.error}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex space-x-3">
        <button
          onClick={handleTestConnection}
          disabled={testing}
          className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          Ripeti Test
        </button>
        <button
          onClick={handleCreateAccount}
          disabled={creating || (testResults && (!testResults.imap?.success || !testResults.smtp?.success))}
          className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {creating ? (
            <>
              <Loader className="animate-spin h-4 w-4 mr-2" />
              Creazione...
            </>
          ) : (
            'Crea Account'
          )}
        </button>
      </div>
    </div>
  )

  const renderSuccess = () => (
    <div className="text-center space-y-4">
      <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
      <h3 className="text-lg font-semibold text-gray-900">Account Creato!</h3>
      <p className="text-gray-600">
        L'account email <strong>{formData.email}</strong> è stato configurato con successo.
        La sincronizzazione delle cartelle è in corso.
      </p>
      <button
        onClick={onClose}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
      >
        Chiudi
      </button>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg">
      <div className="p-6">
        <div className="flex items-center mb-6">
          <Mail className="h-6 w-6 text-blue-600 mr-3" />
          <h2 className="text-xl font-bold text-gray-900">Configura Account Email</h2>
        </div>

        {step === 'provider' && renderProviderSelection()}
        {step === 'credentials' && renderCredentials()}
        {step === 'test' && renderTestResults()}
        {step === 'success' && renderSuccess()}
      </div>
    </div>
  )
}