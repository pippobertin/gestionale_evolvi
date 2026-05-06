'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { FileText, Euro, Clock, CheckCircle, AlertTriangle, Filter, X, Loader2, CreditCard, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { EvolviFattura, FATTURA_STATI } from '@/types/evolvi-contract'

interface EvolviInvoicesContentProps {
  clienteId: string
}

interface SummaryStats {
  totaleFatturato: number
  incassato: number
  daIncassare: number
  scaduto: number
}

export default function EvolviInvoicesContent({ clienteId }: EvolviInvoicesContentProps) {
  const [fatture, setFatture] = useState<EvolviFattura[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroStato, setFiltroStato] = useState<string>('ALL')
  const [selectedFattura, setSelectedFattura] = useState<EvolviFattura | null>(null)
  const [markPaidLoading, setMarkPaidLoading] = useState(false)
  const [markPaidError, setMarkPaidError] = useState<string | null>(null)

  // Mark as paid form
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0])
  const [metodoPagamento, setMetodoPagamento] = useState('')
  const [riferimentoPagamento, setRiferimentoPagamento] = useState('')

  const fetchFatture = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('scadenze_bandi_evolvi_fatture')
        .select('*, scadenze_bandi_contratti_evolvi(numero_contratto)')
        .eq('cliente_id', clienteId)
        .order('data_scadenza_pagamento', { ascending: true })

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      const mapped = (data || []).map((f: any) => ({
        ...f,
        numero_contratto: f.scadenze_bandi_contratti_evolvi?.numero_contratto || null,
        scadenze_bandi_contratti_evolvi: undefined
      }))

      setFatture(mapped)
    } catch (err: any) {
      console.error('Errore nel recupero fatture:', err)
      setError(err.message || 'Errore nel recupero delle fatture')
    } finally {
      setLoading(false)
    }
  }, [clienteId])

  useEffect(() => {
    fetchFatture()
  }, [fetchFatture])

  const stats: SummaryStats = fatture.reduce(
    (acc, f) => {
      acc.totaleFatturato += f.importo_totale || 0
      if (f.stato_pagamento === 'PAID') acc.incassato += f.importo_totale || 0
      if (f.stato_pagamento === 'PENDING') acc.daIncassare += f.importo_totale || 0
      if (f.stato_pagamento === 'OVERDUE') acc.scaduto += f.importo_totale || 0
      return acc
    },
    { totaleFatturato: 0, incassato: 0, daIncassare: 0, scaduto: 0 }
  )

  const filteredFatture = filtroStato === 'ALL'
    ? fatture
    : fatture.filter(f => f.stato_pagamento === filtroStato)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('it-IT')
  }

  const formatPeriodo = (inizio?: string, fine?: string) => {
    if (!inizio || !fine) return '-'
    return `${formatDate(inizio)} - ${formatDate(fine)}`
  }

  const handleMarkPaid = async () => {
    if (!selectedFattura) return

    try {
      setMarkPaidLoading(true)
      setMarkPaidError(null)

      const res = await fetch(`/api/evolvi/fatture/${selectedFattura.id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_pagamento: dataPagamento,
          metodo_pagamento: metodoPagamento || undefined,
          riferimento_pagamento: riferimentoPagamento || undefined
        })
      })

      const result = await res.json()

      if (!result.success) {
        setMarkPaidError(result.error || 'Errore nel segnare come pagata')
        return
      }

      setSelectedFattura(null)
      setMetodoPagamento('')
      setRiferimentoPagamento('')
      fetchFatture()
    } catch (err: any) {
      console.error('Errore mark-paid:', err)
      setMarkPaidError(err.message || 'Errore nella richiesta')
    } finally {
      setMarkPaidLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        <span className="ml-2 text-gray-600">Caricamento fatture...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Euro className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500 font-medium">Totale Fatturato</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">{formatCurrency(stats.totaleFatturato)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-500 font-medium">Incassato</span>
          </div>
          <p className="text-sm font-semibold text-green-700">{formatCurrency(stats.incassato)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Clock className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-gray-500 font-medium">Da Incassare</span>
          </div>
          <p className="text-sm font-semibold text-yellow-700">{formatCurrency(stats.daIncassare)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-gray-500 font-medium">Scaduto</span>
          </div>
          <p className="text-sm font-semibold text-red-700">{formatCurrency(stats.scaduto)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center space-x-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={filtroStato}
          onChange={(e) => setFiltroStato(e.target.value)}
          className="input text-sm py-1.5 w-auto"
        >
          <option value="ALL">Tutti gli stati</option>
          {Object.entries(FATTURA_STATI).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        {filtroStato !== 'ALL' && (
          <button
            type="button"
            onClick={() => setFiltroStato('ALL')}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <span className="text-xs text-gray-500 ml-2">
          {filteredFatture.length} fattur{filteredFatture.length === 1 ? 'a' : 'e'}
        </span>
      </div>

      {/* Table */}
      {filteredFatture.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-6 h-6 text-gray-300 mx-auto mb-1" />
          <p className="text-gray-500 text-sm">Nessuna fattura trovata</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fattura</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Netto</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">IVA</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Totale</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Scadenza</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Stato</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFatture.map((fattura) => {
                const statoConfig = FATTURA_STATI[fattura.stato_pagamento] || FATTURA_STATI.PENDING
                return (
                  <tr
                    key={fattura.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedFattura(fattura)}
                  >
                    <td className="px-3 py-2 text-sm text-gray-900 font-medium">
                      {fattura.numero_fattura || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {formatPeriodo(fattura.periodo_inizio, fattura.periodo_fine)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700 text-right">
                      {formatCurrency(fattura.importo_netto)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500 text-right">
                      {formatCurrency(fattura.importo_iva)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 font-medium text-right">
                      {formatCurrency(fattura.importo_totale)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {formatDate(fattura.data_scadenza_pagamento)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statoConfig.bgColor} ${statoConfig.color}`}>
                        {statoConfig.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail / Mark as Paid Panel */}
      {selectedFattura && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="gradient-primary text-white p-4 flex items-center justify-between rounded-t-lg">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <h3 className="text-sm font-semibold">
                  Dettaglio Fattura {selectedFattura.numero_fattura || ''}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedFattura(null)
                  setMarkPaidError(null)
                }}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Fattura Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-gray-500">Contratto:</span>
                    <span className="ml-1 font-medium">{selectedFattura.numero_contratto || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Stato:</span>
                    <span className={`ml-1 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${FATTURA_STATI[selectedFattura.stato_pagamento]?.bgColor} ${FATTURA_STATI[selectedFattura.stato_pagamento]?.color}`}>
                      {FATTURA_STATI[selectedFattura.stato_pagamento]?.label}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Periodo:</span>
                    <span className="ml-1 font-medium">{formatPeriodo(selectedFattura.periodo_inizio, selectedFattura.periodo_fine)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Scadenza:</span>
                    <span className="ml-1 font-medium">{formatDate(selectedFattura.data_scadenza_pagamento)}</span>
                  </div>
                </div>
                <div className="border-t pt-2 mt-2 grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-gray-500">Netto:</span>
                    <span className="ml-1 font-medium">{formatCurrency(selectedFattura.importo_netto)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">IVA:</span>
                    <span className="ml-1 font-medium">{formatCurrency(selectedFattura.importo_iva)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Totale:</span>
                    <span className="ml-1 font-semibold">{formatCurrency(selectedFattura.importo_totale)}</span>
                  </div>
                </div>
                {selectedFattura.data_pagamento && (
                  <div className="border-t pt-2 mt-2">
                    <span className="text-gray-500">Pagata il:</span>
                    <span className="ml-1 font-medium">{formatDate(selectedFattura.data_pagamento)}</span>
                    {selectedFattura.metodo_pagamento && (
                      <span className="ml-3 text-gray-500">
                        via <span className="font-medium">{selectedFattura.metodo_pagamento}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Mark as Paid Form - only for PENDING / OVERDUE */}
              {(selectedFattura.stato_pagamento === 'PENDING' || selectedFattura.stato_pagamento === 'OVERDUE') && (
                <div className="border border-green-200 rounded-lg p-4 bg-green-50 space-y-3">
                  <h4 className="font-medium text-green-900 text-sm flex items-center space-x-2">
                    <CreditCard className="w-4 h-4" />
                    <span>Segna come Pagata</span>
                  </h4>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data Pagamento</label>
                    <input
                      type="date"
                      value={dataPagamento}
                      onChange={(e) => setDataPagamento(e.target.value)}
                      className="input text-sm py-1.5"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Metodo Pagamento</label>
                    <select
                      value={metodoPagamento}
                      onChange={(e) => setMetodoPagamento(e.target.value)}
                      className="input text-sm py-1.5"
                    >
                      <option value="">Seleziona...</option>
                      <option value="Bonifico">Bonifico</option>
                      <option value="Carta di Credito">Carta di Credito</option>
                      <option value="RID/SDD">RID/SDD</option>
                      <option value="Assegno">Assegno</option>
                      <option value="Contanti">Contanti</option>
                      <option value="Altro">Altro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Riferimento Pagamento</label>
                    <input
                      type="text"
                      value={riferimentoPagamento}
                      onChange={(e) => setRiferimentoPagamento(e.target.value)}
                      className="input text-sm py-1.5"
                      placeholder="CRO, numero transazione..."
                    />
                  </div>

                  {markPaidError && (
                    <div className="bg-red-50 border border-red-200 rounded p-2">
                      <p className="text-xs text-red-700">{markPaidError}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleMarkPaid}
                    disabled={markPaidLoading}
                    className="btn-primary w-full flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-sm py-2"
                  >
                    {markPaidLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    <span>Conferma Pagamento</span>
                  </button>
                </div>
              )}

              {/* Close button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFattura(null)
                    setMarkPaidError(null)
                  }}
                  className="btn-secondary text-sm"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
