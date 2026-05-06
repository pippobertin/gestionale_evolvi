'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  Euro,
  Calendar,
  Award,
  Target,
  Download,
  Filter,
  X,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'
import { ResponsivePie } from '@nivo/pie'
import ScadenzeContrattualiReports from './ScadenzeContrattualiReports'

interface ContributiCliente {
  cliente_id: string
  cliente_nome: string
  numero_progetti: number
  contributo_totale_ottenuto: number
  contributo_totale_ammesso: number
  progetti_completati: number
}

interface ProgettoDettaglio {
  id: string
  titolo_progetto: string
  codice_progetto: string
  bando_nome: string
  bando_id: string
  stato: string
  contributo_ammesso: number
  contributo_ottenuto: number | null
  created_at: string
}

interface BandoDettaglio {
  bando_id: string
  bando_nome: string
  progetti: ProgettoDettaglio[]
  contributo_totale_ammesso: number
  contributo_totale_ottenuto: number
  progetti_vinti: number
  progetti_totali: number
}

interface StatoBando {
  bando_id: string
  bando_nome: string
  totale_progetti: number
  progetti_completati: number
  progetti_in_corso: number
  contributo_totale_ammesso: number
  contributo_totale_ottenuto: number
  tasso_successo: number
}

interface OverviewProgetti {
  totale: number
  decreto_atteso: number
  decreto_ricevuto: number
  accettato: number
  in_corso: number
  completato: number
  contributo_totale_ammesso: number
  contributo_totale_ottenuto: number
}

interface PeriodoData {
  periodo: string
  label: string
  contributiClienti: ContributiCliente[]
  statiBandi: StatoBando[]
  overview: OverviewProgetti | null
}

export default function ReportsContent() {
  const [activeTab, setActiveTab] = useState<'contributi' | 'bandi' | 'overview' | 'benchmarking' | 'scadenze_contrattuali'>('contributi')
  const [loading, setLoading] = useState(false)

  // Dati report singolo periodo
  const [contributiClienti, setContributiClienti] = useState<ContributiCliente[]>([])
  const [statiBandi, setStatiBandi] = useState<StatoBando[]>([])
  const [overviewProgetti, setOverviewProgetti] = useState<OverviewProgetti | null>(null)

  // Dati benchmarking multipli periodi
  const [periodiComparazione, setPeriodiComparazione] = useState<string[]>([])
  const [datiPeriodi, setDatiPeriodi] = useState<PeriodoData[]>([])
  const [loadingBenchmark, setLoadingBenchmark] = useState(false)

  // Dettaglio cliente
  const [clienteSelezionato, setClienteSelezionato] = useState<ContributiCliente | null>(null)
  const [bandiDettaglio, setBandiDettaglio] = useState<BandoDettaglio[]>([])
  const [loadingDettaglio, setLoadingDettaglio] = useState(false)

  // Filtri
  const [statiFiltro, setStatiFiltro] = useState<string>('tutti')
  const [periodoFiltro, setPeriodoFiltro] = useState<string>('tutti')
  const [dataInizio, setDataInizio] = useState<string>('')
  const [dataFine, setDataFine] = useState<string>('')

  useEffect(() => {
    if (activeTab !== 'benchmarking' && activeTab !== 'scadenze_contrattuali') {
      loadReports()
    }
  }, [statiFiltro, periodoFiltro, dataInizio, dataFine, activeTab])

  useEffect(() => {
    if (activeTab === 'benchmarking' && periodiComparazione.length > 0) {
      loadBenchmarkData()
    }
  }, [periodiComparazione, activeTab])

  const loadReports = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadContributiClienti(),
        loadStatiBandi(),
        loadOverviewProgetti()
      ])
    } catch (error) {
      console.error('Errore caricamento report:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDateRangeFromPeriodo = (periodo?: string) => {
    const periodoToUse = periodo || periodoFiltro

    switch (periodoToUse) {
      // 2026
      case 'q1_2026':
        return { start: '2026-01-01', end: '2026-03-31' }
      case 'q2_2026':
        return { start: '2026-04-01', end: '2026-06-30' }
      case 'q3_2026':
        return { start: '2026-07-01', end: '2026-09-30' }
      case 'q4_2026':
        return { start: '2026-10-01', end: '2026-12-31' }
      case 'anno_2026':
        return { start: '2026-01-01', end: '2026-12-31' }
      // 2025
      case 'q1_2025':
        return { start: '2025-01-01', end: '2025-03-31' }
      case 'q2_2025':
        return { start: '2025-04-01', end: '2025-06-30' }
      case 'q3_2025':
        return { start: '2025-07-01', end: '2025-09-30' }
      case 'q4_2025':
        return { start: '2025-10-01', end: '2025-12-31' }
      case 'anno_2025':
        return { start: '2025-01-01', end: '2025-12-31' }
      // 2024
      case 'q1_2024':
        return { start: '2024-01-01', end: '2024-03-31' }
      case 'q2_2024':
        return { start: '2024-04-01', end: '2024-06-30' }
      case 'q3_2024':
        return { start: '2024-07-01', end: '2024-09-30' }
      case 'q4_2024':
        return { start: '2024-10-01', end: '2024-12-31' }
      case 'anno_2024':
        return { start: '2024-01-01', end: '2024-12-31' }
      // 2023
      case 'q1_2023':
        return { start: '2023-01-01', end: '2023-03-31' }
      case 'q2_2023':
        return { start: '2023-04-01', end: '2023-06-30' }
      case 'q3_2023':
        return { start: '2023-07-01', end: '2023-09-30' }
      case 'q4_2023':
        return { start: '2023-10-01', end: '2023-12-31' }
      case 'anno_2023':
        return { start: '2023-01-01', end: '2023-12-31' }
      case 'personalizzato':
        return { start: dataInizio, end: dataFine }
      default:
        return null
    }
  }

  const getPeriodoLabel = (periodo: string) => {
    const labels: Record<string, string> = {
      'q1_2026': 'Q1 2026',
      'q2_2026': 'Q2 2026',
      'q3_2026': 'Q3 2026',
      'q4_2026': 'Q4 2026',
      'anno_2026': '2026',
      'q1_2025': 'Q1 2025',
      'q2_2025': 'Q2 2025',
      'q3_2025': 'Q3 2025',
      'q4_2025': 'Q4 2025',
      'anno_2025': '2025',
      'q1_2024': 'Q1 2024',
      'q2_2024': 'Q2 2024',
      'q3_2024': 'Q3 2024',
      'q4_2024': 'Q4 2024',
      'anno_2024': '2024',
      'q1_2023': 'Q1 2023',
      'q2_2023': 'Q2 2023',
      'q3_2023': 'Q3 2023',
      'q4_2023': 'Q4 2023',
      'anno_2023': '2023'
    }
    return labels[periodo] || periodo
  }

  const loadContributiClienti = async (periodo?: string) => {
    try {
      let query = supabase
        .from('scadenze_bandi_progetti')
        .select(`
          id,
          cliente_id,
          stato,
          contributo_ammesso,
          contributo_ottenuto,
          created_at,
          scadenze_bandi_clienti (
            id,
            denominazione
          )
        `)

      // Applica filtri stato
      if (statiFiltro !== 'tutti') {
        query = query.eq('stato', statiFiltro)
      }

      // Applica filtri periodo
      const dateRange = getDateRangeFromPeriodo(periodo)
      if (dateRange && dateRange.start && dateRange.end) {
        query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end)
      }

      const { data: progetti, error } = await query

      if (error) throw error

      // Aggrega dati per cliente
      const clientiMap = new Map<string, ContributiCliente>()

      progetti?.forEach((progetto: any) => {
        const clienteId = progetto.cliente_id
        const clienteNome = progetto.scadenze_bandi_clienti?.denominazione || 'N/A'

        if (!clientiMap.has(clienteId)) {
          clientiMap.set(clienteId, {
            cliente_id: clienteId,
            cliente_nome: clienteNome,
            numero_progetti: 0,
            contributo_totale_ottenuto: 0,
            contributo_totale_ammesso: 0,
            progetti_completati: 0
          })
        }

        const cliente = clientiMap.get(clienteId)!
        cliente.numero_progetti++
        cliente.contributo_totale_ammesso += progetto.contributo_ammesso || 0
        cliente.contributo_totale_ottenuto += progetto.contributo_ottenuto || 0

        if (progetto.stato === 'COMPLETATO') {
          cliente.progetti_completati++
        }
      })

      const result = Array.from(clientiMap.values())
        .sort((a, b) => b.contributo_totale_ottenuto - a.contributo_totale_ottenuto)

      if (!periodo) {
        setContributiClienti(result)
      }
      return result
    } catch (error: any) {
      console.error('Errore caricamento contributi clienti:', error?.message || error)
      return []
    }
  }

  const loadDettaglioCliente = async (cliente: ContributiCliente) => {
    setLoadingDettaglio(true)
    setClienteSelezionato(cliente)

    try {
      let query = supabase
        .from('scadenze_bandi_progetti')
        .select(`
          id,
          titolo_progetto,
          codice_progetto,
          bando_id,
          stato,
          contributo_ammesso,
          contributo_ottenuto,
          created_at,
          scadenze_bandi_bandi (
            id,
            nome
          )
        `)
        .eq('cliente_id', cliente.cliente_id)

      // Applica filtri periodo anche al dettaglio
      const dateRange = getDateRangeFromPeriodo()
      if (dateRange && dateRange.start && dateRange.end) {
        query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end)
      }

      const { data: progetti, error } = await query

      if (error) throw error

      // Raggruppa per bando
      const bandiMap = new Map<string, BandoDettaglio>()

      progetti?.forEach((progetto: any) => {
        const bandoId = progetto.bando_id
        const bandoNome = progetto.scadenze_bandi_bandi?.nome || 'N/A'

        if (!bandiMap.has(bandoId)) {
          bandiMap.set(bandoId, {
            bando_id: bandoId,
            bando_nome: bandoNome,
            progetti: [],
            contributo_totale_ammesso: 0,
            contributo_totale_ottenuto: 0,
            progetti_vinti: 0,
            progetti_totali: 0
          })
        }

        const bando = bandiMap.get(bandoId)!
        bando.progetti.push({
          id: progetto.id,
          titolo_progetto: progetto.titolo_progetto,
          codice_progetto: progetto.codice_progetto,
          bando_nome: bandoNome,
          bando_id: bandoId,
          stato: progetto.stato,
          contributo_ammesso: progetto.contributo_ammesso,
          contributo_ottenuto: progetto.contributo_ottenuto,
          created_at: progetto.created_at
        })
        bando.contributo_totale_ammesso += progetto.contributo_ammesso || 0
        bando.contributo_totale_ottenuto += progetto.contributo_ottenuto || 0
        bando.progetti_totali++

        if (progetto.stato === 'COMPLETATO' && progetto.contributo_ottenuto > 0) {
          bando.progetti_vinti++
        }
      })

      setBandiDettaglio(Array.from(bandiMap.values()))
    } catch (error: any) {
      console.error('Errore caricamento dettaglio cliente:', error?.message || error)
    } finally {
      setLoadingDettaglio(false)
    }
  }

  const loadStatiBandi = async (periodo?: string) => {
    try {
      let query = supabase
        .from('scadenze_bandi_progetti')
        .select(`
          id,
          bando_id,
          stato,
          contributo_ammesso,
          contributo_ottenuto,
          created_at,
          scadenze_bandi_bandi (
            id,
            nome,
            codice_bando
          )
        `)

      const dateRange = getDateRangeFromPeriodo(periodo)
      if (dateRange && dateRange.start && dateRange.end) {
        query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end)
      }

      const { data: progetti, error } = await query

      if (error) throw error

      // Aggrega dati per bando
      const bandiMap = new Map<string, StatoBando>()

      progetti?.forEach((progetto: any) => {
        const bandoId = progetto.bando_id
        const bandoNome = progetto.scadenze_bandi_bandi?.nome || 'N/A'

        if (!bandiMap.has(bandoId)) {
          bandiMap.set(bandoId, {
            bando_id: bandoId,
            bando_nome: bandoNome,
            totale_progetti: 0,
            progetti_completati: 0,
            progetti_in_corso: 0,
            contributo_totale_ammesso: 0,
            contributo_totale_ottenuto: 0,
            tasso_successo: 0
          })
        }

        const bando = bandiMap.get(bandoId)!
        bando.totale_progetti++
        bando.contributo_totale_ammesso += progetto.contributo_ammesso || 0
        bando.contributo_totale_ottenuto += progetto.contributo_ottenuto || 0

        if (progetto.stato === 'COMPLETATO') {
          bando.progetti_completati++
        }
        if (progetto.stato === 'IN_CORSO' || progetto.stato === 'ACCETTATO') {
          bando.progetti_in_corso++
        }
      })

      // Calcola tasso successo
      bandiMap.forEach((bando) => {
        bando.tasso_successo = bando.totale_progetti > 0
          ? (bando.progetti_completati / bando.totale_progetti) * 100
          : 0
      })

      const result = Array.from(bandiMap.values())
        .sort((a, b) => b.totale_progetti - a.totale_progetti)

      if (!periodo) {
        setStatiBandi(result)
      }
      return result
    } catch (error: any) {
      console.error('Errore caricamento stati bandi:', error?.message || error)
      return []
    }
  }

  const loadOverviewProgetti = async (periodo?: string) => {
    try {
      let query = supabase
        .from('scadenze_bandi_progetti')
        .select('stato, contributo_ammesso, contributo_ottenuto, created_at')

      const dateRange = getDateRangeFromPeriodo(periodo)
      if (dateRange && dateRange.start && dateRange.end) {
        query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end)
      }

      const { data: progetti, error } = await query

      if (error) throw error

      const overview: OverviewProgetti = {
        totale: progetti?.length || 0,
        decreto_atteso: 0,
        decreto_ricevuto: 0,
        accettato: 0,
        in_corso: 0,
        completato: 0,
        contributo_totale_ammesso: 0,
        contributo_totale_ottenuto: 0
      }

      progetti?.forEach((progetto: any) => {
        switch (progetto.stato) {
          case 'DECRETO_ATTESO':
            overview.decreto_atteso++
            break
          case 'DECRETO_RICEVUTO':
            overview.decreto_ricevuto++
            break
          case 'ACCETTATO':
            overview.accettato++
            break
          case 'IN_CORSO':
            overview.in_corso++
            break
          case 'COMPLETATO':
            overview.completato++
            break
        }

        overview.contributo_totale_ammesso += progetto.contributo_ammesso || 0
        overview.contributo_totale_ottenuto += progetto.contributo_ottenuto || 0
      })

      if (!periodo) {
        setOverviewProgetti(overview)
      }
      return overview
    } catch (error: any) {
      console.error('Errore caricamento overview progetti:', error?.message || error)
      return null
    }
  }

  const loadBenchmarkData = async () => {
    setLoadingBenchmark(true)
    try {
      const datiPromises = periodiComparazione.map(async (periodo) => {
        const [contributi, bandi, overview] = await Promise.all([
          loadContributiClienti(periodo),
          loadStatiBandi(periodo),
          loadOverviewProgetti(periodo)
        ])

        return {
          periodo,
          label: getPeriodoLabel(periodo),
          contributiClienti: contributi,
          statiBandi: bandi,
          overview
        }
      })

      const risultati = await Promise.all(datiPromises)
      setDatiPeriodi(risultati)
    } catch (error) {
      console.error('Errore caricamento benchmark:', error)
    } finally {
      setLoadingBenchmark(false)
    }
  }

  const togglePeriodoComparazione = (periodo: string) => {
    if (periodiComparazione.includes(periodo)) {
      setPeriodiComparazione(periodiComparazione.filter(p => p !== periodo))
    } else {
      if (periodiComparazione.length < 4) {
        setPeriodiComparazione([...periodiComparazione, periodo])
      }
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT')
  }

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return

    const headers = Object.keys(data[0]).join(',')
    const rows = data.map(row => Object.values(row).join(',')).join('\n')
    const csv = `${headers}\n${rows}`

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
  }

  const getStatoIcon = (stato: string) => {
    switch (stato) {
      case 'COMPLETATO':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'IN_CORSO':
      case 'ACCETTATO':
        return <Clock className="w-4 h-4 text-blue-500" />
      default:
        return <XCircle className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatoLabel = (stato: string) => {
    const labels: Record<string, string> = {
      'DECRETO_ATTESO': 'Decreto Atteso',
      'DECRETO_RICEVUTO': 'Decreto Ricevuto',
      'ACCETTATO': 'Accettato',
      'IN_CORSO': 'In Corso',
      'COMPLETATO': 'Completato'
    }
    return labels[stato] || stato
  }

  const calculateVariation = (current: number, previous: number) => {
    if (previous === 0) return { percent: 0, trend: 'neutral' as const }
    const percent = ((current - previous) / previous) * 100
    const trend = percent > 0 ? 'up' : percent < 0 ? 'down' : 'neutral'
    return { percent: Math.abs(percent), trend }
  }

  const VariationIndicator = ({ current, previous }: { current: number; previous: number }) => {
    const { percent, trend } = calculateVariation(current, previous)

    return (
      <div className={`flex items-center gap-1 text-sm font-medium ${
        trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
      }`}>
        {trend === 'up' && <ArrowUpRight className="w-4 h-4" />}
        {trend === 'down' && <ArrowDownRight className="w-4 h-4" />}
        {trend === 'neutral' && <Minus className="w-4 h-4" />}
        <span>{percent.toFixed(1)}%</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Analisi dati e statistiche</p>
        </div>
      </div>

      {/* Filtri (solo per tabs non-benchmarking) */}
      {activeTab !== 'benchmarking' && activeTab !== 'scadenze_contrattuali' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stato Progetti
              </label>
              <select
                value={statiFiltro}
                onChange={(e) => setStatiFiltro(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="tutti">Tutti gli stati</option>
                <option value="DECRETO_ATTESO">Decreto Atteso</option>
                <option value="DECRETO_RICEVUTO">Decreto Ricevuto</option>
                <option value="ACCETTATO">Accettato</option>
                <option value="IN_CORSO">In Corso</option>
                <option value="COMPLETATO">Completato</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Periodo
              </label>
              <select
                value={periodoFiltro}
                onChange={(e) => {
                  setPeriodoFiltro(e.target.value)
                  if (e.target.value !== 'personalizzato') {
                    setDataInizio('')
                    setDataFine('')
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="tutti">Tutti i periodi</option>
                <optgroup label="2026">
                  <option value="q1_2026">Q1 2026 (Gen-Mar)</option>
                  <option value="q2_2026">Q2 2026 (Apr-Giu)</option>
                  <option value="q3_2026">Q3 2026 (Lug-Set)</option>
                  <option value="q4_2026">Q4 2026 (Ott-Dic)</option>
                  <option value="anno_2026">Anno 2026</option>
                </optgroup>
                <optgroup label="2025">
                  <option value="q1_2025">Q1 2025 (Gen-Mar)</option>
                  <option value="q2_2025">Q2 2025 (Apr-Giu)</option>
                  <option value="q3_2025">Q3 2025 (Lug-Set)</option>
                  <option value="q4_2025">Q4 2025 (Ott-Dic)</option>
                  <option value="anno_2025">Anno 2025</option>
                </optgroup>
                <optgroup label="2024">
                  <option value="q1_2024">Q1 2024 (Gen-Mar)</option>
                  <option value="q2_2024">Q2 2024 (Apr-Giu)</option>
                  <option value="q3_2024">Q3 2024 (Lug-Set)</option>
                  <option value="q4_2024">Q4 2024 (Ott-Dic)</option>
                  <option value="anno_2024">Anno 2024</option>
                </optgroup>
                <optgroup label="2023">
                  <option value="q1_2023">Q1 2023 (Gen-Mar)</option>
                  <option value="q2_2023">Q2 2023 (Apr-Giu)</option>
                  <option value="q3_2023">Q3 2023 (Lug-Set)</option>
                  <option value="q4_2023">Q4 2023 (Ott-Dic)</option>
                  <option value="anno_2023">Anno 2023</option>
                </optgroup>
                <option value="personalizzato">Personalizzato</option>
              </select>
            </div>

            {periodoFiltro === 'personalizzato' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Inizio
                  </label>
                  <input
                    type="date"
                    value={dataInizio}
                    onChange={(e) => setDataInizio(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Fine
                  </label>
                  <input
                    type="date"
                    value={dataFine}
                    onChange={(e) => setDataFine(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('contributi')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'contributi'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Euro className="w-4 h-4" />
              Contributi per Cliente
            </div>
          </button>
          <button
            onClick={() => setActiveTab('bandi')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'bandi'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              Performance Bandi
            </div>
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview Progetti
            </div>
          </button>
          <button
            onClick={() => setActiveTab('benchmarking')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'benchmarking'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Benchmarking
            </div>
          </button>
          <button
            onClick={() => setActiveTab('scadenze_contrattuali')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'scadenze_contrattuali'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Scadenze Contrattuali
            </div>
          </button>
        </nav>
      </div>

      {/* Content */}
      {loading && activeTab !== 'benchmarking' && activeTab !== 'scadenze_contrattuali' ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-gray-600 mt-4">Caricamento dati...</p>
        </div>
      ) : (
        <>
          {/* Tab: Contributi per Cliente */}
          {activeTab === 'contributi' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-semibold text-gray-900">
                  Contributi Ottenuti per Cliente
                </h2>
                <button
                  onClick={() => exportToCSV(contributiClienti, 'contributi-clienti')}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  <Download className="w-4 h-4" />
                  Esporta CSV
                </button>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        N. Progetti
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progetti Completati
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contributo Ammesso
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contributo Ottenuto
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tasso Realizzazione
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Azioni
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {contributiClienti.map((cliente) => {
                      const tassoRealizzazione = cliente.contributo_totale_ammesso > 0
                        ? (cliente.contributo_totale_ottenuto / cliente.contributo_totale_ammesso) * 100
                        : 0

                      return (
                        <tr key={cliente.cliente_id} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <div className="flex items-center">
                              <Users className="w-4 h-4 text-gray-400 mr-2" />
                              <div className="text-sm font-medium text-gray-900">
                                {cliente.cliente_nome}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-900">
                            {cliente.numero_progetti}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-900">
                            {cliente.progetti_completati}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(cliente.contributo_totale_ammesso)}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <div className="text-sm font-semibold text-green-600">
                              {formatCurrency(cliente.contributo_totale_ottenuto)}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div
                                  className="bg-primary-500 h-2 rounded-full"
                                  style={{ width: `${Math.min(tassoRealizzazione, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">
                                {tassoRealizzazione.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm">
                            <button
                              onClick={() => loadDettaglioCliente(cliente)}
                              className="flex items-center gap-1 text-primary-600 hover:text-primary-800 font-medium"
                            >
                              Dettaglio
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {contributiClienti.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    Nessun dato disponibile
                  </div>
                )}
              </div>

              {/* Summary Cards */}
              {contributiClienti.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-600 font-medium">Totale Clienti</p>
                        <p className="text-lg font-bold text-blue-900 mt-1">
                          {contributiClienti.length}
                        </p>
                      </div>
                      <Users className="w-6 h-6 text-blue-400" />
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-600 font-medium">Contributi Ammessi</p>
                        <p className="text-lg font-bold text-green-900 mt-1">
                          {formatCurrency(contributiClienti.reduce((sum, c) => sum + c.contributo_totale_ammesso, 0))}
                        </p>
                      </div>
                      <Target className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-primary-600 font-medium">Contributi Ottenuti</p>
                        <p className="text-lg font-bold text-primary-900 mt-1">
                          {formatCurrency(contributiClienti.reduce((sum, c) => sum + c.contributo_totale_ottenuto, 0))}
                        </p>
                      </div>
                      <TrendingUp className="w-6 h-6 text-primary-400" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Performance Bandi */}
          {activeTab === 'bandi' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-semibold text-gray-900">
                  Performance per Bando
                </h2>
                <button
                  onClick={() => exportToCSV(statiBandi, 'performance-bandi')}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  <Download className="w-4 h-4" />
                  Esporta CSV
                </button>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bando
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Totale Progetti
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Completati
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        In Corso
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tasso Successo
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contributo Ottenuto
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {statiBandi.map((bando) => (
                      <tr key={bando.bando_id} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5">
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 text-gray-400 mr-2" />
                            <div className="text-sm font-medium text-gray-900">
                              {bando.bando_nome}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-900">
                          {bando.totale_progetti}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {bando.progetti_completati}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {bando.progetti_in_corso}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className={`h-2 rounded-full ${
                                  bando.tasso_successo >= 70 ? 'bg-green-500' :
                                  bando.tasso_successo >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${bando.tasso_successo}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">
                              {bando.tasso_successo.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-sm font-semibold text-green-600">
                          {formatCurrency(bando.contributo_totale_ottenuto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {statiBandi.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    Nessun dato disponibile
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: Overview Progetti */}
          {activeTab === 'overview' && overviewProgetti && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">
                Panoramica Generale Progetti
              </h2>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Totale Progetti</p>
                      <p className="text-lg font-bold text-gray-900 mt-2">
                        {overviewProgetti.totale}
                      </p>
                    </div>
                    <FileText className="w-6 h-6 text-gray-300" />
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">Completati</p>
                      <p className="text-lg font-bold text-green-900 mt-2">
                        {overviewProgetti.completato}
                      </p>
                    </div>
                    <Award className="w-6 h-6 text-green-300" />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">In Corso</p>
                      <p className="text-lg font-bold text-blue-900 mt-2">
                        {overviewProgetti.in_corso}
                      </p>
                    </div>
                    <TrendingUp className="w-6 h-6 text-blue-300" />
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-yellow-600 font-medium">In Attesa</p>
                      <p className="text-lg font-bold text-yellow-900 mt-2">
                        {overviewProgetti.decreto_atteso + overviewProgetti.decreto_ricevuto + overviewProgetti.accettato}
                      </p>
                    </div>
                    <Calendar className="w-6 h-6 text-yellow-300" />
                  </div>
                </div>
              </div>

              {/* Stati Dettaglio */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Distribuzione Stati
                </h3>
                <div className="space-y-4">
                  {[
                    { label: 'Decreto Atteso', value: overviewProgetti.decreto_atteso, color: 'bg-gray-500' },
                    { label: 'Decreto Ricevuto', value: overviewProgetti.decreto_ricevuto, color: 'bg-indigo-500' },
                    { label: 'Accettato', value: overviewProgetti.accettato, color: 'bg-purple-500' },
                    { label: 'In Corso', value: overviewProgetti.in_corso, color: 'bg-blue-500' },
                    { label: 'Completato', value: overviewProgetti.completato, color: 'bg-green-500' }
                  ].map((stato) => {
                    const percentuale = overviewProgetti.totale > 0
                      ? (stato.value / overviewProgetti.totale) * 100
                      : 0

                    return (
                      <div key={stato.label}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">{stato.label}</span>
                          <span className="text-sm text-gray-600">{stato.value} ({percentuale.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`${stato.color} h-2 rounded-full transition-all`}
                            style={{ width: `${percentuale}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Contributi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Contributo Totale Ammesso
                  </h3>
                  <div className="flex items-baseline">
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(overviewProgetti.contributo_totale_ammesso)}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Somma di tutti i contributi ammessi
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Contributo Totale Ottenuto
                  </h3>
                  <div className="flex items-baseline">
                    <p className="text-lg font-bold text-primary-600">
                      {formatCurrency(overviewProgetti.contributo_totale_ottenuto)}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Somma di tutti i contributi effettivamente ottenuti
                  </p>
                  {overviewProgetti.contributo_totale_ammesso > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600">Tasso di realizzazione</span>
                        <span className="text-sm font-semibold text-primary-600">
                          {((overviewProgetti.contributo_totale_ottenuto / overviewProgetti.contributo_totale_ammesso) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-500 h-2 rounded-full"
                          style={{
                            width: `${Math.min((overviewProgetti.contributo_totale_ottenuto / overviewProgetti.contributo_totale_ammesso) * 100, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Benchmarking */}
          {activeTab === 'benchmarking' && (
            <div className="space-y-3">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">
                  Seleziona Periodi da Confrontare
                </h2>
                <p className="text-sm text-gray-600 mb-2">
                  Seleziona da 2 a 4 periodi da confrontare (max 4 periodi)
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {[
                    'q1_2026', 'q2_2026', 'q3_2026', 'q4_2026', 'anno_2026',
                    'q1_2025', 'q2_2025', 'q3_2025', 'q4_2025', 'anno_2025',
                    'q1_2024', 'q2_2024', 'q3_2024', 'q4_2024', 'anno_2024',
                    'q1_2023', 'q2_2023', 'q3_2023', 'q4_2023', 'anno_2023'
                  ].map((periodo) => (
                    <button
                      key={periodo}
                      onClick={() => togglePeriodoComparazione(periodo)}
                      disabled={!periodiComparazione.includes(periodo) && periodiComparazione.length >= 4}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        periodiComparazione.includes(periodo)
                          ? 'bg-primary-500 text-white ring-2 ring-primary-600'
                          : periodiComparazione.length >= 4
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {getPeriodoLabel(periodo)}
                    </button>
                  ))}
                </div>

                {periodiComparazione.length > 0 && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      Periodi selezionati ({periodiComparazione.length}/4):
                    </span>
                    {periodiComparazione.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                        {getPeriodoLabel(p)}
                        <button
                          onClick={() => togglePeriodoComparazione(p)}
                          className="hover:bg-primary-200 rounded-full"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {periodiComparazione.length === 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-600">Seleziona almeno 2 periodi da confrontare</p>
                </div>
              )}

              {periodiComparazione.length === 1 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                  <Calendar className="w-16 h-16 text-yellow-300 mx-auto mb-2" />
                  <p className="text-yellow-700">Seleziona almeno un altro periodo per vedere il confronto</p>
                </div>
              )}

              {loadingBenchmark && periodiComparazione.length >= 2 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                  <p className="text-gray-600 mt-4">Caricamento dati di confronto...</p>
                </div>
              )}

              {!loadingBenchmark && datiPeriodi.length >= 2 && (
                <div className="space-y-3">
                  {/* Grafici Comparativi */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Grafico Contributi Ottenuti per Periodo */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">
                        Contributi Ottenuti per Periodo
                      </h3>
                      <div style={{ height: '300px' }}>
                        <ResponsiveBar
                          data={datiPeriodi.map(p => ({
                            periodo: p.label,
                            contributo: p.overview?.contributo_totale_ottenuto || 0
                          }))}
                          keys={['contributo']}
                          indexBy="periodo"
                          margin={{ top: 20, right: 20, bottom: 50, left: 80 }}
                          padding={0.3}
                          valueScale={{ type: 'linear' }}
                          colors={['#3b82f6']}
                          borderRadius={4}
                          axisBottom={{
                            tickSize: 5,
                            tickPadding: 5,
                            tickRotation: -15
                          }}
                          axisLeft={{
                            tickSize: 5,
                            tickPadding: 5,
                            tickRotation: 0,
                            format: (value) => `€${(value / 1000).toFixed(0)}k`
                          }}
                          labelSkipWidth={12}
                          labelSkipHeight={12}
                          labelTextColor="#ffffff"
                          animate={true}
                          motionConfig="gentle"
                          theme={{
                            fontSize: 12,
                            textColor: '#6b7280'
                          }}
                        />
                      </div>
                    </div>

                    {/* Grafico Progetti Completati */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">
                        Progetti Completati per Periodo
                      </h3>
                      <div style={{ height: '300px' }}>
                        <ResponsiveBar
                          data={datiPeriodi.map(p => ({
                            periodo: p.label,
                            completati: p.overview?.completato || 0
                          }))}
                          keys={['completati']}
                          indexBy="periodo"
                          margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
                          padding={0.3}
                          valueScale={{ type: 'linear' }}
                          colors={['#10b981']}
                          borderRadius={4}
                          axisBottom={{
                            tickSize: 5,
                            tickPadding: 5,
                            tickRotation: -15
                          }}
                          axisLeft={{
                            tickSize: 5,
                            tickPadding: 5,
                            tickRotation: 0
                          }}
                          labelSkipWidth={12}
                          labelSkipHeight={12}
                          labelTextColor="#ffffff"
                          animate={true}
                          motionConfig="gentle"
                          theme={{
                            fontSize: 12,
                            textColor: '#6b7280'
                          }}
                        />
                      </div>
                    </div>

                    {/* Grafico a Linee - Trend Contributi */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">
                        Trend Contributi
                      </h3>
                      <div style={{ height: '300px' }}>
                        <ResponsiveLine
                          data={[
                            {
                              id: 'Ammesso',
                              data: datiPeriodi.map(p => ({
                                x: p.label,
                                y: p.overview?.contributo_totale_ammesso || 0
                              }))
                            },
                            {
                              id: 'Ottenuto',
                              data: datiPeriodi.map(p => ({
                                x: p.label,
                                y: p.overview?.contributo_totale_ottenuto || 0
                              }))
                            }
                          ]}
                          margin={{ top: 20, right: 110, bottom: 50, left: 80 }}
                          xScale={{ type: 'point' }}
                          yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
                          curve="monotoneX"
                          axisBottom={{
                            tickSize: 5,
                            tickPadding: 5,
                            tickRotation: -15
                          }}
                          axisLeft={{
                            tickSize: 5,
                            tickPadding: 5,
                            tickRotation: 0,
                            format: (value) => `€${(value / 1000).toFixed(0)}k`
                          }}
                          colors={['#10b981', '#3b82f6']}
                          pointSize={8}
                          pointColor={{ theme: 'background' }}
                          pointBorderWidth={2}
                          pointBorderColor={{ from: 'serieColor' }}
                          enablePointLabel={false}
                          useMesh={true}
                          legends={[
                            {
                              anchor: 'bottom-right',
                              direction: 'column',
                              translateX: 100,
                              itemWidth: 80,
                              itemHeight: 20,
                              symbolSize: 12,
                              symbolShape: 'circle'
                            }
                          ]}
                          theme={{
                            fontSize: 12,
                            textColor: '#6b7280'
                          }}
                        />
                      </div>
                    </div>

                    {/* Grafico a Torta - Distribuzione Stati nel primo periodo */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">
                        Distribuzione Stati - {datiPeriodi[0].label}
                      </h3>
                      <div style={{ height: '300px' }}>
                        <ResponsivePie
                          data={[
                            { id: 'Completato', value: datiPeriodi[0].overview?.completato || 0, color: '#10b981' },
                            { id: 'In Corso', value: datiPeriodi[0].overview?.in_corso || 0, color: '#3b82f6' },
                            { id: 'Accettato', value: datiPeriodi[0].overview?.accettato || 0, color: '#8b5cf6' },
                            { id: 'Decreto Ricevuto', value: datiPeriodi[0].overview?.decreto_ricevuto || 0, color: '#6366f1' },
                            { id: 'Decreto Atteso', value: datiPeriodi[0].overview?.decreto_atteso || 0, color: '#6b7280' }
                          ].filter(d => d.value > 0)}
                          margin={{ top: 20, right: 80, bottom: 20, left: 80 }}
                          innerRadius={0.5}
                          padAngle={0.7}
                          cornerRadius={3}
                          activeOuterRadiusOffset={8}
                          colors={{ datum: 'data.color' }}
                          borderWidth={1}
                          borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                          arcLinkLabelsSkipAngle={10}
                          arcLinkLabelsTextColor="#333333"
                          arcLinkLabelsThickness={2}
                          arcLinkLabelsColor={{ from: 'color' }}
                          arcLabelsSkipAngle={10}
                          arcLabelsTextColor="#ffffff"
                          theme={{
                            fontSize: 12,
                            textColor: '#6b7280'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tabella Comparativa KPI */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Confronto KPI Principali
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Metrica
                            </th>
                            {datiPeriodi.map((periodo, idx) => (
                              <th key={periodo.periodo} className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {periodo.label}
                                {idx > 0 && <span className="ml-2 text-gray-400">vs {datiPeriodi[idx-1].label}</span>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          <tr>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm font-medium text-gray-900">
                              Totale Progetti
                            </td>
                            {datiPeriodi.map((periodo, idx) => (
                              <td key={periodo.periodo} className="px-3 py-1.5 whitespace-nowrap text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900">
                                    {periodo.overview?.totale || 0}
                                  </span>
                                  {idx > 0 && (
                                    <VariationIndicator
                                      current={periodo.overview?.totale || 0}
                                      previous={datiPeriodi[idx-1].overview?.totale || 0}
                                    />
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm font-medium text-gray-900">
                              Progetti Completati
                            </td>
                            {datiPeriodi.map((periodo, idx) => (
                              <td key={periodo.periodo} className="px-3 py-1.5 whitespace-nowrap text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-green-600">
                                    {periodo.overview?.completato || 0}
                                  </span>
                                  {idx > 0 && (
                                    <VariationIndicator
                                      current={periodo.overview?.completato || 0}
                                      previous={datiPeriodi[idx-1].overview?.completato || 0}
                                    />
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm font-medium text-gray-900">
                              Contributo Ammesso
                            </td>
                            {datiPeriodi.map((periodo, idx) => (
                              <td key={periodo.periodo} className="px-3 py-1.5 whitespace-nowrap text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900">
                                    {formatCurrency(periodo.overview?.contributo_totale_ammesso || 0)}
                                  </span>
                                  {idx > 0 && (
                                    <VariationIndicator
                                      current={periodo.overview?.contributo_totale_ammesso || 0}
                                      previous={datiPeriodi[idx-1].overview?.contributo_totale_ammesso || 0}
                                    />
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm font-medium text-gray-900">
                              Contributo Ottenuto
                            </td>
                            {datiPeriodi.map((periodo, idx) => (
                              <td key={periodo.periodo} className="px-3 py-1.5 whitespace-nowrap text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-primary-600">
                                    {formatCurrency(periodo.overview?.contributo_totale_ottenuto || 0)}
                                  </span>
                                  {idx > 0 && (
                                    <VariationIndicator
                                      current={periodo.overview?.contributo_totale_ottenuto || 0}
                                      previous={datiPeriodi[idx-1].overview?.contributo_totale_ottenuto || 0}
                                    />
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm font-medium text-gray-900">
                              Tasso Realizzazione
                            </td>
                            {datiPeriodi.map((periodo, idx) => {
                              const tasso = periodo.overview?.contributo_totale_ammesso
                                ? (periodo.overview.contributo_totale_ottenuto / periodo.overview.contributo_totale_ammesso) * 100
                                : 0
                              const prevTasso = idx > 0 && datiPeriodi[idx-1].overview?.contributo_totale_ammesso
                                ? (datiPeriodi[idx-1].overview!.contributo_totale_ottenuto / datiPeriodi[idx-1].overview!.contributo_totale_ammesso) * 100
                                : 0
                              return (
                                <td key={periodo.periodo} className="px-3 py-1.5 whitespace-nowrap text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900">
                                      {tasso.toFixed(1)}%
                                    </span>
                                    {idx > 0 && (
                                      <VariationIndicator
                                        current={tasso}
                                        previous={prevTasso}
                                      />
                                    )}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                          <tr>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm font-medium text-gray-900">
                              Numero Clienti Attivi
                            </td>
                            {datiPeriodi.map((periodo, idx) => (
                              <td key={periodo.periodo} className="px-3 py-1.5 whitespace-nowrap text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900">
                                    {periodo.contributiClienti.length}
                                  </span>
                                  {idx > 0 && (
                                    <VariationIndicator
                                      current={periodo.contributiClienti.length}
                                      previous={datiPeriodi[idx-1].contributiClienti.length}
                                    />
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Top 5 Clienti per Periodo */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Top 5 Clienti per Contributi Ottenuti
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Posizione
                            </th>
                            {datiPeriodi.map((periodo) => (
                              <th key={periodo.periodo} className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {periodo.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {[0, 1, 2, 3, 4].map((pos) => (
                            <tr key={pos}>
                              <td className="px-3 py-1.5 whitespace-nowrap text-sm font-medium text-gray-900">
                                #{pos + 1}
                              </td>
                              {datiPeriodi.map((periodo) => {
                                const cliente = periodo.contributiClienti[pos]
                                return (
                                  <td key={periodo.periodo} className="px-3 py-1.5 text-sm">
                                    {cliente ? (
                                      <div>
                                        <div className="font-medium text-gray-900">{cliente.cliente_nome}</div>
                                        <div className="text-primary-600 font-semibold">
                                          {formatCurrency(cliente.contributo_totale_ottenuto)}
                                        </div>
                                        <div className="text-gray-500 text-xs">
                                          {cliente.numero_progetti} progetti
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Scadenze Contrattuali */}
          {activeTab === 'scadenze_contrattuali' && (
            <ScadenzeContrattualiReports />
          )}
        </>
      )}

      {/* Modale Dettaglio Cliente */}
      {clienteSelezionato && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header Modale */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Dettaglio Cliente: {clienteSelezionato.cliente_nome}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Analisi completa dei progetti e bandi
                </p>
              </div>
              <button
                onClick={() => {
                  setClienteSelezionato(null)
                  setBandiDettaglio([])
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Modale */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingDettaglio ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-600 font-medium">Bandi Partecipati</p>
                      <p className="text-lg font-bold text-blue-900 mt-1">
                        {bandiDettaglio.length}
                      </p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-600 font-medium">Progetti Vinti</p>
                      <p className="text-lg font-bold text-green-900 mt-1">
                        {bandiDettaglio.reduce((sum, b) => sum + b.progetti_vinti, 0)}
                      </p>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-600 font-medium">Totale Progetti</p>
                      <p className="text-lg font-bold text-yellow-900 mt-1">
                        {clienteSelezionato.numero_progetti}
                      </p>
                    </div>
                    <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                      <p className="text-sm text-primary-600 font-medium">Contributi Ottenuti</p>
                      <p className="text-lg font-bold text-primary-900 mt-1">
                        {formatCurrency(clienteSelezionato.contributo_totale_ottenuto)}
                      </p>
                    </div>
                  </div>

                  {/* Bandi e Progetti */}
                  <div className="space-y-4">
                    {bandiDettaglio.map((bando) => (
                      <div key={bando.bando_id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900">{bando.bando_nome}</h3>
                              <div className="flex gap-3 mt-2 text-sm text-gray-600">
                                <span>Progetti: {bando.progetti_totali}</span>
                                <span className="text-green-600 font-medium">
                                  Vinti: {bando.progetti_vinti}
                                </span>
                                <span>
                                  Tasso successo: {bando.progetti_totali > 0 ? ((bando.progetti_vinti / bando.progetti_totali) * 100).toFixed(0) : 0}%
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-600">Contributo Ottenuto</p>
                              <p className="text-sm font-bold text-green-600">
                                {formatCurrency(bando.contributo_totale_ottenuto)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="divide-y divide-gray-200">
                          {bando.progetti.map((progetto) => (
                            <div key={progetto.id} className="px-3 py-1.5 hover:bg-gray-50">
                              <div className="flex justify-between items-start">
                                <div className="flex items-start gap-3 flex-1">
                                  {getStatoIcon(progetto.stato)}
                                  <div className="flex-1">
                                    <h4 className="font-medium text-gray-900">
                                      {progetto.titolo_progetto}
                                    </h4>
                                    <p className="text-sm text-gray-600 mt-1">
                                      Codice: {progetto.codice_progetto}
                                    </p>
                                    <div className="flex gap-3 mt-2">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        {getStatoLabel(progetto.stato)}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        Creato: {formatDate(progetto.created_at)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <p className="text-sm text-gray-600">Ammesso</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {formatCurrency(progetto.contributo_ammesso)}
                                  </p>
                                  <p className="text-sm text-gray-600 mt-2">Ottenuto</p>
                                  <p className="text-sm font-semibold text-green-600">
                                    {progetto.contributo_ottenuto ? formatCurrency(progetto.contributo_ottenuto) : '-'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {bandiDettaglio.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      Nessun progetto trovato per questo cliente
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
