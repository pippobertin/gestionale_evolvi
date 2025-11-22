'use client'

import React, { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, X, Download } from 'lucide-react'

interface ImportResults {
  imported: number
  errors: number
  errorDetails: string[]
  importedClients: any[]
}

interface ClientiImportCSVProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}

export default function ClientiImportCSV({ isOpen, onClose, onImportComplete }: ClientiImportCSVProps) {
  const [csvData, setCsvData] = useState<any[]>([])
  const [preview, setPreview] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResults | null>(null)
  const [error, setError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError('')
    setResults(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const rows = parseCSV(text)

        if (rows.length === 0) {
          setError('Il file CSV è vuoto o non valido')
          setLoading(false)
          return
        }

        setCsvData(rows)
        setPreview(rows.slice(0, 5)) // Mostra prime 5 righe
        setLoading(false)
      } catch (err: any) {
        setError(`Errore nella lettura del file: ${err.message}`)
        setLoading(false)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length === 0) return []

    // Parse header con separatore punto e virgola
    const headerLine = lines[0]
    const headers = headerLine.split(';').map(h => h.replace(/"/g, '').trim())

    const rows: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(';').map(v => v.replace(/"/g, '').trim())
      const row: any = {}

      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })

      rows.push(row)
    }

    return rows
  }

  const handleImport = async () => {
    if (csvData.length === 0) return

    setImporting(true)
    setError('')

    try {
      const response = await fetch('/api/clienti/import-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvData,
          mapping: {} // Il mapping è hardcoded nella API
        })
      })

      const data = await response.json()

      if (data.success) {
        setResults(data.data)
        onImportComplete()
      } else {
        setError(data.message || 'Errore durante l\'importazione')
      }
    } catch (err: any) {
      setError(`Errore di rete: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  const downloadErrorsReport = () => {
    if (!results || !results.errorDetails.length) return

    const content = [
      'REPORT ERRORI IMPORTAZIONE CLIENTI',
      '=====================================',
      '',
      `Data importazione: ${new Date().toLocaleString('it-IT')}`,
      `Clienti importati: ${results.imported}`,
      `Errori: ${results.errors}`,
      '',
      'DETTAGLIO ERRORI:',
      '----------------',
      ...results.errorDetails
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `errori-importazione-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const reset = () => {
    setCsvData([])
    setPreview([])
    setResults(null)
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Importazione Clienti da CSV
              </h3>
              <p className="text-sm text-gray-600">
                Carica il file CSV per importare tutti i clienti
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {!csvData.length && !results ? (
            <div className="space-y-6">
              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <div className="flex flex-col items-center space-y-4">
                  <FileText className="w-12 h-12 text-gray-400" />
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">
                      Carica il file CSV
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Seleziona il file "Accounts (1).csv" dal tuo computer
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {loading ? 'Caricamento...' : 'Seleziona File CSV'}
                  </button>
                </div>
              </div>

              {/* Mapping Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Mapping Automatico</h4>
                <p className="text-sm text-blue-700 mb-3">
                  I seguenti campi verranno mappati automaticamente:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div><strong>Nome Azienda</strong> → Denominazione</div>
                  <div><strong>Partita IVA</strong> → P.IVA</div>
                  <div><strong>Email</strong> → Email</div>
                  <div><strong>Telefono</strong> → Telefono</div>
                  <div><strong>Città (Fatturazione)</strong> → Città</div>
                  <div><strong>ULA</strong> → Numero Dipendenti</div>
                  <div><strong>DATO ULTIMO FATTURATO</strong> → Fatturato</div>
                  <div><strong>DIMENSIONE</strong> → Dimensione</div>
                  <div><strong>Cognome + Nome</strong> → Legale Rappresentante</div>
                  <div><strong>Categoria</strong> → Categoria Evolvi</div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Preview */}
          {preview.length > 0 && !results ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-900">
                  Anteprima dati ({csvData.length} righe totali)
                </h4>
                <button
                  onClick={reset}
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Cambia file
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome Azienda</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">P.IVA</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Telefono</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Città</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dimensione</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.map((row, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Nome Azienda'] || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Partita IVA'] || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Email'] || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Telefono'] || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Città (Fatturazione)'] || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['DIMENSIONE'] || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>Nota:</strong> I clienti duplicati (stesso nome azienda o P.IVA) verranno ignorati automaticamente.
                </p>
              </div>
            </div>
          ) : null}

          {/* Results */}
          {results ? (
            <div className="space-y-6">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h4 className="text-xl font-semibold text-gray-900 mb-2">
                  Importazione Completata!
                </h4>
                <p className="text-gray-600">
                  {results.imported} clienti importati con successo
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h5 className="font-medium text-green-900">Successi</h5>
                  </div>
                  <p className="text-2xl font-bold text-green-900">{results.imported}</p>
                  <p className="text-sm text-green-700">Clienti importati</p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <h5 className="font-medium text-red-900">Errori</h5>
                  </div>
                  <p className="text-2xl font-bold text-red-900">{results.errors}</p>
                  <p className="text-sm text-red-700">Righe con errori</p>
                </div>
              </div>

              {results.errorDetails.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium text-gray-900">Dettagli errori</h5>
                    <button
                      onClick={downloadErrorsReport}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                    >
                      <Download className="w-4 h-4" />
                      Scarica report
                    </button>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                    {results.errorDetails.slice(0, 10).map((error, index) => (
                      <p key={index} className="text-sm text-red-700 mb-1">{error}</p>
                    ))}
                    {results.errorDetails.length > 10 && (
                      <p className="text-sm text-red-600 font-medium mt-2">
                        ... e altri {results.errorDetails.length - 10} errori
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          {results ? (
            <button
              onClick={onClose}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              Chiudi
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annulla
              </button>
              {csvData.length > 0 && (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Importa {csvData.length} clienti
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}