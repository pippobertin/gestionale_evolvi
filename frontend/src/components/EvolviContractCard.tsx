'use client'

import React, { useState } from 'react'
import { FileText, CheckCircle, Mail, ExternalLink, RefreshCw, Eye, Loader2, Calendar, Euro, CreditCard, RotateCcw, Trash2, FileDown } from 'lucide-react'
import { ContrattoEvolvi, CONTRATTO_EVOLVI_STATI } from '@/types/evolvi-contract'
import { useEvolviContractGeneration } from '@/hooks/useEvolviContractGeneration'

interface EvolviContractCardProps {
  contract: ContrattoEvolvi
  onRefresh: () => void
}

const STATO_BORDER_COLORS: Record<string, string> = {
  bozza: 'border-l-gray-400',
  in_revisione: 'border-l-yellow-400',
  approvato: 'border-l-blue-400',
  inviato: 'border-l-indigo-400',
  firmato: 'border-l-green-400',
  attivo: 'border-l-emerald-400',
  scaduto: 'border-l-red-400',
  annullato: 'border-l-gray-300'
}

export default function EvolviContractCard({ contract, onRefresh }: EvolviContractCardProps) {
  const [actionLoading, setActionLoading] = useState(false)
  const { generateContract, approveContract, sendEmail, renewContract } = useEvolviContractGeneration()

  const statoConfig = CONTRATTO_EVOLVI_STATI[contract.stato] || CONTRATTO_EVOLVI_STATI.bozza
  const borderColor = STATO_BORDER_COLORS[contract.stato] || 'border-l-gray-400'

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('it-IT')
  }

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '-'
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
  }

  const handleGenerate = async () => {
    try {
      setActionLoading(true)
      await generateContract({ contrattoId: contract.id, clienteId: contract.cliente_id })
      onRefresh()
    } catch (err) {
      console.error('Errore generazione:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = async () => {
    try {
      setActionLoading(true)
      await approveContract(contract.id)
      onRefresh()
    } catch (err) {
      console.error('Errore approvazione:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSendEmail = async () => {
    try {
      setActionLoading(true)
      await sendEmail({ contrattoId: contract.id })
      onRefresh()
    } catch (err) {
      console.error('Errore invio email:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRenew = async () => {
    try {
      setActionLoading(true)
      await renewContract(contract.id)
      onRefresh()
    } catch (err) {
      console.error('Errore rinnovo:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    const label = contract.numero_contratto || 'questa bozza'
    if (!window.confirm(`Sei sicuro di voler eliminare il contratto "${label}"? Verranno eliminati anche i file su Google Drive e i record correlati (fatture, tracking, scadenze). Questa azione è irreversibile.`)) {
      return
    }
    try {
      setActionLoading(true)
      const res = await fetch(`/api/contracts/evolvi/${contract.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Errore durante l\'eliminazione')
        return
      }
      onRefresh()
    } catch (err) {
      console.error('Errore eliminazione:', err)
      alert('Errore durante l\'eliminazione del contratto')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className={`border border-gray-200 rounded-lg bg-white border-l-4 ${borderColor}`}>
      <div className="p-4">
        {/* Top row: numero contratto + stato badge + actions */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <FileText className="w-4 h-4 text-gray-500" />
            <div>
              <h5 className="font-medium text-gray-900 text-sm">
                {contract.numero_contratto || 'Bozza (senza numero)'}
              </h5>
              <p className="text-xs text-gray-500">
                Creato il {formatDate(contract.created_at)}
              </p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statoConfig.bgColor} ${statoConfig.color}`}>
              {statoConfig.label}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Link to document */}
            {contract.contract_word_url && (
              <a
                href={contract.contract_word_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs py-1 px-2 flex items-center space-x-1"
                title="Apri documento su Google Docs"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Documento</span>
              </a>
            )}

            {/* Link to PDF */}
            {contract.contract_pdf_url && (
              <a
                href={contract.contract_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs py-1 px-2 flex items-center space-x-1 text-red-600 border-red-200 hover:bg-red-50"
                title="Apri PDF approvato"
              >
                <FileDown className="w-3 h-3" />
                <span>PDF</span>
              </a>
            )}

            {/* State-based actions */}
            {contract.stato === 'bozza' && (
              <button
                type="button"
                onClick={handleGenerate}
                className="btn-primary text-xs py-1 px-2 flex items-center space-x-1"
                disabled={actionLoading}
                title="Genera documento contratto"
              >
                {actionLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
                <span>Genera Contratto</span>
              </button>
            )}

            {contract.stato === 'in_revisione' && (
              <button
                type="button"
                onClick={handleApprove}
                className="btn-primary text-xs py-1 px-2 flex items-center space-x-1 bg-green-600 hover:bg-green-700"
                disabled={actionLoading}
                title="Approva contratto"
              >
                {actionLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircle className="w-3 h-3" />
                )}
                <span>Approva</span>
              </button>
            )}

            {contract.stato === 'approvato' && (
              <button
                type="button"
                onClick={handleSendEmail}
                className="btn-primary text-xs py-1 px-2 flex items-center space-x-1"
                disabled={actionLoading}
                title="Invia contratto via email"
              >
                {actionLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Mail className="w-3 h-3" />
                )}
                <span>Invia Email</span>
              </button>
            )}

            {(contract.stato === 'inviato' || contract.stato === 'firmato' || contract.stato === 'attivo') && (
              <span className={`text-xs py-1 px-2 rounded ${statoConfig.bgColor} ${statoConfig.color} font-medium`}>
                {statoConfig.label}
              </span>
            )}

            {contract.stato === 'scaduto' && contract.rinnovo_automatico && (
              <button
                type="button"
                onClick={handleRenew}
                className="btn-primary text-xs py-1 px-2 flex items-center space-x-1"
                disabled={actionLoading}
                title="Rinnova contratto"
              >
                {actionLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
                <span>Rinnova</span>
              </button>
            )}

            {/* Elimina contratto */}
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs py-1 px-2 flex items-center space-x-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
              disabled={actionLoading}
              title="Elimina contratto"
            >
              {actionLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Info row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div className="flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Periodo</p>
              <p className="text-xs font-medium text-gray-700">
                {formatDate(contract.data_inizio)} - {formatDate(contract.data_fine)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <Euro className="w-3.5 h-3.5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Annuale</p>
              <p className="text-xs font-medium text-gray-700">
                {formatCurrency(contract.importo_annuale)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <Euro className="w-3.5 h-3.5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Totale</p>
              <p className="text-xs font-medium text-gray-700">
                {formatCurrency(contract.importo_totale)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <CreditCard className="w-3.5 h-3.5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Pagamento</p>
              <p className="text-xs font-medium text-gray-700 capitalize">
                {contract.modalita_pagamento || '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Rinnovo Auto</p>
              <p className="text-xs font-medium text-gray-700">
                {contract.rinnovo_automatico ? 'Si' : 'No'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
