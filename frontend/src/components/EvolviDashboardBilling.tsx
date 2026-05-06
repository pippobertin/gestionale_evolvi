'use client'

import React, { useState, useEffect } from 'react'
import { Euro, CheckCircle, Clock, AlertTriangle, FileText, Loader2, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FATTURA_STATI } from '@/types/evolvi-contract'

interface BillingStats {
  totaleFatturato: number
  incassato: number
  daIncassare: number
  scaduto: number
  countPending: number
  countPaid: number
  countOverdue: number
  countCancelled: number
}

interface UpcomingFattura {
  id: string
  numero_fattura?: string
  cliente_denominazione?: string
  importo_totale: number
  data_scadenza_pagamento: string
  stato_pagamento: string
}

export default function EvolviDashboardBilling() {
  const [stats, setStats] = useState<BillingStats>({
    totaleFatturato: 0,
    incassato: 0,
    daIncassare: 0,
    scaduto: 0,
    countPending: 0,
    countPaid: 0,
    countOverdue: 0,
    countCancelled: 0
  })
  const [upcoming, setUpcoming] = useState<UpcomingFattura[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all fatture for aggregation
      const { data: fatture, error: fattureError } = await supabase
        .from('scadenze_bandi_evolvi_fatture')
        .select('id, importo_totale, stato_pagamento, data_scadenza_pagamento')

      if (fattureError) throw fattureError

      // Calcola statistiche
      const computed: BillingStats = {
        totaleFatturato: 0,
        incassato: 0,
        daIncassare: 0,
        scaduto: 0,
        countPending: 0,
        countPaid: 0,
        countOverdue: 0,
        countCancelled: 0
      }

      ;(fatture || []).forEach((f: any) => {
        const importo = f.importo_totale || 0
        computed.totaleFatturato += importo

        switch (f.stato_pagamento) {
          case 'PAID':
            computed.incassato += importo
            computed.countPaid++
            break
          case 'PENDING':
            computed.daIncassare += importo
            computed.countPending++
            break
          case 'OVERDUE':
            computed.scaduto += importo
            computed.countOverdue++
            break
          case 'CANCELLED':
            computed.countCancelled++
            break
        }
      })

      setStats(computed)

      // Fetch upcoming payments (next 30 days)
      const today = new Date()
      const futureDate = new Date(today)
      futureDate.setDate(futureDate.getDate() + 30)

      const todayStr = today.toISOString().split('T')[0]
      const futureDateStr = futureDate.toISOString().split('T')[0]

      const { data: upcomingData, error: upcomingError } = await supabase
        .from('scadenze_bandi_evolvi_fatture')
        .select('id, numero_fattura, importo_totale, data_scadenza_pagamento, stato_pagamento, scadenze_bandi_clienti(denominazione)')
        .eq('stato_pagamento', 'PENDING')
        .gte('data_scadenza_pagamento', todayStr)
        .lte('data_scadenza_pagamento', futureDateStr)
        .order('data_scadenza_pagamento', { ascending: true })
        .limit(10)

      if (upcomingError) throw upcomingError

      const mappedUpcoming = (upcomingData || []).map((f: any) => ({
        ...f,
        cliente_denominazione: f.scadenze_bandi_clienti?.denominazione || null,
        scadenze_bandi_clienti: undefined
      }))

      setUpcoming(mappedUpcoming)
    } catch (err: any) {
      console.error('Errore caricamento dati billing dashboard:', err)
      setError(err.message || 'Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT')
  }

  const daysUntil = (dateStr: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(dateStr)
    target.setHours(0, 0, 0, 0)
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
          <span className="ml-2 text-sm text-gray-500">Caricamento...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
          <Euro className="w-4 h-4 text-primary-500" />
          <span>Fatturazione Evolvi</span>
        </h3>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        <div className="text-center p-3 rounded-lg bg-gray-50">
          <Euro className="w-4 h-4 text-gray-500 mx-auto mb-1" />
          <p className="text-xs text-gray-500 font-medium">Totale Fatturato</p>
          <p className="text-base font-bold text-gray-900">{formatCurrency(stats.totaleFatturato)}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-green-50">
          <CheckCircle className="w-4 h-4 text-green-500 mx-auto mb-1" />
          <p className="text-xs text-gray-500 font-medium">Incassato</p>
          <p className="text-base font-bold text-green-700">{formatCurrency(stats.incassato)}</p>
          <p className="text-xs text-gray-400">{stats.countPaid} fatture</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-yellow-50">
          <Clock className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
          <p className="text-xs text-gray-500 font-medium">Da Incassare</p>
          <p className="text-base font-bold text-yellow-700">{formatCurrency(stats.daIncassare)}</p>
          <p className="text-xs text-gray-400">{stats.countPending} fatture</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-red-50">
          <AlertTriangle className="w-4 h-4 text-red-500 mx-auto mb-1" />
          <p className="text-xs text-gray-500 font-medium">Scaduto</p>
          <p className="text-base font-bold text-red-700">{formatCurrency(stats.scaduto)}</p>
          <p className="text-xs text-gray-400">{stats.countOverdue} fatture</p>
        </div>
      </div>

      {/* Upcoming Payments */}
      <div className="px-4 pb-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center space-x-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>Prossime Scadenze (30 giorni)</span>
        </h4>

        {upcoming.length === 0 ? (
          <p className="text-xs text-gray-400 py-3 text-center">Nessuna scadenza nei prossimi 30 giorni</p>
        ) : (
          <div className="space-y-1.5">
            {upcoming.map((fattura) => {
              const days = daysUntil(fattura.data_scadenza_pagamento)
              const urgencyClass = days <= 7
                ? 'border-l-red-400 bg-red-50'
                : days <= 14
                  ? 'border-l-yellow-400 bg-yellow-50'
                  : 'border-l-gray-300 bg-gray-50'

              return (
                <div
                  key={fattura.id}
                  className={`border-l-3 rounded-r-lg px-3 py-2 flex items-center justify-between ${urgencyClass}`}
                  style={{ borderLeftWidth: '3px' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {fattura.cliente_denominazione || 'Cliente'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {fattura.numero_fattura ? `#${fattura.numero_fattura}` : 'Fattura'} - Scade il {formatDate(fattura.data_scadenza_pagamento)}
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-xs font-semibold text-gray-900">{formatCurrency(fattura.importo_totale)}</p>
                    <p className="text-xs text-gray-500">
                      {days === 0 ? 'Oggi' : days === 1 ? 'Domani' : `${days} giorni`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
