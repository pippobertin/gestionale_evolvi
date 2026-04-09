'use client'

import { useState, useEffect } from 'react'
import {
  BarChart3,
  Download,
  Filter,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp
} from 'lucide-react'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsivePie } from '@nivo/pie'
import { ResponsiveLine } from '@nivo/line'
import { TIPI_SCADENZA } from '@/types/evolvi-contract'

interface AggregatedItem {
  gruppo: string
  totale: number
  aperte: number
  in_corso: number
  completate: number
  annullate: number
  scadute: number
  tasso_completamento: number
  media_giorni_completamento: number
  per_priorita: {
    BASSA: number
    MEDIA: number
    ALTA: number
    CRITICA: number
  }
}

interface ReportData {
  group_by: string
  aggregated: AggregatedItem[]
  totali: {
    totale: number
    completate: number
    scadute: number
    tasso_completamento: number
  }
  dettaglio: any[]
}

const STATI_OPTIONS = [
  { value: '', label: 'Tutti gli stati' },
  { value: 'APERTA', label: 'Aperta' },
  { value: 'IN_CORSO', label: 'In Corso' },
  { value: 'COMPLETATA', label: 'Completata' },
  { value: 'ANNULLATA', label: 'Annullata' }
]

const GROUP_BY_OPTIONS = [
  { value: 'tipo', label: 'Per Tipo' },
  { value: 'responsabile', label: 'Per Responsabile' },
  { value: 'mese', label: 'Per Mese' },
  { value: 'cliente', label: 'Per Cliente' }
]

// Colori per i tipi di scadenza
const TIPO_COLORS: Record<string, string> = {
  CONTRATTUALE: '#3b82f6',
  FISCALE: '#ef4444',
  AMMINISTRATIVA: '#f59e0b',
  CERTIFICAZIONE: '#10b981',
  PAGAMENTO: '#8b5cf6',
  REVISIONE: '#ec4899',
  ALTRO: '#6b7280'
}

export default function ScadenzeContrattualiReports() {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Filtri
  const [dataFrom, setDataFrom] = useState('')
  const [dataTo, setDataTo] = useState('')
  const [tipoScadenza, setTipoScadenza] = useState('')
  const [stato, setStato] = useState('')
  const [groupBy, setGroupBy] = useState('tipo')

  useEffect(() => {
    loadReportData()
  }, [dataFrom, dataTo, tipoScadenza, stato, groupBy])

  const loadReportData = async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      params.set('group_by', groupBy)
      if (dataFrom) params.set('data_from', dataFrom)
      if (dataTo) params.set('data_to', dataTo)
      if (tipoScadenza) params.set('tipo_scadenza', tipoScadenza)
      if (stato) params.set('stato', stato)

      const res = await fetch(`/api/scadenze-contrattuali/reports?${params.toString()}`)
      const result = await res.json()

      if (!result.success) throw new Error(result.error)

      setReportData(result.data)
    } catch (err: any) {
      console.error('Errore caricamento report:', err)
      setError('Errore nel caricamento dei dati report')
    } finally {
      setLoading(false)
    }
  }

  // Prepara dati per il grafico a torta (distribuzione per tipo)
  const getPieData = () => {
    if (!reportData || groupBy !== 'tipo') return []

    return reportData.aggregated.map(item => ({
      id: getTipoLabel(item.gruppo),
      label: getTipoLabel(item.gruppo),
      value: item.totale,
      color: TIPO_COLORS[item.gruppo] || '#6b7280'
    }))
  }

  // Prepara dati per il grafico a barre (per mese)
  const getBarData = () => {
    if (!reportData) return []

    if (groupBy === 'mese') {
      return reportData.aggregated.map(item => ({
        mese: item.gruppo,
        Aperte: item.aperte,
        'In Corso': item.in_corso,
        Completate: item.completate,
        Scadute: item.scadute
      }))
    }

    return reportData.aggregated.map(item => ({
      gruppo: groupBy === 'tipo' ? getTipoLabel(item.gruppo) : item.gruppo,
      Totale: item.totale,
      Completate: item.completate,
      Scadute: item.scadute
    }))
  }

  // Prepara dati per il grafico a linee (trend mensile)
  const getLineData = () => {
    if (!reportData || groupBy !== 'mese') return []

    return [
      {
        id: 'Completate',
        data: reportData.aggregated.map(item => ({
          x: item.gruppo,
          y: item.completate
        }))
      },
      {
        id: 'Scadute',
        data: reportData.aggregated.map(item => ({
          x: item.gruppo,
          y: item.scadute
        }))
      }
    ]
  }

  const getTipoLabel = (value: string) => {
    return TIPI_SCADENZA.find(t => t.value === value)?.label || value
  }

  // Export CSV
  const exportToCSV = () => {
    if (!reportData || reportData.dettaglio.length === 0) return

    const headers = [
      'Titolo', 'Tipo Scadenza', 'Categoria', 'Data Scadenza', 'Stato',
      'Priorita', 'Responsabile', 'Entity Type', 'Tags', 'Data Completamento'
    ]

    const rows = reportData.dettaglio.map(item => [
      item.titolo || '',
      item.tipo_scadenza || '',
      item.categoria || '',
      item.data_scadenza || '',
      item.stato || '',
      item.priorita || '',
      item.responsabile_email || '',
      item.entity_type || '',
      (item.tags || []).join('; '),
      item.data_completamento || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-scadenze-contrattuali-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Report Scadenze Contrattuali</h1>
          <p className="text-gray-600 mt-1">Analisi e statistiche delle scadenze contrattuali</p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={!reportData || reportData.dettaglio.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Esporta CSV
        </button>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Raggruppa per
            </label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {GROUP_BY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo Scadenza
            </label>
            <select
              value={tipoScadenza}
              onChange={(e) => setTipoScadenza(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tutti i tipi</option>
              {TIPI_SCADENZA.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stato
            </label>
            <select
              value={stato}
              onChange={(e) => setStato(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {STATI_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Inizio
            </label>
            <input
              type="date"
              value={dataFrom}
              onChange={(e) => setDataFrom(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Fine
            </label>
            <input
              type="date"
              value={dataTo}
              onChange={(e) => setDataTo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-600 mt-4">Caricamento dati...</p>
        </div>
      ) : reportData && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Totale Scadenze</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {reportData.totali.totale}
                  </p>
                </div>
                <Calendar className="w-6 h-6 text-gray-300" />
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Tasso Completamento</p>
                  <p className="text-3xl font-bold text-green-900 mt-2">
                    {reportData.totali.tasso_completamento}%
                  </p>
                </div>
                <CheckCircle className="w-6 h-6 text-green-300" />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Media gg Completamento</p>
                  <p className="text-3xl font-bold text-blue-900 mt-2">
                    {reportData.aggregated.length > 0
                      ? Math.round(
                          reportData.aggregated.reduce((sum, a) => sum + a.media_giorni_completamento, 0) /
                          reportData.aggregated.filter(a => a.media_giorni_completamento > 0).length || 1
                        )
                      : 0
                    }
                  </p>
                </div>
                <Clock className="w-6 h-6 text-blue-300" />
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Scadute %</p>
                  <p className="text-3xl font-bold text-red-900 mt-2">
                    {reportData.totali.totale > 0
                      ? Math.round((reportData.totali.scadute / reportData.totali.totale) * 100)
                      : 0
                    }%
                  </p>
                  <p className="text-xs text-red-500 mt-1">
                    ({reportData.totali.scadute} scadenze)
                  </p>
                </div>
                <AlertTriangle className="w-6 h-6 text-red-300" />
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Pie Chart - Distribuzione per tipo */}
            {groupBy === 'tipo' && getPieData().length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Distribuzione per Tipo Scadenza
                </h3>
                <div style={{ height: '350px' }}>
                  <ResponsivePie
                    data={getPieData()}
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
            )}

            {/* Bar Chart - Scadenze per gruppo */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                {groupBy === 'mese' ? 'Scadenze per Mese' : `Scadenze per ${GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label || groupBy}`}
              </h3>
              <div style={{ height: '350px' }}>
                {getBarData().length > 0 ? (
                  <ResponsiveBar
                    data={getBarData()}
                    keys={groupBy === 'mese'
                      ? ['Aperte', 'In Corso', 'Completate', 'Scadute']
                      : ['Totale', 'Completate', 'Scadute']
                    }
                    indexBy={groupBy === 'mese' ? 'mese' : 'gruppo'}
                    margin={{ top: 20, right: 130, bottom: 60, left: 60 }}
                    padding={0.3}
                    groupMode="grouped"
                    valueScale={{ type: 'linear' }}
                    colors={groupBy === 'mese'
                      ? ['#3b82f6', '#f59e0b', '#10b981', '#ef4444']
                      : ['#3b82f6', '#10b981', '#ef4444']
                    }
                    borderRadius={4}
                    axisBottom={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: -30
                    }}
                    axisLeft={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: 0
                    }}
                    labelSkipWidth={12}
                    labelSkipHeight={12}
                    labelTextColor="#ffffff"
                    legends={[
                      {
                        dataFrom: 'keys',
                        anchor: 'bottom-right',
                        direction: 'column',
                        translateX: 120,
                        itemWidth: 100,
                        itemHeight: 20,
                        symbolSize: 12,
                        symbolShape: 'circle'
                      }
                    ]}
                    animate={true}
                    motionConfig="gentle"
                    theme={{
                      fontSize: 12,
                      textColor: '#6b7280'
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Nessun dato disponibile
                  </div>
                )}
              </div>
            </div>

            {/* Line Chart - Trend mensile (solo se raggruppamento per mese) */}
            {groupBy === 'mese' && getLineData().length > 0 && getLineData()[0].data.length > 1 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Trend Completate vs Scadute
                </h3>
                <div style={{ height: '300px' }}>
                  <ResponsiveLine
                    data={getLineData()}
                    margin={{ top: 20, right: 110, bottom: 50, left: 60 }}
                    xScale={{ type: 'point' }}
                    yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
                    curve="monotoneX"
                    axisBottom={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: -30
                    }}
                    axisLeft={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: 0
                    }}
                    colors={['#10b981', '#ef4444']}
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
            )}
          </div>

          {/* Detail Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Dati Aggregati
              </h3>
              <span className="text-sm text-gray-500">
                {reportData.aggregated.length} gruppi
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label || 'Gruppo'}
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Totale
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aperte
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      In Corso
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completate
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scadute
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tasso Compl.
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Media gg
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.aggregated.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {groupBy === 'tipo' ? getTipoLabel(item.gruppo) : item.gruppo}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {item.totale}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-sm text-blue-600">
                        {item.aperte}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-sm text-yellow-600">
                        {item.in_corso}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-sm text-green-600">
                        {item.completate}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-sm text-red-600">
                        {item.scadute}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className={`h-2 rounded-full ${
                                item.tasso_completamento >= 70 ? 'bg-green-500' :
                                item.tasso_completamento >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(item.tasso_completamento, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">
                            {item.tasso_completamento}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-600">
                        {item.media_giorni_completamento > 0 ? `${item.media_giorni_completamento} gg` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {reportData.aggregated.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  Nessun dato disponibile per i filtri selezionati
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
