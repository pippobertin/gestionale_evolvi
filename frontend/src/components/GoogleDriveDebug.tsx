'use client'

import { useState } from 'react'
import { Play, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'

export default function GoogleDriveDebug() {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<any>(null)

  const runDriveDebug = async () => {
    setIsRunning(true)
    setResults(null)

    try {
      const response = await fetch('/api/debug-drive')
      const data = await response.json()
      setResults(data)
    } catch (error: any) {
      setResults({
        success: false,
        error: 'Errore chiamata API debug',
        details: error.message
      })
    } finally {
      setIsRunning(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ALL_OK':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'TOKEN_MISSING':
      case 'SHARED_DRIVE_NOT_FOUND':
      case 'DRIVE_ACCESS_ERROR':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ALL_OK':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'TOKEN_MISSING':
      case 'SHARED_DRIVE_NOT_FOUND':
      case 'DRIVE_ACCESS_ERROR':
        return 'bg-red-50 border-red-200 text-red-800'
      default:
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Diagnosi Google Drive</h3>
        <button
          onClick={runDriveDebug}
          disabled={isRunning}
          className="btn-primary flex items-center space-x-2"
        >
          {isRunning ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          <span>{isRunning ? 'Controllo...' : 'Avvia Test'}</span>
        </button>
      </div>

      <div className="text-sm text-gray-600 mb-4">
        Questo test verifica:
        • Token di accesso Google valido
        • Connessione a Google Drive
        • Accesso al Drive Condiviso "Gestionale Evolvi"
        • Struttura cartelle esistenti
      </div>

      {results && (
        <div className={`rounded-lg border p-4 ${getStatusColor(results.status)}`}>
          <div className="flex items-center space-x-2 mb-3">
            {getStatusIcon(results.status)}
            <span className="font-medium">
              {results.success ? 'Test completato con successo' : 'Problemi rilevati'}
            </span>
          </div>

          <div className="text-sm space-y-2">
            <div><strong>Stato:</strong> {results.status}</div>
            <div><strong>Messaggio:</strong> {results.message || results.error}</div>

            {results.details && (
              <div><strong>Dettagli:</strong> {results.details}</div>
            )}

            {results.data && (
              <div className="mt-3 space-y-2">
                <div><strong>Utente:</strong> {results.data.userEmail}</div>
                <div><strong>Drive Condiviso:</strong> {results.data.sharedDriveName} ({results.data.sharedDriveId})</div>
                <div><strong>Cartelle trovate:</strong> {results.data.foldersCount}</div>

                {results.data.folders && results.data.folders.length > 0 && (
                  <div className="mt-2">
                    <strong>Lista cartelle:</strong>
                    <ul className="list-disc list-inside ml-4 mt-1">
                      {results.data.folders.map((folder: any) => (
                        <li key={folder.id}>{folder.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {results.availableDrives && (
              <div className="mt-3">
                <strong>Drive Condivisi disponibili:</strong>
                <ul className="list-disc list-inside ml-4 mt-1">
                  {results.availableDrives.map((drive: string) => (
                    <li key={drive}>{drive}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {!results.success && results.status === 'TOKEN_MISSING' && (
            <div className="mt-3 p-3 bg-white border border-gray-300 rounded">
              <strong>Azione richiesta:</strong> Vai su "Google API" e riconnetti l'account
            </div>
          )}

          {!results.success && results.status === 'SHARED_DRIVE_NOT_FOUND' && (
            <div className="mt-3 p-3 bg-white border border-gray-300 rounded">
              <strong>Azione richiesta:</strong> Crea un Drive Condiviso chiamato "Gestionale Evolvi" e assicurati che l'account {results.data?.userEmail || 'info@blmproject.com'} abbia accesso
            </div>
          )}
        </div>
      )}
    </div>
  )
}