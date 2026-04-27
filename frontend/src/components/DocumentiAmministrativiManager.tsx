'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Upload, FileText, Trash2, Download, CheckCircle, XCircle,
  ChevronDown, ChevronRight, AlertTriangle, RefreshCw, X, Plus, Search,
  Eye, FileQuestion, ZoomIn, ZoomOut, RotateCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  DocumentoAmministrativo,
  TIPI_DOCUMENTO,
  CATEGORIE_DOCUMENTO
} from '@/types/evolvi-contract'

interface DocumentiAmministrativiManagerProps {
  clienteId: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function isExpired(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function isExpiringSoon(dateStr: string | null | undefined, days: number = 30): boolean {
  if (!dateStr) return false
  const expDate = new Date(dateStr)
  const now = new Date()
  const diff = expDate.getTime() - now.getTime()
  return diff > 0 && diff < days * 24 * 60 * 60 * 1000
}

export default function DocumentiAmministrativiManager({ clienteId }: DocumentiAmministrativiManagerProps) {
  const [documenti, setDocumenti] = useState<DocumentoAmministrativo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [previewDoc, setPreviewDoc] = useState<DocumentoAmministrativo | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewZoom, setPreviewZoom] = useState(100)
  const [previewRotation, setPreviewRotation] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    tipo_documento: '',
    categoria: '',
    descrizione: '',
    data_documento: '',
    data_scadenza: '',
    tags: ''
  })

  useEffect(() => {
    if (clienteId) {
      loadDocumenti()
    }
  }, [clienteId])

  const loadDocumenti = async () => {
    if (!clienteId) return
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('scadenze_bandi_documenti_amministrativi')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('uploaded_at', { ascending: false })

      if (fetchError) throw fetchError
      setDocumenti(data || [])

      // Auto-expand all categories that have documents
      const cats = new Set<string>()
      ;(data || []).forEach((d: DocumentoAmministrativo) => {
        if (d.categoria) cats.add(d.categoria)
      })
      setExpandedCategories(cats)
    } catch (err: any) {
      console.error('Errore caricamento documenti amministrativi:', err)
      setError(err.message || 'Errore nel caricamento dei documenti')
    } finally {
      setLoading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadForm(prev => ({ ...prev, file: e.dataTransfer.files[0] }))
      setShowUploadForm(true)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadForm(prev => ({ ...prev, file: e.target.files![0] }))
      setShowUploadForm(true)
    }
  }

  const handleTipoDocumentoChange = (value: string) => {
    const tipo = TIPI_DOCUMENTO.find(t => t.value === value)
    setUploadForm(prev => ({
      ...prev,
      tipo_documento: value,
      categoria: tipo?.categoria || 'ALTRO'
    }))
  }

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.tipo_documento) {
      setError('File e tipo documento sono obbligatori')
      return
    }

    try {
      setUploading(true)
      setError(null)

      const formData = new FormData()
      formData.append('file', uploadForm.file)
      formData.append('tipo_documento', uploadForm.tipo_documento)
      formData.append('categoria', uploadForm.categoria || 'ALTRO')
      if (uploadForm.descrizione) formData.append('descrizione', uploadForm.descrizione)
      if (uploadForm.data_documento) formData.append('data_documento', uploadForm.data_documento)
      if (uploadForm.data_scadenza) formData.append('data_scadenza', uploadForm.data_scadenza)
      if (uploadForm.tags) formData.append('tags', uploadForm.tags)

      const res = await fetch(`/api/clienti/${clienteId}/documenti-amministrativi`, {
        method: 'POST',
        body: formData
      })

      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      // Reset form
      setUploadForm({
        file: null,
        tipo_documento: '',
        categoria: '',
        descrizione: '',
        data_documento: '',
        data_scadenza: '',
        tags: ''
      })
      setShowUploadForm(false)
      if (fileInputRef.current) fileInputRef.current.value = ''

      await loadDocumenti()
    } catch (err: any) {
      console.error('Errore upload documento:', err)
      setError(err.message || 'Errore nel caricamento del documento')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (doc: DocumentoAmministrativo) => {
    try {
      const res = await fetch(`/api/clienti/${clienteId}/documenti-amministrativi/${doc.id}/download`)
      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      // Open download URL in new tab
      window.open(result.data.url, '_blank')
    } catch (err: any) {
      console.error('Errore download:', err)
      setError(err.message || 'Errore nel download del documento')
    }
  }

  const handleDelete = async (doc: DocumentoAmministrativo) => {
    if (!confirm(`Eliminare il documento "${doc.nome_originale}"?`)) return

    try {
      const res = await fetch(`/api/clienti/${clienteId}/documenti-amministrativi/${doc.id}`, {
        method: 'DELETE'
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      await loadDocumenti()
    } catch (err: any) {
      console.error('Errore eliminazione documento:', err)
      setError(err.message || 'Errore nell\'eliminazione del documento')
    }
  }

  const handleToggleVerifica = async (doc: DocumentoAmministrativo) => {
    try {
      const res = await fetch(`/api/clienti/${clienteId}/documenti-amministrativi/${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificato: !doc.verificato })
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      await loadDocumenti()
    } catch (err: any) {
      console.error('Errore toggle verifica:', err)
      setError(err.message || 'Errore nell\'aggiornamento del documento')
    }
  }

  const isPreviewable = (mimeType: string | null | undefined): boolean => {
    if (!mimeType) return false
    return mimeType === 'application/pdf' ||
      mimeType.startsWith('image/')
  }

  const handlePreview = async (doc: DocumentoAmministrativo) => {
    try {
      setPreviewDoc(doc)
      setPreviewLoading(true)
      setPreviewUrl(null)
      setPreviewZoom(100)
      setPreviewRotation(0)

      const res = await fetch(`/api/clienti/${clienteId}/documenti-amministrativi/${doc.id}/download`)
      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      setPreviewUrl(result.data.url)
    } catch (err: any) {
      console.error('Errore anteprima:', err)
      setError(err.message || 'Errore nel caricamento dell\'anteprima')
      setPreviewDoc(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    setPreviewDoc(null)
    setPreviewUrl(null)
    setPreviewZoom(100)
    setPreviewRotation(0)
  }

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
  }

  // Group documents by categoria
  const groupedDocumenti = documenti.reduce((acc, doc) => {
    const cat = doc.categoria || 'ALTRO'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(doc)
    return acc
  }, {} as Record<string, DocumentoAmministrativo[]>)

  // Filter by search term
  const filteredCategories = Object.entries(groupedDocumenti).filter(([cat, docs]) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      cat.toLowerCase().includes(term) ||
      docs.some(d =>
        d.nome_originale.toLowerCase().includes(term) ||
        d.tipo_documento.toLowerCase().includes(term) ||
        (d.descrizione && d.descrizione.toLowerCase().includes(term))
      )
    )
  })

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900 flex items-center">
          <FileText className="w-4 h-4 mr-2" />
          Documenti Amministrativi
        </h4>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadDocumenti}
            className="btn-secondary text-sm py-2 px-3"
            disabled={loading}
            title="Aggiorna lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowUploadForm(true)
              setUploadForm(prev => ({ ...prev, file: null }))
            }}
            className="btn-primary text-sm py-2 px-3"
            disabled={uploading}
          >
            <Plus className="w-4 h-4 mr-1" />
            Carica Documento
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Drag & Drop Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
          dragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className={`w-6 h-6 mx-auto mb-1 ${dragActive ? 'text-primary-500' : 'text-gray-400'}`} />
        <p className="text-sm text-gray-600">
          {dragActive ? 'Rilascia il file qui' : 'Trascina un file qui o clicca per selezionare'}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h5 className="text-sm font-medium text-gray-900">Carica Documento</h5>
            <button
              type="button"
              onClick={() => {
                setShowUploadForm(false)
                setUploadForm({ file: null, tipo_documento: '', categoria: '', descrizione: '', data_documento: '', data_scadenza: '', tags: '' })
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {uploadForm.file && (
            <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm">
              <span className="font-medium">{uploadForm.file.name}</span>
              <span className="text-gray-500 ml-2">({formatBytes(uploadForm.file.size)})</span>
            </div>
          )}

          {!uploadForm.file && (
            <div className="text-center py-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-sm py-2 px-4"
              >
                <Upload className="w-4 h-4 mr-1" />
                Seleziona File
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo Documento *</label>
              <select
                value={uploadForm.tipo_documento}
                onChange={(e) => handleTipoDocumentoChange(e.target.value)}
                className="input-field text-sm"
              >
                <option value="">Seleziona tipo...</option>
                {TIPI_DOCUMENTO.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Categoria</label>
              <select
                value={uploadForm.categoria}
                onChange={(e) => setUploadForm(prev => ({ ...prev, categoria: e.target.value }))}
                className="input-field text-sm"
              >
                <option value="">Seleziona categoria...</option>
                {CATEGORIE_DOCUMENTO.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Documento</label>
              <input
                type="date"
                value={uploadForm.data_documento}
                onChange={(e) => setUploadForm(prev => ({ ...prev, data_documento: e.target.value }))}
                className="input-field text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Scadenza</label>
              <input
                type="date"
                value={uploadForm.data_scadenza}
                onChange={(e) => setUploadForm(prev => ({ ...prev, data_scadenza: e.target.value }))}
                className="input-field text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Descrizione</label>
              <input
                type="text"
                value={uploadForm.descrizione}
                onChange={(e) => setUploadForm(prev => ({ ...prev, descrizione: e.target.value }))}
                className="input-field text-sm"
                placeholder="Descrizione opzionale..."
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Tags (separati da virgola)</label>
              <input
                type="text"
                value={uploadForm.tags}
                onChange={(e) => setUploadForm(prev => ({ ...prev, tags: e.target.value }))}
                className="input-field text-sm"
                placeholder="es: 2024, rinnovo, urgente"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowUploadForm(false)
                setUploadForm({ file: null, tipo_documento: '', categoria: '', descrizione: '', data_documento: '', data_scadenza: '', tags: '' })
              }}
              className="btn-secondary text-sm py-2 px-4"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleUpload}
              className="btn-primary text-sm py-2 px-4"
              disabled={uploading || !uploadForm.file || !uploadForm.tipo_documento}
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  Caricamento...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-1" />
                  Carica
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      {documenti.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field text-sm pl-9"
            placeholder="Cerca documenti..."
          />
        </div>
      )}

      {/* Documents grouped by category */}
      {loading && documenti.length === 0 ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Caricamento documenti...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
          <FileText className="w-6 h-6 mx-auto mb-1 opacity-50" />
          <p className="text-sm">Nessun documento amministrativo presente</p>
          <p className="text-xs mt-1">Trascina un file nell&apos;area sopra per caricarlo</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCategories.map(([categoria, docs]) => {
            const catInfo = CATEGORIE_DOCUMENTO.find(c => c.value === categoria)
            const isExpanded = expandedCategories.has(categoria)

            return (
              <div key={categoria} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Category header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(categoria)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {catInfo?.label || categoria}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
                      {docs.length}
                    </span>
                  </div>
                </button>

                {/* Documents in category */}
                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {docs
                      .filter(d => {
                        if (!searchTerm) return true
                        const term = searchTerm.toLowerCase()
                        return (
                          d.nome_originale.toLowerCase().includes(term) ||
                          d.tipo_documento.toLowerCase().includes(term) ||
                          (d.descrizione && d.descrizione.toLowerCase().includes(term))
                        )
                      })
                      .map((doc) => {
                        const tipoInfo = TIPI_DOCUMENTO.find(t => t.value === doc.tipo_documento)
                        const expired = isExpired(doc.data_scadenza)
                        const expiringSoon = isExpiringSoon(doc.data_scadenza)

                        return (
                          <div key={doc.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <span className="text-sm font-medium text-gray-900 truncate">
                                    {doc.nome_originale}
                                  </span>

                                  {/* Tipo documento badge */}
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                    {tipoInfo?.label || doc.tipo_documento}
                                  </span>

                                  {/* Verificato badge */}
                                  {doc.verificato ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Verificato
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                      Non verificato
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                                  {doc.data_documento && (
                                    <span>Data: {new Date(doc.data_documento).toLocaleDateString('it-IT')}</span>
                                  )}

                                  {doc.data_scadenza && (
                                    <span className={`flex items-center ${
                                      expired ? 'text-red-600 font-medium' : expiringSoon ? 'text-yellow-600 font-medium' : ''
                                    }`}>
                                      {expired && <AlertTriangle className="w-3 h-3 mr-1" />}
                                      Scadenza: {new Date(doc.data_scadenza).toLocaleDateString('it-IT')}
                                      {expired && ' (SCADUTO)'}
                                      {expiringSoon && ' (in scadenza)'}
                                    </span>
                                  )}

                                  {doc.dimensione_bytes && (
                                    <span>{formatBytes(doc.dimensione_bytes)}</span>
                                  )}
                                </div>

                                {doc.descrizione && (
                                  <p className="text-xs text-gray-500 mt-1">{doc.descrizione}</p>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center space-x-1 ml-3 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleVerifica(doc)}
                                  className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
                                    doc.verificato ? 'text-green-600' : 'text-gray-400'
                                  }`}
                                  title={doc.verificato ? 'Rimuovi verifica' : 'Segna come verificato'}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handlePreview(doc)}
                                  className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                  title={isPreviewable(doc.mime_type) ? 'Anteprima' : 'Anteprima (formato non supportato)'}
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDownload(doc)}
                                  className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                  title="Scarica"
                                >
                                  <Download className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDelete(doc)}
                                  className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  title="Elimina"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="gradient-primary text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-2 min-w-0">
                <Eye className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-semibold truncate">{previewDoc.nome_originale}</span>
                {previewDoc.mime_type && (
                  <span className="text-xs bg-white/20 rounded px-2 py-0.5 flex-shrink-0">
                    {previewDoc.mime_type.split('/').pop()?.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1 flex-shrink-0">
                {/* Zoom/rotate controls for images */}
                {previewDoc.mime_type?.startsWith('image/') && previewUrl && (
                  <>
                    <button
                      onClick={() => setPreviewZoom(z => Math.max(25, z - 25))}
                      className="p-1.5 hover:bg-white/20 rounded transition-colors"
                      title="Riduci"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs min-w-[3rem] text-center">{previewZoom}%</span>
                    <button
                      onClick={() => setPreviewZoom(z => Math.min(300, z + 25))}
                      className="p-1.5 hover:bg-white/20 rounded transition-colors"
                      title="Ingrandisci"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPreviewRotation(r => (r + 90) % 360)}
                      className="p-1.5 hover:bg-white/20 rounded transition-colors"
                      title="Ruota"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                    <div className="w-px h-5 bg-white/30 mx-1" />
                  </>
                )}
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="p-1.5 hover:bg-white/20 rounded transition-colors"
                  title="Scarica"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={closePreview}
                  className="p-1.5 hover:bg-white/20 rounded transition-colors"
                  title="Chiudi"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Preview content */}
            <div className="flex-1 overflow-auto bg-gray-100">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
                  <p className="text-sm text-gray-500 mt-3">Caricamento anteprima...</p>
                </div>
              ) : !previewUrl ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <AlertTriangle className="w-10 h-10 text-yellow-500 mb-2" />
                  <p className="text-sm text-gray-700">Impossibile caricare l&apos;anteprima</p>
                </div>
              ) : previewDoc.mime_type === 'application/pdf' ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title={`Anteprima: ${previewDoc.nome_originale}`}
                />
              ) : previewDoc.mime_type?.startsWith('image/') ? (
                <div className="flex items-center justify-center min-h-full p-4 overflow-auto">
                  <img
                    src={previewUrl}
                    alt={previewDoc.nome_originale}
                    className="max-w-none transition-transform duration-200"
                    style={{
                      transform: `scale(${previewZoom / 100}) rotate(${previewRotation}deg)`,
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <FileQuestion className="w-16 h-16 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-1">
                    Anteprima non disponibile
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Il formato <strong>{previewDoc.mime_type?.split('/').pop()?.toUpperCase() || 'sconosciuto'}</strong> non supporta l&apos;anteprima nel browser.
                  </p>
                  <button
                    onClick={() => handleDownload(previewDoc)}
                    className="btn-primary text-sm py-2 px-4"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Scarica il documento
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
