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
import { useAuth } from '@/contexts/AuthContext'
import BottoneChiudi from './shared/BottoneChiudi'

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
  cliente_id?: string | null
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
  onNavigate: (page: string, params?: any) => void
}

export default function DashboardContent({ onNavigate }: DashboardContentProps) {
  const [scadenze, setScadenze] = useState<Scadenza[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showDayModal, setShowDayModal] = useState(false)
  // Di default ciascuno vede le proprie scadenze; con un clic quelle di tutto lo studio
  const [soloMie, setSoloMie] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch scadenze progetto
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

      // Fetch scadenze contrattuali/generali (tutte, per conteggi KPI accurati)
      const { data: dataContr } = await supabase
        .from('scadenze_bandi_scadenze_contrattuali')
        .select('*')
        .order('data_scadenza', { ascending: true })

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Processa scadenze progetto
      const scadenzeProgetto = (scadenzeData || []).map(item => {
        const dataScadenza = new Date(item.data_scadenza)
        dataScadenza.setHours(0, 0, 0, 0)
        const diffTime = dataScadenza.getTime() - today.getTime()
        const giorni_rimanenti = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        let urgenza: 'NORMALE' | 'IMMINENTE' | 'URGENTE' = 'NORMALE'
        if (item.stato !== 'completata') {
          if (giorni_rimanenti < 0) urgenza = 'URGENTE'
          else if (giorni_rimanenti <= 7) urgenza = 'IMMINENTE'
        }

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

      // Processa scadenze contrattuali
      const statoMap: Record<string, string> = { APERTA: 'non_iniziata', IN_CORSO: 'in_corso', COMPLETATA: 'completata' }
      const prioritaMap: Record<string, string> = { BASSA: 'bassa', MEDIA: 'media', ALTA: 'alta', CRITICA: 'alta' }

      const scadenzeContr = (dataContr || []).map(item => {
        const dataScadenza = new Date(item.data_scadenza)
        dataScadenza.setHours(0, 0, 0, 0)
        const diffTime = dataScadenza.getTime() - today.getTime()
        const giorni_rimanenti = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        let urgenza: 'NORMALE' | 'IMMINENTE' | 'URGENTE' = 'NORMALE'
        if (item.stato !== 'COMPLETATA' && item.stato !== 'ANNULLATA') {
          if (giorni_rimanenti < 0) urgenza = 'URGENTE'
          else if (giorni_rimanenti <= 7) urgenza = 'IMMINENTE'
        }

        let clienteNome = '-'
        if (item.categoria === 'riunione_prospect') {
          clienteNome = item.titolo.replace('Riunione qualifica: ', '') + ' (prospect)'
        } else if (item.categoria === 'CONTRATTI') {
          const match = item.titolo.match(/- (.+)$/)
          clienteNome = match ? match[1] : '-'
        }

        return {
          id: item.id,
          titolo: item.titolo,
          data_scadenza: item.data_scadenza,
          stato: (statoMap[item.stato] || 'non_iniziata') as 'non_iniziata' | 'in_corso' | 'completata',
          priorita: (prioritaMap[item.priorita] || 'media') as 'bassa' | 'media' | 'alta',
          responsabile_email: item.responsabile_email || '',
          note: item.descrizione || '',
          giorni_rimanenti,
          urgenza,
          cliente_nome: clienteNome,
          cliente_email: '',
          progetto_id: '',
          progetto_titolo: '-',
          progetto_codice: '-',
          bando_nome: '-',
          bando_id: ''
        }
      })

      const scadenzeProcessate = [...scadenzeProgetto, ...scadenzeContr]
        .sort((a, b) => new Date(a.data_scadenza).getTime() - new Date(b.data_scadenza).getTime())

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
    const elenco = soloMie ? scadenze.filter(s => (s.responsabile_email || '').toLowerCase() === (user?.email || '').toLowerCase()) : scadenze
    return elenco.filter(s => {
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

  const miaEmail = (user?.email || '').toLowerCase()
  const mie = scadenze.filter(s => (s.responsabile_email || '').toLowerCase() === miaEmail)
  const visibili = soloMie ? mie : scadenze
  const aperte = visibili.filter(s => s.stato !== 'completata')
  const scadute = aperte.filter(s => s.giorni_rimanenti < 0).sort((a, b) => b.giorni_rimanenti - a.giorni_rimanenti)
  const oggiDomani = aperte.filter(s => s.giorni_rimanenti >= 0 && s.giorni_rimanenti <= 1)
  const settimana = aperte.filter(s => s.giorni_rimanenti >= 2 && s.giorni_rimanenti <= 7)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const getGiorniText = (giorni: number) => {
    if (giorni < 0) return `scaduta da ${Math.abs(giorni)} gg`
    if (giorni === 0) return 'oggi'
    if (giorni === 1) return 'domani'
    return `tra ${giorni} gg`
  }

  // Un clic sulla riga apre la pratica (o il cliente); le scadenze generali aprono lo scadenzario
  const apri = (s: Scadenza) => {
    if (s.progetto_id) onNavigate('progetti', { openProgettoId: s.progetto_id })
    else if (s.cliente_id) onNavigate('clienti', { openClientId: s.cliente_id })
    else onNavigate('scadenze', { date: s.data_scadenza })
  }

  const Blocco = ({ titolo, elenco, colore, vuoto }: { titolo: string; elenco: Scadenza[]; colore: string; vuoto: string }) => {
    const mostrate = elenco.slice(0, 10)
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${colore}`} />
          <h2 className="text-sm font-medium text-gray-900">{titolo}</h2>
          <span className="text-xs text-gray-500">{elenco.length}</span>
        </div>
        {elenco.length === 0
          ? <div className="px-3 py-3 text-sm text-gray-500">{vuoto}</div>
          : (
            <ul className="divide-y divide-gray-100">
              {mostrate.map(s => (
                <li key={s.id}>
                  <button type="button" onClick={() => apri(s)} className="w-full px-3 py-2 text-left hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 flex-1 truncate">{s.titolo}</span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(s.data_scadenza)} · {getGiorniText(s.giorni_rimanenti)}</span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {[s.cliente_nome !== 'N/D' && s.cliente_nome !== '-' ? s.cliente_nome : '', s.progetto_titolo !== 'N/D' && s.progetto_titolo !== '-' ? s.progetto_titolo : '',
                        !soloMie && s.responsabile_email ? s.responsabile_email : ''].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                </li>
              ))}
              {elenco.length > mostrate.length && (
                <li><button type="button" onClick={() => onNavigate('scadenze')} className="w-full px-3 py-2 text-left text-xs text-blue-600 hover:bg-gray-50">e altre {elenco.length - mostrate.length}: apri lo scadenzario</button></li>
              )}
            </ul>
          )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Intestazione: di chi sono le scadenze mostrate */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">{soloMie ? 'Le mie scadenze' : 'Le scadenze di tutto lo studio'}</h1>
          <p className="text-gray-600 text-sm">Che cosa è scaduto e che cosa scade nei prossimi giorni. I promemoria arrivano anche dal calendario Google.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            <button type="button" onClick={() => setSoloMie(true)} className={`px-3 py-1.5 ${soloMie ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>Le mie</button>
            <button type="button" onClick={() => setSoloMie(false)} className={`px-3 py-1.5 ${!soloMie ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>Tutto lo studio</button>
          </div>
          <button type="button" onClick={fetchDashboardData} className="p-2 text-gray-500 hover:text-gray-800" title="Aggiorna"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {soloMie && mie.length === 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          Non risultano scadenze assegnate a te. <button type="button" onClick={() => setSoloMie(false)} className="underline">Guarda quelle di tutto lo studio</button>.
        </div>
      )}

      {/* Due soli numeri: quelli che chiedono di fare qualcosa */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-red-700">Scadute</p>
            <p className="text-lg font-bold text-red-800">{scadute.length}</p>
          </div>
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-700">Entro 7 giorni</p>
            <p className="text-lg font-bold text-amber-800">{oggiDomani.length + settimana.length}</p>
          </div>
          <Clock className="w-6 h-6 text-amber-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Blocco titolo="Scadute" elenco={scadute} colore="bg-red-500" vuoto="Nessuna scadenza scaduta." />
        <Blocco titolo="Oggi e domani" elenco={oggiDomani} colore="bg-amber-500" vuoto="Niente in scadenza oggi o domani." />
        <Blocco titolo="Questa settimana" elenco={settimana} colore="bg-blue-500" vuoto="Niente in scadenza nei prossimi sette giorni." />
      </div>

      {/* Mini Calendario */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-3 py-1.5 border-b border-gray-200">
          <div
            className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => onNavigate('scadenze')}
            title="Clicca per andare al calendario completo"
          >
            <Calendar className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-medium text-gray-900 hover:text-blue-600">
              Calendario dei prossimi tre mesi
            </h2>
          </div>
        </div>
        <div className="p-4">
          <CalendarioScadenze
            scadenze={visibili}
            mesiDaVisualizzare={3}
            onDayClick={openDayModal}
          />
        </div>
      </div>

      {/* Modal dettaglio giorno */}
      {showDayModal && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <BottoneChiudi onClick={() => setShowDayModal(false)} />
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-900">
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

            <div className="p-4 overflow-y-auto max-h-96">
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
                            {scadenza.urgenza === 'URGENTE' ? 'Scaduta' : scadenza.urgenza === 'IMMINENTE' ? 'Entro 7 giorni' : 'Più avanti'}
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

            <div className="p-4 border-t border-gray-200 bg-gray-50">
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