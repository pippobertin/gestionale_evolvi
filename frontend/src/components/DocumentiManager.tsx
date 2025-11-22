'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Upload, FileText, Trash2, Eye, Download, Edit, Save, X, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Documento {
  id?: string
  cliente_id: string
  nome_file: string
  nome_originale: string
  categoria: 'VISURA' | 'BILANCI' | 'ULA' | 'CONTRATTI' | 'DSAN' | 'ALTRO'
  file_path: string
  file_size?: number
  mime_type?: string
  created_at?: string
}

interface DocumentiManagerProps {
  clienteId: string
  isNewClient?: boolean
}

const CATEGORIE_DOCUMENTO = [
  { value: 'VISURA', label: 'Visura' },
  { value: 'BILANCI', label: 'Bilanci' },
  { value: 'ULA', label: 'ULA' },
  { value: 'CONTRATTI', label: 'Contratti' },
  { value: 'DSAN', label: 'DSAN' },
  { value: 'ALTRO', label: 'Altro' }
] as const

export default function DocumentiManager({ clienteId, isNewClient = false }: DocumentiManagerProps) {
  const [documenti, setDocumenti] = useState<Documento[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Documento | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state per upload
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    nome_file: '',
    categoria: '' as any
  })

  useEffect(() => {
    if (clienteId && !isNewClient) {
      loadDocumenti()
    }
  }, [clienteId, isNewClient])

  const loadDocumenti = async () => {
    if (!clienteId) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('scadenze_bandi_clienti_documenti')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocumenti(data || [])
    } catch (error) {
      console.error('Errore caricamento documenti:', error)
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
      handleFileSelection(e.dataTransfer.files[0])
    }
  }

  const handleFileSelection = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('File troppo grande. Limite massimo: 10MB')
      return
    }

    setUploadForm({
      file,
      nome_file: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      categoria: ''
    })
    setShowUploadForm(true)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0])
    }
  }

  const uploadDocumento = async () => {
    if (!uploadForm.file || !uploadForm.nome_file.trim() || !uploadForm.categoria) {
      alert('Compilare tutti i campi obbligatori')
      return
    }

    if (!clienteId) {
      alert('ID Cliente mancante')
      return
    }

    try {
      setUploading(true)

      // Generate unique filename
      const fileExtension = uploadForm.file.name.split('.').pop()
      const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`
      const filePath = `${clienteId}/${uniqueFileName}`

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('clienti-documenti')
        .upload(filePath, uploadForm.file)

      if (uploadError) {
        throw uploadError
      }

      // Save document metadata to database
      const docData: Omit<Documento, 'id'> = {
        cliente_id: clienteId,
        nome_file: uploadForm.nome_file.trim(),
        nome_originale: uploadForm.file.name,
        categoria: uploadForm.categoria,
        file_path: filePath,
        file_size: uploadForm.file.size,
        mime_type: uploadForm.file.type || 'application/octet-stream'
      }

      const { error: dbError } = await supabase
        .from('scadenze_bandi_clienti_documenti')
        .insert([docData])

      if (dbError) {
        // If DB insert fails, try to delete the uploaded file
        await supabase.storage
          .from('clienti-documenti')
          .remove([filePath])

        throw dbError
      }

      // Reset form and reload documents
      setUploadForm({ file: null, nome_file: '', categoria: '' })
      setShowUploadForm(false)
      await loadDocumenti()

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

    } catch (error: any) {
      console.error('Errore nell\'upload del documento:', error)
      const errorMessage = error?.message || error?.error_description || 'Errore sconosciuto durante l\'upload'
      alert(`Errore nell'upload del documento: ${errorMessage}`)
    } finally {
      setUploading(false)
    }
  }

  const deleteDocumento = async (documento: Documento) => {
    if (!confirm(`Sei sicuro di voler eliminare il documento "${documento.nome_file}"?`)) return

    try {
      setLoading(true)

      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('clienti-documenti')
        .remove([documento.file_path])

      if (storageError) {
        console.warn('Errore nella rimozione del file da storage:', storageError)
      }

      // Delete metadata from database
      const { error: dbError } = await supabase
        .from('scadenze_bandi_clienti_documenti')
        .delete()
        .eq('id', documento.id!)

      if (dbError) throw dbError

      await loadDocumenti()
    } catch (error) {
      console.error('Errore nell\'eliminazione del documento:', error)
      alert('Errore nell\'eliminazione del documento')
    } finally {
      setLoading(false)
    }
  }

  const downloadDocumento = async (documento: Documento) => {
    try {
      const { data, error } = await supabase.storage
        .from('clienti-documenti')
        .download(documento.file_path)

      if (error) throw error

      // Create download link
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = documento.nome_originale
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Errore nel download del documento:', error)
      alert('Errore nel download del documento')
    }
  }

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'N/A'
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getCategoriaColor = (categoria: string) => {
    const colors = {
      VISURA: 'bg-blue-100 text-blue-800',
      BILANCI: 'bg-green-100 text-green-800',
      ULA: 'bg-yellow-100 text-yellow-800',
      CONTRATTI: 'bg-purple-100 text-purple-800',
      DSAN: 'bg-red-100 text-red-800',
      ALTRO: 'bg-gray-100 text-gray-800'
    }
    return colors[categoria as keyof typeof colors] || colors.ALTRO
  }

  // Se è un cliente nuovo, mostra messaggio informativo
  if (isNewClient) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <FileText className="w-5 h-5 text-blue-600 mr-2" />
          <h4 className="text-blue-800 font-medium">Documenti Amministrativi</h4>
        </div>
        <p className="text-blue-700 text-sm mt-2">
          I documenti potranno essere caricati dopo aver salvato il cliente per la prima volta.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-gray-900 flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          Documenti Amministrativi
        </h4>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn-primary text-sm py-2 px-3"
          disabled={loading || uploading}
        >
          <Plus className="w-4 h-4 mr-1" />
          Aggiungi Documento
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileInput}
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.rar"
      />

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? 'border-primary-400 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">
          Trascina i file qui o{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-primary-600 hover:text-primary-700 underline"
          >
            sfoglia
          </button>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Formati supportati: PDF, DOC, XLS, immagini, ZIP (max 10MB)
        </p>
      </div>

      {/* Lista documenti */}
      <div className="space-y-3">
        {loading && documenti.length === 0 ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Caricamento documenti...</p>
          </div>
        ) : documenti.length === 0 ? (
          <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nessun documento caricato</p>
            <p className="text-xs mt-1">Trascina i file sopra per iniziare</p>
          </div>
        ) : (
          documenti.map((doc) => (
            <div key={doc.id} className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h5 className="font-medium text-gray-900">{doc.nome_file}</h5>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoriaColor(doc.categoria)}`}>
                      {CATEGORIE_DOCUMENTO.find(c => c.value === doc.categoria)?.label || doc.categoria}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600">
                    <div>
                      <span className="text-gray-500">File originale:</span>
                      <span className="ml-1">{doc.nome_originale}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Dimensione:</span>
                      <span className="ml-1">{formatFileSize(doc.file_size)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Tipo:</span>
                      <span className="ml-1">{doc.mime_type?.split('/')[1]?.toUpperCase() || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Caricato:</span>
                      <span className="ml-1">
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString('it-IT') : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    type="button"
                    onClick={() => downloadDocumento(doc)}
                    className="btn-secondary text-xs py-1 px-2"
                    disabled={loading}
                    title="Scarica documento"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Scarica
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteDocumento(doc)}
                    className="btn-danger text-xs py-1 px-2"
                    disabled={loading}
                    title="Elimina documento"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Elimina
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="gradient-primary text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Carica Documento</h3>
              </div>
              <button
                onClick={() => setShowUploadForm(false)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                disabled={uploading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File selezionato
                </label>
                <div className="p-2 bg-gray-50 rounded text-sm text-gray-600">
                  {uploadForm.file?.name} ({formatFileSize(uploadForm.file?.size)})
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome documento *
                </label>
                <input
                  type="text"
                  value={uploadForm.nome_file}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, nome_file: e.target.value }))}
                  className="input"
                  placeholder="Es: Visura camerale 2024"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria *
                </label>
                <select
                  value={uploadForm.categoria}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, categoria: e.target.value as any }))}
                  className="input"
                  required
                >
                  <option value="">Seleziona categoria</option>
                  {CATEGORIE_DOCUMENTO.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowUploadForm(false)}
                className="btn-secondary"
                disabled={uploading}
              >
                Annulla
              </button>
              <button
                onClick={uploadDocumento}
                className="btn-primary flex items-center space-x-2"
                disabled={uploading || !uploadForm.nome_file.trim() || !uploadForm.categoria}
              >
                {uploading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{uploading ? 'Caricando...' : 'Carica Documento'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}