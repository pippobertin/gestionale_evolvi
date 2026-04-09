'use client'

import React, { useState, useEffect } from 'react'
import {
  Send, Upload, Download, RefreshCw, Bell, CheckCircle,
  AlertCircle, Clock, FileText, Mail, X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ContractTracking, TRACKING_STATI } from '@/types/evolvi-contract'
import { getSignedUrl, BUCKET_CONTRATTI } from '@/lib/supabaseStorage'
import SignedContractUploadForm from './SignedContractUploadForm'

interface ContractTrackingPanelProps {
  entityType: string
  entityId: string
  clienteId: string
}

const TIMELINE_STEPS = [
  { key: 'DRAFT', label: 'Bozza', icon: FileText },
  { key: 'SENT', label: 'Inviato', icon: Send },
  { key: 'DELIVERED', label: 'Consegnato', icon: Mail },
  { key: 'SIGNED_RECEIVED', label: 'Firmato Ricevuto', icon: CheckCircle },
  { key: 'COMPLETED', label: 'Completato', icon: CheckCircle }
] as const

function getStepStatus(stepKey: string, currentStatus: string): 'completed' | 'current' | 'pending' | 'failed' {
  if (currentStatus === 'FAILED') return 'failed'

  const stepOrder = ['DRAFT', 'SENT', 'DELIVERED', 'SIGNED_RECEIVED', 'COMPLETED']
  const stepIdx = stepOrder.indexOf(stepKey)
  let currentIdx = stepOrder.indexOf(currentStatus)
  if (currentStatus === 'REMINDED') currentIdx = 2

  if (stepIdx < currentIdx) return 'completed'
  if (stepIdx === currentIdx) return 'current'
  return 'pending'
}

export default function ContractTrackingPanel({ entityType, entityId, clienteId }: ContractTrackingPanelProps) {
  const [tracking, setTracking] = useState<ContractTracking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)

  useEffect(() => {
    loadTracking()
  }, [entityType, entityId])

  const loadTracking = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('scadenze_bandi_contract_tracking')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (fetchError) throw fetchError
      setTracking(data)
    } catch (err: any) {
      console.error('Errore caricamento tracking:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSendReminder = async () => {
    if (!tracking) return
    if (!confirm('Inviare un sollecito al cliente per la firma del contratto?')) return

    try {
      setSendingReminder(true)
      setError(null)

      const res = await fetch(`/api/contracts/tracking/${tracking.id}/send-reminder`, {
        method: 'POST'
      })

      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      await loadTracking()
    } catch (err: any) {
      console.error('Errore invio sollecito:', err)
      setError(err.message || 'Errore nell\'invio del sollecito')
    } finally {
      setSendingReminder(false)
    }
  }

  const handleDownloadSigned = async () => {
    if (!tracking?.signed_contract_storage_path) return

    try {
      // Use the Supabase storage directly from client
      const { data, error: signedUrlError } = await supabase.storage
        .from('contratti-firmati')
        .createSignedUrl(tracking.signed_contract_storage_path, 3600)

      if (signedUrlError) throw signedUrlError
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch (err: any) {
      console.error('Errore download contratto firmato:', err)
      setError(err.message || 'Errore nel download del contratto firmato')
    }
  }

  const handleUploadSuccess = () => {
    setShowUploadForm(false)
    loadTracking()
  }

  const handleMarkCompleted = async () => {
    if (!tracking) return
    if (!confirm('Segnare il tracking come completato?')) return

    try {
      const res = await fetch(`/api/contracts/tracking/${tracking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overall_status: 'COMPLETED' })
      })

      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      await loadTracking()
    } catch (err: any) {
      console.error('Errore completamento tracking:', err)
      setError(err.message || 'Errore nel completamento del tracking')
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Caricamento tracking...</p>
        </div>
      </div>
    )
  }

  if (!tracking) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
        <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-500">Nessun tracking disponibile per questo contratto</p>
      </div>
    )
  }

  const currentStatus = tracking.overall_status
  const statusInfo = TRACKING_STATI[currentStatus]

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h5 className="text-sm font-medium text-gray-900 flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          Tracking Contratto
        </h5>
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo?.bgColor || 'bg-gray-100'} ${statusInfo?.color || 'text-gray-700'}`}>
            {statusInfo?.label || currentStatus}
          </span>
          <button
            type="button"
            onClick={loadTracking}
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            title="Aggiorna"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Vertical Timeline */}
        <div className="space-y-0">
          {TIMELINE_STEPS.map((step, idx) => {
            const status = getStepStatus(step.key, currentStatus)
            const Icon = step.icon
            const isLast = idx === TIMELINE_STEPS.length - 1

            let dotColor = 'bg-gray-300 text-gray-400'
            let lineColor = 'bg-gray-200'
            let textColor = 'text-gray-400'

            if (status === 'completed') {
              dotColor = 'bg-green-500 text-white'
              lineColor = 'bg-green-400'
              textColor = 'text-gray-700'
            } else if (status === 'current') {
              dotColor = 'bg-blue-500 text-white ring-2 ring-blue-200'
              lineColor = 'bg-gray-200'
              textColor = 'text-blue-700 font-medium'
            } else if (status === 'failed') {
              dotColor = 'bg-red-500 text-white'
              lineColor = 'bg-red-200'
              textColor = 'text-red-600'
            }

            // Get date for this step
            let dateStr: string | null = null
            if (step.key === 'SENT' && tracking.email_sent_at) {
              dateStr = new Date(tracking.email_sent_at).toLocaleString('it-IT')
            } else if (step.key === 'SIGNED_RECEIVED' && tracking.signed_contract_received_at) {
              dateStr = new Date(tracking.signed_contract_received_at).toLocaleString('it-IT')
            }

            return (
              <div key={step.key} className="flex">
                {/* Timeline column */}
                <div className="flex flex-col items-center mr-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${dotColor} transition-all`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 h-8 ${lineColor}`}></div>
                  )}
                </div>

                {/* Content */}
                <div className="pb-4 flex-1 min-w-0">
                  <div className={`text-sm ${textColor}`}>{step.label}</div>
                  {dateStr && (
                    <div className="text-xs text-gray-400 mt-0.5">{dateStr}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Email delivery status */}
        {tracking.email_sent && (
          <div className="border border-gray-200 rounded-lg p-3 space-y-1">
            <div className="flex items-center space-x-2 text-sm">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-700">Stato Consegna Email</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                tracking.email_delivery_status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                tracking.email_delivery_status === 'BOUNCED' || tracking.email_delivery_status === 'FAILED' ? 'bg-red-100 text-red-700' :
                tracking.email_delivery_status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {tracking.email_delivery_status}
              </span>
              {tracking.email_sent_to && (
                <span className="text-gray-500">a {tracking.email_sent_to}</span>
              )}
            </div>
            {tracking.email_delivery_error && (
              <p className="text-xs text-red-600 mt-1">{tracking.email_delivery_error}</p>
            )}
          </div>
        )}

        {/* Reminder info */}
        {tracking.reminder_sent_count > 0 && (
          <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-sm text-yellow-700">
              <Bell className="w-4 h-4" />
              <span className="font-medium">
                {tracking.reminder_sent_count} sollecit{tracking.reminder_sent_count === 1 ? 'o' : 'i'} inviat{tracking.reminder_sent_count === 1 ? 'o' : 'i'}
              </span>
            </div>
            {tracking.last_reminder_sent_at && (
              <p className="text-xs text-yellow-600 mt-1">
                Ultimo: {new Date(tracking.last_reminder_sent_at).toLocaleString('it-IT')}
              </p>
            )}
          </div>
        )}

        {/* Signed contract download */}
        {tracking.signed_contract_received && tracking.signed_contract_storage_path && (
          <div className="border border-green-200 bg-green-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">Contratto Firmato Ricevuto</span>
              </div>
              <button
                type="button"
                onClick={handleDownloadSigned}
                className="inline-flex items-center text-sm text-green-700 hover:text-green-800 font-medium"
              >
                <Download className="w-4 h-4 mr-1" />
                Scarica
              </button>
            </div>
            {tracking.signed_contract_notes && (
              <p className="text-xs text-green-600 mt-1">{tracking.signed_contract_notes}</p>
            )}
            {tracking.signed_contract_received_at && (
              <p className="text-xs text-green-500 mt-1">
                Ricevuto: {new Date(tracking.signed_contract_received_at).toLocaleString('it-IT')}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          {/* Upload signed contract button */}
          {!tracking.signed_contract_received && currentStatus !== 'DRAFT' && currentStatus !== 'COMPLETED' && (
            <button
              type="button"
              onClick={() => setShowUploadForm(true)}
              className="btn-primary text-sm py-2 px-3"
            >
              <Upload className="w-4 h-4 mr-1" />
              Carica Contratto Firmato
            </button>
          )}

          {/* Send reminder button */}
          {tracking.email_sent && !tracking.signed_contract_received && currentStatus !== 'FAILED' && (
            <button
              type="button"
              onClick={handleSendReminder}
              className="btn-secondary text-sm py-2 px-3"
              disabled={sendingReminder}
            >
              {sendingReminder ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  Invio...
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 mr-1" />
                  Invia Sollecito
                </>
              )}
            </button>
          )}

          {/* Mark as completed */}
          {tracking.signed_contract_received && currentStatus !== 'COMPLETED' && (
            <button
              type="button"
              onClick={handleMarkCompleted}
              className="btn-primary text-sm py-2 px-3"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Segna Completato
            </button>
          )}
        </div>
      </div>

      {/* Upload form modal */}
      {showUploadForm && tracking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <SignedContractUploadForm
              trackingId={tracking.id}
              onSuccess={handleUploadSuccess}
              onClose={() => setShowUploadForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
