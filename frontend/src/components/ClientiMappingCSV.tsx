'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, X, Download, ArrowRight, Trash2 } from 'lucide-react'

interface TableColumn {
  column_name: string
  data_type: string
  is_nullable: string
}

interface ColumnMapping {
  csvColumn: string
  dbColumn: string
  suggested: boolean
}

interface ClientiMappingCSVProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}

export default function ClientiMappingCSV({ isOpen, onClose, onImportComplete }: ClientiMappingCSVProps) {
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [dbColumns, setDbColumns] = useState<TableColumn[]>([])
  const [mapping, setMapping] = useState<ColumnMapping[]>([])
  const [csvData, setCsvData] = useState<any[]>([])
  const [preview, setPreview] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carica struttura tabella all'apertura
  useEffect(() => {
    if (isOpen) {
      loadTableStructure()
    }
  }, [isOpen])

  const loadTableStructure = async () => {
    try {
      const response = await fetch('/api/clienti/table-structure')
      const data = await response.json()
      if (data.success) {
        setDbColumns(data.data)
      }
    } catch (err) {
      console.error('Errore caricamento struttura tabella:', err)
    }
  }

  // Mapping automatico suggerito basato sui CSV reali
  const createSuggestedMapping = (headers: string[]): ColumnMapping[] => {
    const suggestions: { [key: string]: string } = {
      // Mapping corretto basato sui CSV reali - versione completa
      'Nome Azienda': 'denominazione',
      'Partita IVA': 'partita_iva',
      'REA': 'rea',
      'Azienda_Codice_Fiscale': 'codice_fiscale',  // Codice fiscale dell'azienda
      'ATECO': 'ateco_2025',
      'Email': 'email',
      'Data di Costituzione': 'data_costituzione',
      'PEC': 'pec',
      'Telefono': 'telefono',
      'Sito Web': 'sito_web',
      'Coordinate Bancarie': 'coordinate_bancarie',
      'SDI': 'sdi',
      'Categoria': 'categoria_evolvi',
      'Durata Evolvi': 'durata_evolvi',
      'Scadenza Evolvi': 'scadenza_evolvi',
      'Estremi di Iscrizione al RUNTS': 'estremi_iscrizione_runts',
      'Indirizzo (Fatturazione)': 'indirizzo_fatturazione',
      'BOX (fatturazione)': 'cap_fatturazione',  // QUESTA È LA MAPPATURA CORRETTA DAL CSV
      'Città (Fatturazione)': 'citta_fatturazione',
      'Provincia (Fatturazione)': 'provincia_fatturazione',
      'Descrizione': 'descrizione',
      'ULA': 'ula',
      'DATO ULTIMO FATTURATO': 'ultimo_fatturato',
      'Attivo di Bilancio': 'attivo_bilancio',
      'MATRICOLA INPS': 'matricola_inps',
      'PAT INAIL': 'pat_inail',
      'N° VOLONTARI': 'numero_volontari',
      'N° DIPENDENTI': 'numero_dipendenti',
      'N° COLLABORATORI ESTERNI': 'numero_collaboratori',

      // Legale rappresentante - campi dal CSV reale
      'Cognome': 'legale_rappresentante_cognome',
      'Nome': 'legale_rappresentante_nome',
      'Codice Fiscale': 'legale_rappresentante_codice_fiscale', // Secondo "Codice Fiscale" nel CSV
      'Luogo di Nascita': 'legale_rappresentante_luogo_nascita',
      'Data di Nascita': 'legale_rappresentante_data_nascita',
      'Email Legale Rappresentante': 'legale_rappresentante_email',
      'Telefono Legale Rappresentante': 'legale_rappresentante_telefono',
      'Città di Residenza': 'legale_rappresentante_citta',
      'CAP Residenza': 'legale_rappresentante_cap',
      'Indirizzo di Residenza': 'legale_rappresentante_indirizzo',

      // Campi non mappati nel DB
      'Numero Civico': '', // Campo non mappato nel DB
      'VISURA': '', // Campo non mappato
      'STATUTO': '', // Campo non mappato
      'BILANCIO ANNO 0': '' // Campo non mappato
    }

    return headers.map(header => ({
      csvColumn: header,
      dbColumn: suggestions[header] || '',
      suggested: !!suggestions[header]
    }))
  }

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
        const lines = text.split('\n').filter(line => line.trim())

        if (lines.length === 0) {
          setError('Il file CSV è vuoto')
          setLoading(false)
          return
        }

        // Parse headers
        const headerLine = lines[0]
        const headers = headerLine.split(';').map(h => h.replace(/"/g, '').trim())
        setCsvHeaders(headers)

        // Parse data
        const rows: any[] = []
        for (let i = 1; i < Math.min(lines.length, 6); i++) { // Solo prime 5 righe per preview
          const line = lines[i].trim()
          if (!line) continue

          const values = line.split(';').map(v => v.replace(/"/g, '').trim())
          const row: any = {}
          headers.forEach((header, index) => {
            row[header] = values[index] || ''
          })
          rows.push(row)
        }

        // Parse tutti i dati per importazione
        const allRows: any[] = []
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue

          const values = line.split(';').map(v => v.replace(/"/g, '').trim())
          const row: any = {}
          headers.forEach((header, index) => {
            row[header] = values[index] || ''
          })
          allRows.push(row)
        }

        setCsvData(allRows)
        setPreview(rows)
        setMapping(createSuggestedMapping(headers))
        setLoading(false)
      } catch (err: any) {
        setError(`Errore nella lettura del file: ${err.message}`)
        setLoading(false)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const updateMapping = (csvColumn: string, dbColumn: string) => {
    setMapping(prev =>
      prev.map(m =>
        m.csvColumn === csvColumn
          ? { ...m, dbColumn, suggested: false }
          : m
      )
    )
  }

  const removeMapping = (csvColumn: string) => {
    setMapping(prev =>
      prev.map(m =>
        m.csvColumn === csvColumn
          ? { ...m, dbColumn: '', suggested: false }
          : m
      )
    )
  }

  const downloadMapping = () => {
    const mappingData = {
      csvHeaders,
      dbColumns: dbColumns.map(col => col.column_name),
      mapping,
      timestamp: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(mappingData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mapping-clienti-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    const validMappings = mapping.filter(m => m.dbColumn)
    if (validMappings.length === 0) {
      setError('Devi mappare almeno una colonna per procedere con l\'importazione')
      return
    }

    setImporting(true)
    setError('')

    try {
      const response = await fetch('/api/clienti/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData,
          mapping: validMappings.reduce((acc, m) => {
            acc[m.csvColumn] = m.dbColumn
            return acc
          }, {} as any)
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

  const reset = () => {
    setCsvHeaders([])
    setDbColumns([])
    setMapping([])
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
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Importazione Avanzata Clienti
              </h3>
              <p className="text-sm text-gray-600">
                Mappa le colonne CSV con i campi del database
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {mapping.length > 0 && (
              <button
                onClick={downloadMapping}
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                Scarica mapping
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-140px)]">

          {/* File Upload */}
          {!csvHeaders.length && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Carica il file CSV
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Seleziona il file "Accounts (1).csv" per iniziare il mapping
              </p>
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
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {loading ? 'Caricamento...' : 'Seleziona File CSV'}
              </button>
            </div>
          )}

          {/* Mapping Interface */}
          {csvHeaders.length > 0 && !results && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-900">
                  Mapping Colonne ({csvData.length} righe totali)
                </h4>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">
                    {mapping.filter(m => m.dbColumn).length}/{csvHeaders.length} mappate
                  </span>
                  <button
                    onClick={reset}
                    className="text-gray-500 hover:text-gray-700 text-sm"
                  >
                    Cambia file
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mapping Table */}
                <div className="space-y-4">
                  <h5 className="font-medium text-gray-900">Mapping Colonne</h5>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="grid grid-cols-5 gap-4 text-xs font-medium text-gray-500 uppercase">
                        <div className="col-span-2">Colonna CSV</div>
                        <div></div>
                        <div className="col-span-2">Campo Database</div>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {mapping.map((m, index) => (
                        <div key={index} className="px-4 py-3 border-b border-gray-100 last:border-b-0">
                          <div className="grid grid-cols-5 gap-4 items-center">
                            <div className="col-span-2">
                              <span className="text-sm font-medium text-gray-900">
                                {m.csvColumn}
                              </span>
                              {m.suggested && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  Suggerita
                                </span>
                              )}
                            </div>
                            <div className="flex justify-center">
                              <ArrowRight className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="col-span-2">
                              <div className="flex items-center gap-2">
                                <select
                                  value={m.dbColumn}
                                  onChange={(e) => updateMapping(m.csvColumn, e.target.value)}
                                  className="flex-1 text-sm border border-gray-300 rounded px-3 py-1"
                                >
                                  <option value="">-- Non mappare --</option>
                                  {dbColumns.map(col => (
                                    <option key={col.column_name} value={col.column_name}>
                                      {col.column_name} ({col.data_type})
                                    </option>
                                  ))}
                                </select>
                                {m.dbColumn && (
                                  <button
                                    onClick={() => removeMapping(m.csvColumn)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-4">
                  <h5 className="font-medium text-gray-900">Anteprima Dati</h5>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-96">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {mapping.filter(m => m.dbColumn).slice(0, 4).map(m => (
                              <th key={m.csvColumn} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                {m.csvColumn} → {m.dbColumn}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {preview.map((row, index) => (
                            <tr key={index}>
                              {mapping.filter(m => m.dbColumn).slice(0, 4).map(m => (
                                <td key={m.csvColumn} className="px-3 py-2 text-sm text-gray-900">
                                  {String(row[m.csvColumn] || '-').substring(0, 50)}
                                  {String(row[m.csvColumn] || '').length > 50 && '...'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {results && (
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h5 className="font-medium text-green-900">Successi</h5>
                  </div>
                  <p className="text-2xl font-bold text-green-900">{results.imported}</p>
                  <p className="text-sm text-green-700">Clienti importati</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <h5 className="font-medium text-amber-900">Saltati</h5>
                  </div>
                  <p className="text-2xl font-bold text-amber-900">{results.skipped || 0}</p>
                  <p className="text-sm text-amber-700">Record non importati</p>
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

              {results.skippedBreakdown && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-medium text-blue-900 mb-3">Dettaglio record saltati:</h5>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {Object.entries(results.skippedBreakdown).map(([reason, count]) => (
                      <div key={reason} className="flex justify-between">
                        <span className="text-blue-700">{reason}:</span>
                        <span className="font-medium text-blue-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.errorDetails && results.errorDetails.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <h5 className="font-medium text-red-900 mb-2">Dettagli errori:</h5>
                  {results.errorDetails.slice(0, 10).map((error: string, index: number) => (
                    <p key={index} className="text-sm text-red-700 mb-1">{error}</p>
                  ))}
                  {results.errorDetails.length > 10 && (
                    <p className="text-sm text-red-600 font-medium mt-2">
                      ... e altri {results.errorDetails.length - 10} errori
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

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
              {csvHeaders.length > 0 && (
                <button
                  onClick={handleImport}
                  disabled={importing || mapping.filter(m => m.dbColumn).length === 0}
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