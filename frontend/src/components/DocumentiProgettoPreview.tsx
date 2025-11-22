'use client'

import React, { useState, useEffect } from 'react'
import { FileText, Eye, Download, ExternalLink, Clock, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import DocumentPreviewModal from './DocumentPreviewModal'

interface DocumentoProgetto {
  id: string
  progetto_id: string
  bando_id: string
  nome_file: string
  nome_originale: string
  categoria: 'allegato' | 'normativa'
  tipo_documento: string
  url_file: string
  google_drive_id?: string
  google_drive_modified?: string
  google_drive_url?: string
  last_checked?: string
  has_changes?: boolean
  created_at: string
  updated_at: string
}

interface DocumentiProgettoPreviewProps {
  progettoId: string
  className?: string
}

export default function DocumentiProgettoPreview({ progettoId, className = '' }: DocumentiProgettoPreviewProps) {
  const [documenti, setDocumenti] = useState<DocumentoProgetto[]>([])
  const [loading, setLoading] = useState(false)
  const [checkingChanges, setCheckingChanges] = useState<string | null>(null)
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean
    documento: DocumentoProgetto | null
  }>({ isOpen: false, documento: null })

  useEffect(() => {
    if (progettoId) {
      loadDocumenti()
    }
  }, [progettoId])

  const loadDocumenti = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('scadenze_bandi_documenti_progetto')
        .select('*')
        .eq('progetto_id', progettoId)
        .eq('categoria', 'allegato') // Solo allegati, come richiesto
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocumenti(data || [])
    } catch (error) {
      console.error('Errore caricamento documenti progetto:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkForChanges = async (documento: DocumentoProgetto) => {
    if (!documento.google_drive_id) return

    try {
      setCheckingChanges(documento.id)

      // Chiama API per verificare modifiche su Google Drive
      const response = await fetch('/api/drive/check-file-changes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileId: documento.google_drive_id,
          lastChecked: documento.last_checked
        })
      })

      if (response.ok) {
        const result = await response.json()

        // Aggiorna il database con i nuovi dati
        const { error } = await supabase
          .from('scadenze_bandi_documenti_progetto')
          .update({
            google_drive_modified: result.modifiedTime,
            last_checked: new Date().toISOString(),
            has_changes: result.hasChanges
          })
          .eq('id', documento.id)

        if (!error) {
          // Ricarica documenti per aggiornare l'UI
          await loadDocumenti()
        }
      }
    } catch (error) {
      console.error('Errore controllo modifiche:', error)
    } finally {
      setCheckingChanges(null)
    }
  }

  const openInDrive = (documento: DocumentoProgetto) => {
    if (documento.google_drive_url) {
      window.open(documento.google_drive_url, '_blank')
    }
  }

  const downloadFromSupabase = async (documento: DocumentoProgetto) => {
    try {
      // Prima prova a scaricare da Supabase
      const { data, error } = await supabase.storage
        .from('progetti-documenti')
        .download(documento.url_file)

      if (error) {
        console.warn('File non trovato in Supabase, provo da Google Drive:', error)
        // Se il file non esiste in Supabase, reindirizzo a Google Drive
        if (documento.google_drive_url) {
          window.open(documento.google_drive_url, '_blank')
          return
        } else {
          throw new Error('File non disponibile né in Supabase né in Google Drive')
        }
      }

      // Create download link per file da Supabase
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = documento.nome_originale
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Errore download documento:', error)
      alert('Errore nel download del documento. Il file potrebbe essere disponibile solo su Google Drive.')
    }
  }

  const previewDocument = (documento: DocumentoProgetto) => {
    console.log('🔍 Preview documento:', {
      nome: documento.nome_file,
      google_drive_id: documento.google_drive_id,
      google_drive_url: documento.google_drive_url
    })

    if (documento.google_drive_id) {
      // Apri modal interno per preview
      console.log('✅ Aprendo modal per documento con google_drive_id')
      setPreviewModal({ isOpen: true, documento })
    } else if (documento.google_drive_url) {
      // Estrai google_drive_id dall'URL se possibile
      const driveIdMatch = documento.google_drive_url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
      if (driveIdMatch) {
        const extractedId = driveIdMatch[1]
        console.log('✅ Estratto google_drive_id dall\'URL:', extractedId)
        // Crea un documento temporaneo con l'ID estratto
        const documentoConId = { ...documento, google_drive_id: extractedId }
        setPreviewModal({ isOpen: true, documento: documentoConId })
      } else {
        // Fallback all'URL di visualizzazione normale in nuova tab
        console.log('⚠️ Fallback a nuova scheda - ID non estraibile dall\'URL')
        window.open(documento.google_drive_url, '_blank')
      }
    } else {
      alert('Preview non disponibile - documento non sincronizzato con Google Drive')
    }
  }

  const getStatusIcon = (documento: DocumentoProgetto) => {
    if (documento.has_changes) {
      return <AlertCircle className="w-4 h-4 text-amber-500" title="Documento modificato su Drive" />
    }
    if (documento.google_drive_id) {
      return <CheckCircle className="w-4 h-4 text-green-500" title="Sincronizzato con Drive" />
    }
    return <Clock className="w-4 h-4 text-gray-400" title="Non sincronizzato" />
  }

  const getStatusText = (documento: DocumentoProgetto) => {
    if (documento.has_changes) {
      return 'Modificato su Drive'
    }
    if (documento.google_drive_id) {
      return 'Sincronizzato'
    }
    return 'Non sincronizzato'
  }

  const getStatusColor = (documento: DocumentoProgetto) => {
    if (documento.has_changes) {
      return 'text-amber-600 bg-amber-50'
    }
    if (documento.google_drive_id) {
      return 'text-green-600 bg-green-50'
    }
    return 'text-gray-500 bg-gray-50'
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow border p-6 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mr-2"></div>
          <span className="text-gray-600">Caricamento documenti...</span>
        </div>
      </div>
    )
  }

  if (documenti.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow border p-6 ${className}`}>
        <div className="text-center">
          <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <p className="text-gray-600">Nessun allegato disponibile per questo progetto</p>
          <p className="text-sm text-gray-500 mt-1">
            Gli allegati vengono ereditati automaticamente dal bando quando si crea il progetto
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow border ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Preview Documenti ({documenti.length})
          </h3>
          <button
            onClick={loadDocumenti}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Aggiorna
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {documenti.map((documento) => (
          <div key={documento.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-medium text-gray-900">{documento.nome_file}</h4>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(documento)}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(documento)}`}>
                      {getStatusText(documento)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
                  <div>
                    <span className="text-gray-500">Tipo:</span>
                    <span className="ml-1 capitalize">{documento.tipo_documento}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Caricato:</span>
                    <span className="ml-1">{formatDate(documento.created_at)}</span>
                  </div>
                  {documento.google_drive_modified && (
                    <div>
                      <span className="text-gray-500">Ultima modifica Drive:</span>
                      <span className="ml-1">{formatDate(documento.google_drive_modified)}</span>
                    </div>
                  )}
                </div>

                {documento.has_changes && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                    ⚠️ <strong>Documento modificato su Google Drive</strong> -
                    Scarica la versione aggiornata o visualizza le modifiche nel Drive.
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 ml-4">
                {documento.google_drive_id && (
                  <button
                    onClick={() => previewDocument(documento)}
                    className="btn-primary text-xs py-1 px-2 flex items-center"
                    title="Anteprima documento"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Preview
                  </button>
                )}

                {documento.google_drive_url && (
                  <button
                    onClick={() => openInDrive(documento)}
                    className="btn-secondary text-xs py-1 px-2 flex items-center"
                    title="Apri in Google Drive"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Drive
                  </button>
                )}

                <button
                  onClick={() => downloadFromSupabase(documento)}
                  className="btn-secondary text-xs py-1 px-2 flex items-center"
                  title="Scarica documento"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </button>

                {documento.google_drive_id && (
                  <button
                    onClick={() => checkForChanges(documento)}
                    disabled={checkingChanges === documento.id}
                    className="btn-secondary text-xs py-1 px-2 flex items-center"
                    title="Controlla modifiche"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${checkingChanges === documento.id ? 'animate-spin' : ''}`} />
                    {checkingChanges === documento.id ? 'Controllo...' : 'Check'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Preview */}
      <DocumentPreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, documento: null })}
        title={previewModal.documento?.nome_file || ''}
        googleDriveId={previewModal.documento?.google_drive_id || ''}
        onRefresh={() => previewModal.documento ? checkForChanges(previewModal.documento) : Promise.resolve()}
      />
    </div>
  )
}