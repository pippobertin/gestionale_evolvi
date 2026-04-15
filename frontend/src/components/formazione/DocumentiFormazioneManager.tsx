'use client'

import React, { useState, useEffect, useRef } from 'react'
import { FileText, Plus, Upload, Download, Trash2, Loader2, X, Search, FolderOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface DocumentoFormazione {
  id: string
  cliente_id: string
  categoria: string
  nome_file: string
  descrizione: string | null
  storage_path: string
  file_size: number | null
  mime_type: string | null
  uploaded_at: string
  uploaded_by: string | null
  piano_id: string | null
  corso_id: string | null
}

interface DocumentiFormazioneManagerProps {
  clienteId: string
}

const CATEGORIE = [
  { value: 'REGISTRO_PRESENZE', label: 'Registro presenze' },
  { value: 'ATTESTATO', label: 'Attestato/Certificato' },
  { value: 'VERBALE', label: 'Verbale' },
  { value: 'PROGRAMMA', label: 'Programma formativo' },
  { value: 'RENDICONTAZIONE', label: 'Rendicontazione' },
  { value: 'PROGETTO_FORMATIVO', label: 'Progetto formativo' },
  { value: 'MATERIALE_DIDATTICO', label: 'Materiale didattico' },
  { value: 'COMUNICAZIONI_FONDO', label: 'Comunicazioni fondo' },
  { value: 'ALTRO', label: 'Altro' },
]

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function DocumentiFormazioneManager({ clienteId }: DocumentiFormazioneManagerProps) {
  const [documenti, setDocumenti] = useState<DocumentoFormazione[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    categoria: 'ALTRO',
    descrizione: '',
  })

  useEffect(() => { loadDocumenti() }, [clienteId])

  const loadDocumenti = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('scadenze_bandi_documenti_formazione')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('uploaded_at', { ascending: false })

      if (error) throw error
      setDocumenti(data || [])
    } catch (err) {
      console.error('[DocumentiFormazioneManager] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadForm(prev => ({ ...prev, file: e.target.files![0] }))
      setShowUploadModal(true)
    }
  }

  const handleUpload = async () => {
    if (!uploadForm.file) return
    setUploading(true)
    try {
      const file = uploadForm.file
      const timestamp = Date.now()
      const storagePath = `formazione/${clienteId}/${timestamp}_${file.name}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documenti')
        .upload(storagePath, file)

      if (uploadError) throw uploadError

      // Create DB record
      const { error: dbError } = await supabase
        .from('scadenze_bandi_documenti_formazione')
        .insert({
          cliente_id: clienteId,
          categoria: uploadForm.categoria,
          nome_file: file.name,
          descrizione: uploadForm.descrizione || null,
          storage_path: storagePath,
          file_size: file.size,
          mime_type: file.type || null,
        })

      if (dbError) throw dbError

      setShowUploadModal(false)
      setUploadForm({ file: null, categoria: 'ALTRO', descrizione: '' })
      if (fileInputRef.current) fileInputRef.current.value = ''
      loadDocumenti()
    } catch (err) {
      console.error('[DocumentiFormazioneManager] Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (doc: DocumentoFormazione) => {
    try {
      const { data, error } = await supabase.storage
        .from('documenti')
        .download(doc.storage_path)

      if (error) throw error
      if (!data) return

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.nome_file
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[DocumentiFormazioneManager] Download error:', err)
    }
  }

  const handleDelete = async (doc: DocumentoFormazione) => {
    if (!confirm(`Eliminare "${doc.nome_file}"?`)) return
    try {
      // Delete from storage
      await supabase.storage.from('documenti').remove([doc.storage_path])

      // Delete DB record
      const { error } = await supabase
        .from('scadenze_bandi_documenti_formazione')
        .delete()
        .eq('id', doc.id)

      if (error) throw error
      loadDocumenti()
    } catch (err) {
      console.error('[DocumentiFormazioneManager] Delete error:', err)
    }
  }

  const filtered = documenti.filter(d => {
    if (filterCategoria && d.categoria !== filterCategoria) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return d.nome_file.toLowerCase().includes(term) ||
        (d.descrizione || '').toLowerCase().includes(term)
    }
    return true
  })

  // Group by category
  const grouped = filtered.reduce<Record<string, DocumentoFormazione[]>>((acc, doc) => {
    const cat = doc.categoria || 'ALTRO'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(doc)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center">
          <FileText className="w-4 h-4 mr-2" />
          Documenti formazione
          <span className="ml-2 text-xs text-gray-400 font-normal">({documenti.length})</span>
        </h4>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-7 pr-2 py-1.5 border border-gray-300 rounded-md text-xs w-40"
            />
          </div>
          <select
            value={filterCategoria}
            onChange={e => setFilterCategoria(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-md text-xs"
          >
            <option value="">Tutte le categorie</option>
            {CATEGORIE.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary text-sm py-1.5 px-3"
          >
            <Upload className="w-3.5 h-3.5 mr-1" /> Carica documento
          </button>
        </div>
      </div>

      {/* Empty state */}
      {documenti.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nessun documento caricato</p>
          <p className="text-gray-400 text-sm mt-1">Carica attestati, registri presenze, verbali e altri documenti</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary text-sm py-2 px-4 mt-4"
          >
            <Upload className="w-4 h-4 mr-1" /> Carica il primo documento
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500 text-sm">Nessun documento corrisponde ai filtri</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([cat, docs]) => {
            const catLabel = CATEGORIE.find(c => c.value === cat)?.label || cat

            return (
              <div key={cat} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center">
                  <FolderOpen className="w-3.5 h-3.5 text-gray-400 mr-2" />
                  <span className="text-xs font-semibold text-gray-600">{catLabel}</span>
                  <span className="ml-2 text-xs text-gray-400">({docs.length})</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {docs.map(doc => (
                    <div key={doc.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900 truncate">{doc.nome_file}</span>
                          {doc.file_size && (
                            <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(doc.file_size)}</span>
                          )}
                        </div>
                        {doc.descrizione && (
                          <p className="text-xs text-gray-500 mt-0.5 ml-6">{doc.descrizione}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5 ml-6">
                          {new Date(doc.uploaded_at).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1 ml-2">
                        <button onClick={() => handleDownload(doc)} className="p-1 hover:bg-gray-100 rounded" title="Scarica">
                          <Download className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button onClick={() => handleDelete(doc)} className="p-1 hover:bg-red-50 rounded" title="Elimina">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Carica documento</h3>
              <button onClick={() => { setShowUploadModal(false); setUploadForm({ file: null, categoria: 'ALTRO', descrizione: '' }) }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {uploadForm.file && (
                <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{uploadForm.file.name}</p>
                    <p className="text-xs text-gray-500">{formatBytes(uploadForm.file.size)}</p>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
                <select
                  value={uploadForm.categoria}
                  onChange={e => setUploadForm({ ...uploadForm, categoria: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {CATEGORIE.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <input
                  type="text"
                  value={uploadForm.descrizione}
                  onChange={e => setUploadForm({ ...uploadForm, descrizione: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Breve descrizione del documento"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button onClick={() => { setShowUploadModal(false); setUploadForm({ file: null, categoria: 'ALTRO', descrizione: '' }) }} className="btn-secondary text-sm py-2 px-4">
                Annulla
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadForm.file}
                className="btn-primary text-sm py-2 px-4"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Carica'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
