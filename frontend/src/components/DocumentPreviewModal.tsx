'use client'

import React, { useEffect, useState } from 'react'
import { X, RefreshCw, AlertCircle } from 'lucide-react'

interface DocumentPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  googleDriveId: string
  onRefresh?: () => void
}

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  title,
  googleDriveId,
  onRefresh
}: DocumentPreviewModalProps) {
  const [iframeKey, setIframeKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  if (!isOpen) return null

  const previewUrl = `https://drive.google.com/file/d/${googleDriveId}/preview`

  const handleRefresh = async () => {
    setIsRefreshing(true)

    // Force iframe refresh by changing key
    setIframeKey(prev => prev + 1)

    // Call parent refresh function if provided
    if (onRefresh) {
      await onRefresh()
    }

    setTimeout(() => setIsRefreshing(false), 1000)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {title}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Aggiorna preview"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Chiudi preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 relative bg-gray-50">
            <iframe
              key={iframeKey}
              src={previewUrl}
              title={`Preview di ${title}`}
              className="w-full h-full border-0 rounded-b-lg"
              allow="autoplay"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Preview da Google Drive - Le modifiche sono in tempo reale
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => window.open(`https://docs.google.com/document/d/${googleDriveId}/edit`, '_blank')}
                  className="btn-secondary text-sm"
                >
                  Modifica in Drive
                </button>
                <button
                  onClick={onClose}
                  className="btn-primary text-sm"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}