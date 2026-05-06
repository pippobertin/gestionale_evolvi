'use client'

import React, { useState, useEffect } from 'react'
import { Bell, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ContractTracking, TRACKING_STATI } from '@/types/evolvi-contract'

interface ContractTrackingWidgetProps {
  entityType: string
  entityId: string
}

const TIMELINE_STEPS = [
  { key: 'DRAFT', label: 'Bozza' },
  { key: 'SENT', label: 'Inviato' },
  { key: 'DELIVERED', label: 'Consegnato' },
  { key: 'SIGNED_RECEIVED', label: 'Firmato' },
  { key: 'COMPLETED', label: 'Completato' }
] as const

function getStepIndex(status: string): number {
  const idx = TIMELINE_STEPS.findIndex(s => s.key === status)
  // REMINDED is between DELIVERED and SIGNED_RECEIVED
  if (status === 'REMINDED') return 2
  if (status === 'FAILED') return -1
  return idx >= 0 ? idx : 0
}

function getStepColor(stepKey: string, currentStatus: string): { dot: string; line: string } {
  const stepIdx = TIMELINE_STEPS.findIndex(s => s.key === stepKey)
  const currentIdx = getStepIndex(currentStatus)

  if (currentStatus === 'FAILED') {
    return { dot: 'bg-red-500', line: 'bg-red-200' }
  }

  if (stepIdx < currentIdx) {
    return { dot: 'bg-green-500', line: 'bg-green-400' }
  } else if (stepIdx === currentIdx) {
    return { dot: 'bg-blue-500 ring-2 ring-blue-200', line: 'bg-gray-200' }
  }
  return { dot: 'bg-gray-300', line: 'bg-gray-200' }
}

export default function ContractTrackingWidget({ entityType, entityId }: ContractTrackingWidgetProps) {
  const [tracking, setTracking] = useState<ContractTracking | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTracking()
  }, [entityType, entityId])

  const loadTracking = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('scadenze_bandi_contract_tracking')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      setTracking(data)
    } catch (err: any) {
      console.error('Errore caricamento tracking:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!tracking) {
    return (
      <div className="text-xs text-gray-400 py-1">
        Nessun tracking disponibile
      </div>
    )
  }

  const currentStatus = tracking.overall_status
  const statusInfo = TRACKING_STATI[currentStatus]

  return (
    <div className="space-y-2">
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusInfo?.bgColor || 'bg-gray-100'} ${statusInfo?.color || 'text-gray-700'}`}>
          {statusInfo?.label || currentStatus}
        </span>
        {tracking.reminder_sent_count > 0 && (
          <span className="inline-flex items-center text-xs text-yellow-600">
            <Bell className="w-3 h-3 mr-1" />
            {tracking.reminder_sent_count} sollecit{tracking.reminder_sent_count === 1 ? 'o' : 'i'}
          </span>
        )}
      </div>

      {/* Compact horizontal timeline */}
      <div className="flex items-center space-x-0">
        {TIMELINE_STEPS.map((step, idx) => {
          const colors = getStepColor(step.key, currentStatus)
          const isLast = idx === TIMELINE_STEPS.length - 1

          return (
            <React.Fragment key={step.key}>
              {/* Dot */}
              <div className="flex flex-col items-center" title={step.label}>
                <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} transition-all`}></div>
                <span className="text-[9px] text-gray-500 mt-0.5 whitespace-nowrap">
                  {step.label}
                </span>
              </div>

              {/* Line */}
              {!isLast && (
                <div className={`flex-1 h-0.5 ${colors.line} min-w-[12px] mt-[-10px]`}></div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Date info */}
      <div className="text-[10px] text-gray-400 space-y-0.5">
        {tracking.email_sent_at && (
          <div>Inviato: {new Date(tracking.email_sent_at).toLocaleDateString('it-IT')}</div>
        )}
        {tracking.signed_contract_received_at && (
          <div>Firmato: {new Date(tracking.signed_contract_received_at).toLocaleDateString('it-IT')}</div>
        )}
      </div>

      {/* Failed status warning */}
      {currentStatus === 'FAILED' && (
        <div className="flex items-center text-xs text-red-600 bg-red-50 rounded p-1.5">
          <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
          <span>{tracking.email_delivery_error || 'Errore nella consegna'}</span>
        </div>
      )}
    </div>
  )
}
