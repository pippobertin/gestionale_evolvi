'use client'

import React, { useState, useRef } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'

interface SignedContractUploadFormProps {
  trackingId: string
  onSuccess: () => void
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function SignedContractUploadForm({ trackingId, onSuccess, onClose }: SignedContractUploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate PDF
    if (selectedFile.type !== 'application/pdf') {
      setError('Sono accettati solo file PDF')
      return
    }

    setFile(selectedFile)
    setError(null)
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Seleziona un file PDF')
      return
    }

    try {
      setUploading(true)
      setError(null)

      const formData = new FormData()
      formData.append('file', file)
      if (notes.trim()) {
        formData.append('notes', notes.trim())
      }

      const res = await fetch(`/api/contracts/tracking/${trackingId}/upload-signed`, {
        method: 'POST',
        body: formData
      })

      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      setSuccess(true)
      setTimeout(() => {
        onSuccess()
      }, 1500)

    } catch (err: any) {
      console.error('Errore upload contratto firmato:', err)
      setError(err.message || 'Errore nel caricamento del contratto firmato')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Upload className="w-5 h-5 mr-2" />
          Carica Contratto Firmato
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Success message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Contratto firmato caricato con successo!</p>
            <p className="text-xs text-green-600 mt-0.5">Lo stato del tracking verrà aggiornato automaticamente.</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!success && (
        <>
          {/* File input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File PDF del contratto firmato *
            </label>

            {file ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 min-w-0">
                  <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-blue-900 truncate">{file.name}</p>
                    <p className="text-xs text-blue-600">{formatBytes(file.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="text-blue-400 hover:text-blue-600 ml-2 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">Clicca per selezionare il file PDF</p>
                <p className="text-xs text-gray-400 mt-1">Solo file PDF</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note (opzionale)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="input-field text-sm"
              placeholder="Note aggiuntive sul contratto firmato..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-sm py-2 px-4"
              disabled={uploading}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleUpload}
              className="btn-primary text-sm py-2 px-4"
              disabled={uploading || !file}
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  Caricamento...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-1" />
                  Carica Contratto Firmato
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
