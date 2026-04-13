'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Edit,
  Building2,
  Mail,
  Phone,
  MapPin,
  User,
  FileText,
  Clock,
  Zap,
  Star,
  CheckCircle,
  ArrowRight,
  ExternalLink,
  ClipboardCheck,
  BarChart3,
  Target,
  Snowflake,
  Archive,
  Play
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Prospect,
  ProspectHistory,
  ProspectStato,
  PROSPECT_STATI,
  TERMINAL_STATES,
  CONGELAMENTO_DURATE,
  FONTI_ACQUISIZIONE,
  TIPOLOGIE_SOGGETTO,
  AREE_INTERESSE,
  NATURE_INTERESSE,
  AFFIDABILITA_OPTIONS,
  POTENZIALI_ECONOMICI,
  TEMPI_DECISIONE_OPTIONS,
  RACCOMANDAZIONI
} from '@/types/prospect'
import { isGruppo2Complete, isGruppo3Complete, isGruppo4Complete } from '@/lib/prospectValidation'
import ProspectConversionModal from './ProspectConversionModal'
import PrequalificaForm from './PrequalificaForm'

interface ProspectDettaglioProps {
  prospectId: string
  isOpen: boolean
  onClose: () => void
  onEdit: (prospect: Prospect) => void
  onRefresh: () => void
}

const getLabelFromOptions = (options: { value: string; label: string }[], value?: string) => {
  if (!value) return null
  return options.find(o => o.value === value)?.label || value
}

export default function ProspectDettaglio({ prospectId, isOpen, onClose, onEdit, onRefresh }: ProspectDettaglioProps) {
  const [prospect, setProspect] = useState<Prospect | null>(null)
  const [history, setHistory] = useState<ProspectHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTab, setCurrentTab] = useState('anagrafica')
  const [actionLoading, setActionLoading] = useState(false)

  // Modal states
  const [showConversionModal, setShowConversionModal] = useState(false)
  const [showPrequalificaForm, setShowPrequalificaForm] = useState(false)
  const [prequalificaScrollTo, setPrequalificaScrollTo] = useState<number | undefined>(undefined)
  const [showCongelaModal, setShowCongelaModal] = useState(false)
  const [showArchiviaModal, setShowArchiviaModal] = useState(false)

  // Profiling templates for label resolution
  const [profilingTemplateMap, setProfilingTemplateMap] = useState<Record<string, string>>({})

  // Congela form
  const [congelaDurata, setCongelaDurata] = useState<number>(30)
  const [congelaDataCustom, setCongelaDataCustom] = useState('')
  const [congelaMotivo, setCongelaMotivo] = useState('')

  // Archivia form
  const [archiviaMotivo, setArchiviaMotivo] = useState('')

  useEffect(() => {
    if (isOpen && prospectId) {
      fetchProspect()
      fetchHistory()
      fetchProfilingTemplates()
      setCurrentTab('anagrafica')
    }
  }, [isOpen, prospectId])

  const fetchProspect = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_prospect')
        .select('*')
        .eq('id', prospectId)
        .single()

      if (error) throw error
      setProspect(data)
    } catch (error) {
      console.error('Errore nel caricamento prospect:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_prospect_history')
        .select('*')
        .eq('prospect_id', prospectId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setHistory(data || [])
    } catch (error) {
      console.error('Errore nel caricamento storico:', error)
    }
  }

  const fetchProfilingTemplates = async () => {
    try {
      const { data } = await supabase
        .from('scadenze_bandi_profiling_template')
        .select('id, domanda')
      if (data) {
        const map: Record<string, string> = {}
        data.forEach((t: { id: string; domanda: string }) => { map[t.id] = t.domanda })
        setProfilingTemplateMap(map)
      }
    } catch (error) {
      console.error('Errore caricamento profiling templates:', error)
    }
  }

  const updateStato = async (nuovoStato: ProspectStato, note?: string, extraData?: Record<string, any>) => {
    if (!prospect) return

    setActionLoading(true)
    try {
      const updateData: Record<string, any> = {
        stato: nuovoStato,
        ...extraData
      }

      const { error } = await supabase
        .from('scadenze_bandi_prospect')
        .update(updateData)
        .eq('id', prospect.id)

      if (error) throw error

      await supabase
        .from('scadenze_bandi_prospect_history')
        .insert([{
          prospect_id: prospect.id,
          stato_precedente: prospect.stato,
          stato_nuovo: nuovoStato,
          note: note || null
        }])

      await fetchProspect()
      await fetchHistory()
      onRefresh()
    } catch (error) {
      console.error('Errore aggiornamento stato:', error)
      alert('Errore nell\'aggiornamento dello stato')
    } finally {
      setActionLoading(false)
    }
  }

  // --- Action handlers ---

  const handleQualifica = () => {
    updateStato('qualificato', 'Prospect qualificato — Gruppo 2 completo')
  }

  const handlePortaInDecisione = () => {
    updateStato('in_decisione', 'Prospect portato in decisione — Valutazione ed Esito completi')
  }

  const handlePrendiInCarico = () => {
    updateStato('preso_in_carico', 'Prospect preso in carico — decisione positiva')
  }

  const handleCongela = () => {
    if (!congelaMotivo.trim()) {
      alert('Inserire il motivo del congelamento')
      return
    }
    let scongelaDate: string
    if (congelaDurata === 0) {
      if (!congelaDataCustom) {
        alert('Inserire la data di scongelamento')
        return
      }
      scongelaDate = congelaDataCustom
    } else {
      const d = new Date()
      d.setDate(d.getDate() + congelaDurata)
      scongelaDate = d.toISOString().split('T')[0]
    }

    updateStato('congelato', `Congelato: ${congelaMotivo}`, {
      congelato_il: new Date().toISOString(),
      scongela_il: scongelaDate,
      stato_pre_congelamento: prospect!.stato,
      motivo_congelamento: congelaMotivo
    })
    setShowCongelaModal(false)
    setCongelaMotivo('')
    setCongelaDurata(30)
    setCongelaDataCustom('')
  }

  const handleScongela = () => {
    if (!prospect) return
    const statoRipristino = prospect.stato_pre_congelamento || 'bozza'
    updateStato(statoRipristino as ProspectStato, 'Scongelamento manuale', {
      congelato_il: null,
      scongela_il: null,
      stato_pre_congelamento: null,
      motivo_congelamento: null
    })
  }

  const handleArchivia = () => {
    if (!archiviaMotivo.trim()) {
      alert('Inserire il motivo dell\'archiviazione')
      return
    }
    updateStato('archiviato', `Archiviato: ${archiviaMotivo}`, {
      archiviato_il: new Date().toISOString(),
      motivo_archiviazione: archiviaMotivo,
      // Pulisci campi freeze se era congelato
      congelato_il: null,
      scongela_il: null,
      stato_pre_congelamento: null,
      motivo_congelamento: null
    })
    setShowArchiviaModal(false)
    setArchiviaMotivo('')
  }

  const handleConversionComplete = () => {
    fetchProspect()
    fetchHistory()
    onRefresh()
    setShowConversionModal(false)
  }

  const handlePrequalificaSave = () => {
    fetchProspect()
    fetchHistory()
    onRefresh()
    setShowPrequalificaForm(false)
  }

  // --- Helpers ---

  const isNonTerminal = prospect ? !TERMINAL_STATES.includes(prospect.stato) : false
  const isCongelato = prospect?.stato === 'congelato'
  const canOpenPrequalifica = isNonTerminal && !isCongelato

  const getStatoBadge = (stato: ProspectStato) => {
    const config = PROSPECT_STATI[stato]
    if (!config) return 'bg-gray-100 text-gray-700'
    return `${config.bgColor} ${config.color}`
  }

  const getStatoLabel = (stato: string) => {
    const config = PROSPECT_STATI[stato as ProspectStato]
    return config?.label || stato
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateShort = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const ReadOnlyField = ({ label, value, placeholder }: { label: string; value?: string | null; placeholder?: string }) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-0.5">{label}</label>
      <div className="text-sm text-gray-900">
        {value || <span className="text-gray-400 italic">{placeholder || 'Da compilare'}</span>}
      </div>
    </div>
  )

  const EnumBadge = ({ value, options }: { value?: string; options: { value: string; label: string; color?: string; bgColor?: string }[] }) => {
    if (!value) return <span className="text-gray-400 italic text-sm">Da compilare</span>
    const opt = options.find(o => o.value === value)
    if (!opt) return <span className="text-sm text-gray-700">{value}</span>
    const color = (opt as any).color || 'text-gray-700'
    const bg = (opt as any).bgColor || 'bg-gray-100'
    return (
      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${bg} ${color}`}>
        {opt.label}
      </span>
    )
  }

  if (!isOpen) return null

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-center text-gray-600 mt-4">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (!prospect) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <p className="text-center text-red-600">Errore nel caricamento del prospect</p>
          <button onClick={onClose} className="mt-4 btn-primary mx-auto block">
            Chiudi
          </button>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'anagrafica', label: 'Anagrafica', icon: Building2 },
    { id: 'prequalifica', label: 'Prequalifica', icon: ClipboardCheck },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'azioni', label: 'Azioni', icon: Zap }
  ]

  const renderTabContent = () => {
    switch (currentTab) {
      case 'anagrafica':
        return (
          <div className="space-y-3">
            {/* Dati Principali */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Denominazione</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {prospect.denominazione || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numero Prospect</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {prospect.numero_prospect || '-'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Partita IVA</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {prospect.partita_iva || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {prospect.codice_fiscale || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Settore</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {prospect.settore || '-'}
                </div>
              </div>
            </div>

            {/* Contatti */}
            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                Contatti
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {prospect.email || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PEC</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {prospect.pec || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {prospect.telefono || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sito Web</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {prospect.sito_web || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Indirizzo */}
            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Indirizzo
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {prospect.indirizzo || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CAP</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {prospect.cap || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Citta</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {prospect.citta || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {prospect.provincia || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Dettagli Aziendali */}
            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                <Building2 className="w-4 h-4 mr-2" />
                Dettagli Aziendali
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dimensione</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {prospect.dimensione || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numero Dipendenti</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {prospect.numero_dipendenti ?? '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ultimo Fatturato</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {formatCurrency(prospect.ultimo_fatturato)}
                  </div>
                </div>
              </div>
            </div>

            {/* Legale Rappresentante */}
            {(prospect.legale_rappresentante_nome || prospect.legale_rappresentante_cognome) && (
              <div className="border-t pt-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Legale Rappresentante
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                    <div className="input bg-gray-50 cursor-not-allowed">
                      {prospect.legale_rappresentante_nome || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                    <div className="input bg-gray-50 cursor-not-allowed">
                      {prospect.legale_rappresentante_cognome || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <div className="input bg-gray-50 cursor-not-allowed">
                      {prospect.legale_rappresentante_email || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                    <div className="input bg-gray-50 cursor-not-allowed">
                      {prospect.legale_rappresentante_telefono || '-'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Info Gestione */}
            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Gestione
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fonte Acquisizione</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {FONTI_ACQUISIZIONE.find(f => f.value === prospect.fonte_acquisizione)?.label || prospect.fonte_acquisizione || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assegnato a</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {prospect.assegnato_a || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <div className="input bg-gray-50 cursor-not-allowed min-h-[80px]">
                    {prospect.note || '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'prequalifica':
        return (
          <div className="space-y-5">
            {/* Gruppo 1 — Primo Contatto */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Phone className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">Primo Contatto</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
                <ReadOnlyField label="Data contatto" value={formatDateShort(prospect.data_contatto)} />
                <ReadOnlyField label="Ricevuto da" value={prospect.ricevuto_da} />
                <ReadOnlyField label="Canale" value={getLabelFromOptions(FONTI_ACQUISIZIONE, prospect.fonte_acquisizione)} />
                <ReadOnlyField label="Referente" value={prospect.referente_nome} />
              </div>
            </div>

            {/* Gruppo 2 — Qualificazione */}
            <div className="border-t pt-4">
              <div className="flex items-center space-x-2 mb-3">
                <ClipboardCheck className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-semibold text-gray-900">Qualificazione</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-0.5">Tipologia soggetto</label>
                  <EnumBadge value={prospect.tipologia_soggetto} options={TIPOLOGIE_SOGGETTO} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-0.5">Area di interesse</label>
                  {prospect.area_interesse ? (
                    <div className="flex flex-wrap gap-1">
                      {prospect.area_interesse.split(',').map((v) => {
                        const opt = AREE_INTERESSE.find(a => a.value === v.trim())
                        return (
                          <span key={v} className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                            {opt?.label || v.trim()}
                          </span>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic text-sm">Da compilare</span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-0.5">Natura interesse</label>
                  <EnumBadge value={prospect.natura_interesse} options={NATURE_INTERESSE} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-3">
                <ReadOnlyField label="Bisogno dichiarato" value={prospect.bisogno_dichiarato} />
                <ReadOnlyField label="Bisogno interpretato" value={prospect.bisogno_interpretato} />
              </div>
            </div>

            {/* Gruppo 3 — Valutazione */}
            <div className="border-t pt-4">
              <div className="flex items-center space-x-2 mb-3">
                <BarChart3 className="w-4 h-4 text-cyan-600" />
                <h3 className="text-sm font-semibold text-gray-900">Valutazione</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-0.5">Affidabilita percepita</label>
                  <EnumBadge value={prospect.affidabilita_percepita} options={AFFIDABILITA_OPTIONS} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-0.5">Potenziale economico</label>
                  <EnumBadge value={prospect.potenziale_economico} options={POTENZIALI_ECONOMICI} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-0.5">Tempi decisione</label>
                  <EnumBadge value={prospect.tempi_decisione} options={TEMPI_DECISIONE_OPTIONS} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-3">
                <ReadOnlyField label="Budget dichiarato" value={prospect.budget_dichiarato ? 'Si' : 'No'} />
                <ReadOnlyField label="Note qualitative" value={prospect.note_qualitative} />
              </div>
            </div>

            {/* Gruppo 4 — Esito */}
            <div className="border-t pt-4">
              <div className="flex items-center space-x-2 mb-3">
                <Target className="w-4 h-4 text-violet-600" />
                <h3 className="text-sm font-semibold text-gray-900">Esito</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-0.5">Raccomandazione</label>
                  <EnumBadge value={prospect.raccomandazione} options={RACCOMANDAZIONI} />
                </div>
                <ReadOnlyField label="Responsabile qualificazione" value={prospect.responsabile_qualificazione} />
                <ReadOnlyField label="Motivazione" value={prospect.motivazione_raccomandazione} />
                <ReadOnlyField label="Data riunione prevista" value={formatDateShort(prospect.data_riunione_prevista)} />
              </div>
            </div>

            {/* Profiling Score */}
            <div className="border-t pt-4">
              <div className="flex items-center space-x-2 mb-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <h3 className="text-sm font-semibold text-gray-900">Profilazione</h3>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span className="text-lg font-bold text-purple-900">
                    {prospect.profiling_score ?? 0}%
                  </span>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all"
                    style={{ width: `${prospect.profiling_score ?? 0}%` }}
                  />
                </div>
                {prospect.profiling_data && Object.keys(prospect.profiling_data).length > 0 && (
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(prospect.profiling_data).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="text-gray-600">{profilingTemplateMap[key] || key}:</span>{' '}
                        <span className="text-gray-900 font-medium">
                          {typeof value === 'boolean' ? (value ? 'Si' : 'No') :
                           Array.isArray(value) ? value.join(', ') :
                           String(value || '-')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case 'timeline':
        return (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              Storico Cambiamenti
            </h3>

            {history.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-8 h-8 mx-auto mb-1 opacity-50" />
                <p className="text-sm">Nessun evento nello storico</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                <div className="space-y-3">
                  {history.map((entry, index) => (
                    <div key={entry.id} className="relative flex items-start space-x-4">
                      <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        index === 0 ? 'bg-primary-100' : 'bg-gray-100'
                      }`}>
                        <ArrowRight className={`w-4 h-4 ${
                          index === 0 ? 'text-primary-600' : 'text-gray-400'
                        }`} />
                      </div>

                      <div className="flex-1 bg-white border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            {entry.stato_precedente && (
                              <>
                                <span className={`badge ${getStatoBadge(entry.stato_precedente as ProspectStato)}`}>
                                  {getStatoLabel(entry.stato_precedente)}
                                </span>
                                <ArrowRight className="w-4 h-4 text-gray-400" />
                              </>
                            )}
                            <span className={`badge ${getStatoBadge(entry.stato_nuovo as ProspectStato)}`}>
                              {getStatoLabel(entry.stato_nuovo)}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDate(entry.created_at)}
                          </span>
                        </div>
                        {entry.note && (
                          <p className="text-sm text-gray-600">{entry.note}</p>
                        )}
                        {entry.utente && (
                          <p className="text-xs text-gray-400 mt-1">da {entry.utente}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )

      case 'azioni':
        return (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center">
              <Zap className="w-4 h-4 mr-2" />
              Azioni Disponibili
            </h3>

            {/* Info stato corrente */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">Stato corrente:</span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatoBadge(prospect.stato)}`}>
                  {getStatoLabel(prospect.stato)}
                </span>
              </div>
            </div>

            {/* === BOZZA === */}
            {prospect.stato === 'bozza' && (
              <div className="space-y-4">
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 mb-1">Prequalifica</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Compila o modifica la prequalifica del prospect.
                  </p>
                  <button
                    onClick={() => { setPrequalificaScrollTo(undefined); setShowPrequalificaForm(true) }}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>Apri Prequalifica</span>
                  </button>
                </div>

                <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                  <h4 className="font-medium text-blue-900 mb-1">Qualifica</h4>
                  <p className="text-sm text-blue-700 mb-4">
                    {isGruppo2Complete(prospect)
                      ? 'Il Gruppo 2 (Qualificazione) e completo. Puoi qualificare il prospect.'
                      : 'Completa il Gruppo 2 (Qualificazione) nella prequalifica per abilitare questa azione.'}
                  </p>
                  <button
                    onClick={handleQualifica}
                    disabled={actionLoading || !isGruppo2Complete(prospect)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Qualifica</span>
                  </button>
                </div>
              </div>
            )}

            {/* === QUALIFICATO === */}
            {prospect.stato === 'qualificato' && (
              <div className="space-y-4">
                <div className="border rounded-lg p-3">
                  <button
                    onClick={() => { setPrequalificaScrollTo(3); setShowPrequalificaForm(true) }}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>Apri Prequalifica</span>
                  </button>
                </div>

                <div className="border border-purple-200 rounded-lg p-3 bg-purple-50">
                  <h4 className="font-medium text-purple-900 mb-1">Porta in Decisione</h4>
                  <p className="text-sm text-purple-700 mb-4">
                    {isGruppo3Complete(prospect) && isGruppo4Complete(prospect)
                      ? 'Valutazione ed Esito completi. Puoi portare il prospect in decisione.'
                      : 'Completa Valutazione (Gruppo 3) ed Esito (Gruppo 4) nella prequalifica.'}
                  </p>
                  <button
                    onClick={handlePortaInDecisione}
                    disabled={actionLoading || !isGruppo3Complete(prospect) || !isGruppo4Complete(prospect)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>Porta in Decisione</span>
                  </button>
                </div>
              </div>
            )}

            {/* === IN_DECISIONE === */}
            {prospect.stato === 'in_decisione' && (
              <div className="space-y-4">
                <div className="border rounded-lg p-3">
                  <button
                    onClick={() => { setPrequalificaScrollTo(undefined); setShowPrequalificaForm(true) }}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>Apri Prequalifica</span>
                  </button>
                </div>

                <div className="border border-green-200 rounded-lg p-3 bg-green-50">
                  <h4 className="font-medium text-green-900 mb-1">Prendi in Carico</h4>
                  <p className="text-sm text-green-700 mb-4">
                    Decisione positiva: il prospect viene preso in carico.
                  </p>
                  <button
                    onClick={handlePrendiInCarico}
                    disabled={actionLoading}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    {actionLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    <span>Prendi in Carico</span>
                  </button>
                </div>
              </div>
            )}

            {/* === PRESO_IN_CARICO === */}
            {prospect.stato === 'preso_in_carico' && (
              <div className="space-y-4">
                <div className="border rounded-lg p-3">
                  <button
                    onClick={() => { setPrequalificaScrollTo(undefined); setShowPrequalificaForm(true) }}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>Apri Prequalifica</span>
                  </button>
                </div>

                <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50">
                  <h4 className="font-medium text-emerald-900 mb-1">Converti a Cliente</h4>
                  <p className="text-sm text-emerald-700 mb-4">
                    Avvia il processo di conversione del prospect in cliente.
                  </p>
                  <button
                    onClick={() => setShowConversionModal(true)}
                    disabled={actionLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>Converti a Cliente</span>
                  </button>
                </div>
              </div>
            )}

            {/* === CONGELATO === */}
            {prospect.stato === 'congelato' && (
              <div className="space-y-4">
                <div className="border border-cyan-200 rounded-lg p-3 bg-cyan-50">
                  <div className="flex items-center space-x-2 mb-2">
                    <Snowflake className="w-4 h-4 text-cyan-600" />
                    <h4 className="font-medium text-cyan-900">Prospect Congelato</h4>
                  </div>
                  <div className="text-sm text-cyan-700 space-y-1">
                    <p><strong>Congelato il:</strong> {formatDate(prospect.congelato_il)}</p>
                    <p><strong>Scongela il:</strong> {formatDateShort(prospect.scongela_il)}</p>
                    <p><strong>Motivo:</strong> {prospect.motivo_congelamento || '-'}</p>
                    <p><strong>Stato precedente:</strong> {getStatoLabel(prospect.stato_pre_congelamento || 'bozza')}</p>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleScongela}
                    disabled={actionLoading}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>Scongela</span>
                  </button>
                </div>
              </div>
            )}

            {/* === CONVERTITO === */}
            {prospect.stato === 'convertito' && (
              <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50">
                <div className="flex items-center space-x-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-medium text-emerald-900">Prospect Convertito</h4>
                </div>
                <p className="text-sm text-emerald-700 mb-4">
                  Questo prospect e stato convertito in cliente
                  {prospect.data_conversione ? ` il ${formatDate(prospect.data_conversione)}` : ''}.
                </p>
                {prospect.cliente_id && (
                  <button
                    onClick={() => onClose()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Vai al Cliente</span>
                  </button>
                )}
              </div>
            )}

            {/* === ARCHIVIATO === */}
            {prospect.stato === 'archiviato' && (
              <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                <div className="flex items-center space-x-2 mb-1">
                  <Archive className="w-4 h-4 text-red-600" />
                  <h4 className="font-medium text-red-900">Prospect Archiviato</h4>
                </div>
                <div className="text-sm text-red-700 space-y-1">
                  <p><strong>Archiviato il:</strong> {formatDate(prospect.archiviato_il)}</p>
                  <p><strong>Motivo:</strong> {prospect.motivo_archiviazione || '-'}</p>
                </div>
              </div>
            )}

            {/* --- Congela / Archivia buttons (non-terminal, non-congelato) --- */}
            {isNonTerminal && !isCongelato && (
              <div className="border-t border-gray-200 pt-3 mt-6 flex space-x-3">
                <button
                  onClick={() => setShowCongelaModal(true)}
                  disabled={actionLoading}
                  className="text-cyan-600 hover:text-cyan-800 text-sm flex items-center space-x-2 border border-cyan-300 px-3 py-2 rounded-lg hover:bg-cyan-50"
                >
                  <Snowflake className="w-4 h-4" />
                  <span>Congela</span>
                </button>
                <button
                  onClick={() => setShowArchiviaModal(true)}
                  disabled={actionLoading}
                  className="text-red-600 hover:text-red-800 text-sm flex items-center space-x-2 border border-red-300 px-3 py-2 rounded-lg hover:bg-red-50"
                >
                  <Archive className="w-4 h-4" />
                  <span>Archivia</span>
                </button>
              </div>
            )}

            {/* Archivia from congelato */}
            {isCongelato && (
              <div className="border-t border-gray-200 pt-3 mt-6">
                <button
                  onClick={() => setShowArchiviaModal(true)}
                  disabled={actionLoading}
                  className="text-red-600 hover:text-red-800 text-sm flex items-center space-x-2 border border-red-300 px-3 py-2 rounded-lg hover:bg-red-50"
                >
                  <Archive className="w-4 h-4" />
                  <span>Archivia</span>
                </button>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-hard max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="gradient-primary text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Building2 className="w-4 h-4" />
              <div>
                <h2 className="text-sm font-semibold">{prospect.denominazione}</h2>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatoBadge(prospect.stato)}`}>
                    {getStatoLabel(prospect.stato)}
                  </span>
                  {prospect.numero_prospect && (
                    <span className="text-primary-100 text-sm">#{prospect.numero_prospect}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isNonTerminal && !isCongelato && (
                <button
                  onClick={() => onEdit(prospect)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Modifica prospect"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 px-4">
            <div className="flex space-x-3 overflow-x-auto min-w-full">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCurrentTab(tab.id)}
                    className={`py-2 px-1.5 border-b-2 font-medium text-xs flex items-center space-x-2 transition-colors flex-shrink-0 ${
                      currentTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto flex-1">
            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* Congela Modal */}
      {showCongelaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center mr-4">
                  <Snowflake className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Congela Prospect</h3>
                  <p className="text-sm text-gray-500">Metti in pausa questo prospect</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Durata *</label>
                <select
                  value={congelaDurata}
                  onChange={(e) => setCongelaDurata(parseInt(e.target.value))}
                  className="input"
                >
                  {CONGELAMENTO_DURATE.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                {congelaDurata === 0 && (
                  <input
                    type="date"
                    value={congelaDataCustom}
                    onChange={(e) => setCongelaDataCustom(e.target.value)}
                    className="input mt-2"
                    min={new Date().toISOString().split('T')[0]}
                  />
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
                <textarea
                  value={congelaMotivo}
                  onChange={(e) => setCongelaMotivo(e.target.value)}
                  className="input min-h-[100px]"
                  rows={4}
                  placeholder="Motivo del congelamento..."
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => { setShowCongelaModal(false); setCongelaMotivo(''); setCongelaDurata(30); setCongelaDataCustom('') }}
                  className="btn-secondary"
                  disabled={actionLoading}
                >
                  Annulla
                </button>
                <button
                  onClick={handleCongela}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2"
                  disabled={actionLoading || !congelaMotivo.trim()}
                >
                  {actionLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Snowflake className="w-4 h-4" />
                  )}
                  <span>Conferma Congelamento</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archivia Modal */}
      {showArchiviaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <Archive className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Archivia Prospect</h3>
                  <p className="text-sm text-gray-500">Questa azione e irreversibile</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800 font-medium">
                  Attenzione: l'archiviazione e permanente. Il prospect non potra piu essere riattivato.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
                <textarea
                  value={archiviaMotivo}
                  onChange={(e) => setArchiviaMotivo(e.target.value)}
                  className="input min-h-[100px]"
                  rows={4}
                  placeholder="Motivo dell'archiviazione..."
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => { setShowArchiviaModal(false); setArchiviaMotivo('') }}
                  className="btn-secondary"
                  disabled={actionLoading}
                >
                  Annulla
                </button>
                <button
                  onClick={handleArchivia}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2"
                  disabled={actionLoading || !archiviaMotivo.trim()}
                >
                  {actionLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Archive className="w-4 h-4" />
                  )}
                  <span>Conferma Archiviazione</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversion Modal */}
      {showConversionModal && prospect && (
        <ProspectConversionModal
          prospect={prospect}
          isOpen={showConversionModal}
          onClose={() => setShowConversionModal(false)}
          onConvert={handleConversionComplete}
        />
      )}

      {/* Prequalifica Form Modal */}
      {showPrequalificaForm && prospect && (
        <PrequalificaForm
          prospect={prospect}
          isOpen={showPrequalificaForm}
          onClose={() => setShowPrequalificaForm(false)}
          onSave={handlePrequalificaSave}
          scrollToSection={prequalificaScrollTo}
        />
      )}
    </>
  )
}
