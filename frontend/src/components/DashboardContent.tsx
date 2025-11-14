'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Building,
  FileText,
  Activity,
  RefreshCw,
  Eye
} from 'lucide-react'
import CalendarioScadenze from './CalendarioScadenze'

interface Scadenza {
  id: string
  titolo: string
  data_scadenza: string
  stato: 'non_iniziata' | 'in_corso' | 'completata'
  priorita: 'bassa' | 'media' | 'alta'
  responsabile_email: string
  note: string
  giorni_rimanenti: number
  urgenza: 'NORMALE' | 'IMMINENTE' | 'URGENTE'
  cliente_nome: string
  cliente_email: string
  progetto_id: string
  progetto_titolo: string
  progetto_codice: string
  bando_nome: string
  bando_id: string
}

interface DashboardStats {
  totaleScadenze: number
  urgenti: number
  imminenti: number
  normali: number
  completate: number
  inCorso: number
  nonIniziate: number
  progetti: number
  clienti: number
  bandi: number
}

interface DashboardContentProps {
  onNavigate: (page: string) => void
}

export default function DashboardContent({ onNavigate }: DashboardContentProps) {
  const [scadenze, setScadenze] = useState<Scadenza[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showDayModal, setShowDayModal] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch scadenze con tutte le relazioni
      const { data: scadenzeData, error: scadenzeError } = await supabase
        .from('scadenze_bandi_scadenze')
        .select(`
          id,
          titolo,
          data_scadenza,
          stato,
          priorita,
          responsabile_email,
          note,
          progetto_id,
          bando_id,
          cliente_id,
          scadenze_bandi_progetti:progetto_id (
            titolo_progetto,
            codice_progetto
          ),
          scadenze_bandi_bandi:bando_id (
            nome
          ),
          scadenze_bandi_clienti:cliente_id (
            denominazione,
            email
          )
        `)
        .order('data_scadenza', { ascending: true })

      if (scadenzeError) throw scadenzeError

      // Processa i dati per calcolare urgenza e giorni rimanenti
      const scadenzeProcessate = (scadenzeData || []).map(item => {
        // Normalizza le date per evitare problemi di fuso orario
        const today = new Date()
        today.setHours(0, 0, 0, 0) // Imposta a mezzanotte locale

        const dataScadenza = new Date(item.data_scadenza)
        dataScadenza.setHours(0, 0, 0, 0) // Imposta a mezzanotte locale

        const diffTime = dataScadenza.getTime() - today.getTime()
        const giorni_rimanenti = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        let urgenza: 'NORMALE' | 'IMMINENTE' | 'URGENTE' = 'NORMALE'
        if (giorni_rimanenti < 0) urgenza = 'URGENTE'
        else if (giorni_rimanenti <= 7) urgenza = 'IMMINENTE'

        return {
          ...item,
          giorni_rimanenti,
          urgenza,
          cliente_nome: item.scadenze_bandi_clienti?.denominazione || 'N/D',
          cliente_email: item.scadenze_bandi_clienti?.email || 'N/D',
          progetto_titolo: item.scadenze_bandi_progetti?.titolo_progetto || 'N/D',
          progetto_codice: item.scadenze_bandi_progetti?.codice_progetto || 'N/D',
          bando_nome: item.scadenze_bandi_bandi?.nome || 'N/D'
        }
      })

      setScadenze(scadenzeProcessate)

      // Calcola statistiche
      const totaleScadenze = scadenzeProcessate.length
      const urgenti = scadenzeProcessate.filter(s => s.urgenza === 'URGENTE').length
      const imminenti = scadenzeProcessate.filter(s => s.urgenza === 'IMMINENTE').length
      const normali = scadenzeProcessate.filter(s => s.urgenza === 'NORMALE').length
      const completate = scadenzeProcessate.filter(s => s.stato === 'completata').length
      const inCorso = scadenzeProcessate.filter(s => s.stato === 'in_corso').length
      const nonIniziate = scadenzeProcessate.filter(s => s.stato === 'non_iniziata').length

      // Conta progetti, clienti e bandi unici
      const progettiUnici = new Set(scadenzeProcessate.map(s => s.progetto_id)).size
      const clientiUnici = new Set(scadenzeProcessate.map(s => s.cliente_nome)).size
      const bandiUnici = new Set(scadenzeProcessate.map(s => s.bando_id)).size

      setStats({
        totaleScadenze,
        urgenti,
        imminenti,
        normali,
        completate,
        inCorso,
        nonIniziate,
        progetti: progettiUnici,
        clienti: clientiUnici,
        bandi: bandiUnici
      })

    } catch (err: any) {
      console.error('Errore nel caricamento dashboard:', err)
      setError('Errore nel caricamento dei dati della dashboard')
    } finally {
      setLoading(false)
    }
  }

  // Helper per normalizzare date evitando problemi di fuso orario
  const formatDateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const openDayModal = (date: Date) => {
    setSelectedDate(formatDateKey(date))
    setShowDayModal(true)
  }

  const getSelectedDateScadenze = () => {
    if (!selectedDate) return []
    return scadenze.filter(s => {
      const scadenzaDate = new Date(s.data_scadenza)
      return formatDateKey(scadenzaDate) === selectedDate
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Ricarica
        </button>
      </div>
    )
  }

  if (!stats) return null

  // Scadenze più urgenti (prossime 10 non completate)
  const scadenzeUrgenti = scadenze
    .filter(s => s.stato !== 'completata')
    .sort((a, b) => a.giorni_rimanenti - b.giorni_rimanenti)
    .slice(0, 10)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getUrgencyColor = (urgenza: string, stato: string) => {
    if (stato === 'completata') return 'text-green-600'

    switch (urgenza) {
      case 'URGENTE': return 'text-red-600'
      case 'IMMINENTE': return 'text-orange-600'
      default: return 'text-gray-600'
    }
  }

  const getGiorniText = (giorni: number) => {
    if (giorni < 0) return `${Math.abs(giorni)} gg fa`
    if (giorni === 0) return 'Oggi'
    if (giorni === 1) return 'Domani'
    return `${giorni} gg`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Panoramica scadenze e progetti</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          Aggiorna
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <button
          onClick={() => onNavigate('scadenze')}
          className="bg-red-50 p-6 rounded-lg border border-red-200 hover:bg-red-100 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Urgenti</p>
              <p className="text-3xl font-bold text-red-900">{stats.urgenti}</p>
              <p className="text-xs text-red-600">Scadute o critiche</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-600" />
          </div>
        </button>

        <button
          onClick={() => onNavigate('scadenze')}
          className="bg-orange-50 p-6 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Imminenti</p>
              <p className="text-3xl font-bold text-orange-900">{stats.imminenti}</p>
              <p className="text-xs text-orange-600">Entro 7 giorni</p>
            </div>
            <Clock className="w-10 h-10 text-orange-600" />
          </div>
        </button>

        <button
          onClick={() => onNavigate('scadenze')}
          className="bg-green-50 p-6 rounded-lg border border-green-200 hover:bg-green-100 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Completate</p>
              <p className="text-3xl font-bold text-green-900">{stats.completate}</p>
              <p className="text-xs text-green-600">
                {stats.totaleScadenze > 0
                  ? `${Math.round((stats.completate / stats.totaleScadenze) * 100)}% del totale`
                  : '0% del totale'
                }
              </p>
            </div>
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
        </button>

        <button
          onClick={() => onNavigate('scadenze')}
          className="bg-blue-50 p-6 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Totale</p>
              <p className="text-3xl font-bold text-blue-900">{stats.totaleScadenze}</p>
              <p className="text-xs text-blue-600">Tutte le scadenze</p>
            </div>
            <Activity className="w-10 h-10 text-blue-600" />
          </div>
        </button>
      </div>

      {/* Sezione Panoramica */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scadenze più urgenti */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Scadenze Prioritarie
            </h2>
            <p className="text-sm text-gray-600">Le prossime 10 scadenze da gestire</p>
          </div>

          <div className="overflow-x-auto">
            {scadenzeUrgenti.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scadenza</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progetto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giorni</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scadenzeUrgenti.map((scadenza) => (
                    <tr
                      key={scadenza.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => onNavigate('scadenze')}
                      title="Clicca per andare alle scadenze"
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 hover:text-blue-600">{scadenza.titolo}</div>
                      </td>
                      <td
                        className="px-6 py-4 text-sm text-gray-900 hover:text-blue-600"
                        onClick={(e) => { e.stopPropagation(); onNavigate('clienti'); }}
                        title="Clicca per andare ai clienti"
                      >
                        {scadenza.cliente_nome}
                      </td>
                      <td
                        className="px-6 py-4 hover:text-blue-600"
                        onClick={(e) => { e.stopPropagation(); onNavigate('progetti'); }}
                        title="Clicca per andare ai progetti"
                      >
                        <div className="text-sm font-medium text-gray-900">{scadenza.progetto_titolo}</div>
                        <div className="text-xs text-gray-500">{scadenza.progetto_codice}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{formatDate(scadenza.data_scadenza)}</td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-medium ${getUrgencyColor(scadenza.urgenza, scadenza.stato)}`}>
                          {getGiorniText(scadenza.giorni_rimanenti)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          scadenza.stato === 'completata' ? 'bg-green-100 text-green-800' :
                          scadenza.stato === 'in_corso' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {scadenza.stato === 'non_iniziata' ? 'Da fare' :
                           scadenza.stato === 'in_corso' ? 'In corso' : 'Completata'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna scadenza urgente</h3>
                <p className="mt-1 text-sm text-gray-500">Tutte le scadenze sono sotto controllo!</p>
              </div>
            )}
          </div>
        </div>

        {/* Statistiche rapide */}
        <div className="space-y-4">
          {/* Progetti e clienti */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-gray-600" />
              Panoramica
            </h3>
            <div className="space-y-3">
              <div
                className="flex justify-between cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                onClick={() => onNavigate('progetti')}
                title="Clicca per vedere tutti i progetti"
              >
                <span className="text-gray-600">Progetti attivi</span>
                <span className="font-semibold hover:text-blue-600">{stats.progetti}</span>
              </div>
              <div
                className="flex justify-between cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                onClick={() => onNavigate('clienti')}
                title="Clicca per vedere tutti i clienti"
              >
                <span className="text-gray-600">Clienti</span>
                <span className="font-semibold hover:text-blue-600">{stats.clienti}</span>
              </div>
              <div
                className="flex justify-between cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                onClick={() => onNavigate('bandi')}
                title="Clicca per vedere tutti i bandi"
              >
                <span className="text-gray-600">Bandi</span>
                <span className="font-semibold hover:text-blue-600">{stats.bandi}</span>
              </div>
              <hr className="my-2" />
              <div
                className="flex justify-between cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                onClick={() => onNavigate('scadenze')}
                title="Clicca per vedere le scadenze in corso"
              >
                <span className="text-gray-600">In corso</span>
                <span className="font-semibold text-blue-600 hover:text-blue-800">{stats.inCorso}</span>
              </div>
              <div
                className="flex justify-between cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                onClick={() => onNavigate('scadenze')}
                title="Clicca per vedere le scadenze da iniziare"
              >
                <span className="text-gray-600">Da iniziare</span>
                <span className="font-semibold text-gray-600 hover:text-blue-600">{stats.nonIniziate}</span>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Azioni rapide</h3>
            <div className="space-y-2">
              <button
                onClick={() => onNavigate('scadenze')}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded flex items-center gap-2 transition-colors"
              >
                <Eye className="w-4 h-4" />
                Vai a Scadenze
              </button>
              <button
                onClick={() => onNavigate('progetti')}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded flex items-center gap-2 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Vai a Progetti
              </button>
              <button
                onClick={() => onNavigate('clienti')}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded flex items-center gap-2 transition-colors"
              >
                <Building className="w-4 h-4" />
                Vai a Clienti
              </button>
              <button
                onClick={() => onNavigate('bandi')}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded flex items-center gap-2 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Vai a Bandi
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mini Calendario */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div
            className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => onNavigate('scadenze')}
            title="Clicca per andare al calendario completo"
          >
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-medium text-gray-900 hover:text-blue-600">
              Calendario Scadenze - Panoramica 3 Mesi
            </h2>
          </div>
        </div>
        <div className="p-4">
          <CalendarioScadenze
            scadenze={scadenze}
            mesiDaVisualizzare={3}
            onDayClick={openDayModal}
          />
        </div>
      </div>

      {/* Modal dettaglio giorno */}
      {showDayModal && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Scadenze del {new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </h3>
              <button
                onClick={() => setShowDayModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-96">
              {getSelectedDateScadenze().length > 0 ? (
                <div className="space-y-4">
                  {getSelectedDateScadenze().map((scadenza) => (
                    <div key={scadenza.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 mb-2">{scadenza.titolo}</h4>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div><strong>Cliente:</strong> {scadenza.cliente_nome}</div>
                            <div><strong>Progetto:</strong> {scadenza.progetto_titolo} ({scadenza.progetto_codice})</div>
                            <div><strong>Bando:</strong> {scadenza.bando_nome}</div>
                            <div><strong>Responsabile:</strong> {scadenza.responsabile_email}</div>
                            {scadenza.note && (
                              <div><strong>Note:</strong> {scadenza.note}</div>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex flex-col items-end gap-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            scadenza.urgenza === 'URGENTE' ? 'bg-red-100 border-red-500 text-red-800' :
                            scadenza.urgenza === 'IMMINENTE' ? 'bg-orange-100 border-orange-500 text-orange-800' :
                            'bg-gray-100 border-gray-300 text-gray-700'
                          }`}>
                            {scadenza.urgenza}
                          </span>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                            scadenza.stato === 'completata' ? 'bg-green-100 text-green-800' :
                            scadenza.stato === 'in_corso' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {scadenza.stato === 'non_iniziata' ? 'Da fare' :
                             scadenza.stato === 'in_corso' ? 'In corso' : 'Completata'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Nessuna scadenza per questa data
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowDayModal(false)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}