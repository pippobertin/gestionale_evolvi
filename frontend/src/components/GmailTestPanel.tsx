'use client'

import React, { useState, useEffect } from 'react'
import { Mail, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'

interface GmailStatus {
  configured: boolean
  email?: string
  lastTest?: string
  error?: string
}

export default function GmailTestPanel() {
  const [status, setStatus] = useState<GmailStatus>({ configured: false })
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    checkGmailStatus()
  }, [])

  const checkGmailStatus = async () => {
    try {
      const response = await fetch('/api/gmail/status')
      const result = await response.json()
      setStatus(result)
    } catch (error) {
      console.error('Error checking Gmail status:', error)
      setStatus({ configured: false, error: 'Errore controllo status' })
    }
  }

  const testGmailConnection = async () => {
    setLoading(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/gmail/test', {
        method: 'POST'
      })
      const result = await response.json()

      setTestResult({
        success: result.success,
        message: result.success ? 'Connessione Gmail funzionante!' : result.error || 'Test fallito'
      })

      // Refresh status after test
      await checkGmailStatus()
    } catch (error) {
      console.error('Error testing Gmail:', error)
      setTestResult({
        success: false,
        message: 'Errore durante il test di connessione'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center gap-3 mb-4">
        <Mail className="w-6 h-6 text-red-500" />
        <h3 className="text-lg font-semibold text-gray-900">Test Gmail Integration</h3>
      </div>

      {/* Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            {status.configured ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <div>
              <div className="font-medium text-gray-900">
                {status.configured ? 'Gmail Configurato' : 'Gmail Non Configurato'}
              </div>
              {status.email && (
                <div className="text-sm text-gray-600">{status.email}</div>
              )}
            </div>
          </div>

          <button
            onClick={checkGmailStatus}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Test Connection */}
        {status.configured && (
          <div className="space-y-3">
            <button
              onClick={testGmailConnection}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Testa Connessione Gmail</span>
                </>
              )}
            </button>

            {/* Test Result */}
            {testResult && (
              <div className={`p-4 rounded-lg border ${
                testResult.success
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span className="font-medium">{testResult.message}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Setup Instructions */}
        {!status.configured && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">Setup Gmail:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>Vai in Impostazioni → Configurazione Google</li>
                  <li>Completa l'autenticazione Gmail</li>
                  <li>Torna qui per testare la connessione</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Additional Info */}
        {status.lastTest && (
          <div className="text-xs text-gray-500 text-center">
            Ultimo test: {new Date(status.lastTest).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}