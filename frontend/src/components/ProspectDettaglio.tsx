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
  XCircle,
  ArrowRight,
  ExternalLink,
  ClipboardList,
  ClipboardCheck,
  Trash2,
  BarChart3,
  Target
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Prospect,
  ProspectHistory,
  ProspectStato,
  PROSPECT_STATI,
  FONTI_ACQUISIZIONE,
  TIPOLOGIE_SOGGETTO,
  AREE_INTERESSE,
  NATURE_INTERESSE,
  AFFIDABILITA_OPTIONS,
  POTENZIALI_ECONOMICI,
  TEMPI_DECISIONE_OPTIONS,
  RACCOMANDAZIONI
} from '@/types/prospect'
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

  // Modal states for actions
  const [showScartaModal, setShowScartaModal] = useState(false)
  const [showConversionModal, setShowConversionModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPrequalificaForm, setShowPrequalificaForm] = useState(false)
  const [prequalificaScrollTo, setPrequalificaScrollTo] = useState<number | undefined>(undefined)
  const [motivoScarto, setMotivoScarto] = useState('')

  useEffect(() => {
    if (isOpen && prospectId) {
      fetchProspect()
      fetchHistory()
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

      const { error: historyError } = await supabase
        .from('scadenze_bandi_prospect_history')
        .insert([{
          prospect_id: prospect.id,
          stato_precedente: prospect.stato,
          stato_nuovo: nuovoStato,
          note: note || null
        }])

      if (historyError) console.error('Errore inserimento storico:', historyError)

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

  const handlePrendiInCarico = () => {
    updateStato('preso_in_carico', 'Prospect preso in carico — decisione positiva')
  }

  const handleScarta = () => {
    if (!motivoScarto.trim()) {
      alert('Inserire il motivo dello scarto')
      return
    }
    updateStato('scartato', motivoScarto, {
      motivo_rifiuto: motivoScarto,
      data_decisione: new Date().toISOString()
    })
    setShowScartaModal(false)
    setMotivoScarto('')
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

  const handleDelete = async () => {
    try {
      setActionLoading(true)
      await supabase
        .from('scadenze_bandi_prospect_history')
        .delete()
        .eq('prospect_id', prospectId)
      const { error } = await supabase
        .from('scadenze_bandi_prospect')
        .delete()
        .eq('id', prospectId)
      if (error) throw error
      onRefresh()
      onClose()
    } catch (error) {
      console.error('Errore eliminazione:', error)
      alert('Errore durante l\'eliminazione del prospect')
    } finally {
      setActionLoading(false)
      setShowDeleteConfirm(false)
    }
  }

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
    { id: 'profilazione', label: 'Profilazione', icon: ClipboardList },
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
                {prospect.note_valutazione && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Note Valutazione</label>
                    <div className="input bg-gray-50 cursor-not-allowed min-h-[80px]">
                      {prospect.note_valutazione || '-'}
                    </div>
                  </div>
                )}
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
          </div>
        )

      case 'profilazione':
        return (
          <div className="space-y-3">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <ClipboardList className="w-4 h-4 text-purple-600 mr-2" />
                  <h3 className="text-sm font-semibold text-purple-900">Risultati Profilazione</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span className="text-lg font-bold text-purple-900">
                    {prospect.profiling_score ?? 0}
                  </span>
                  <span className="text-sm text-purple-700">punti</span>
                </div>
              </div>
            </div>

            {prospect.profiling_data && Object.keys(prospect.profiling_data).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(prospect.profiling_data).map(([key, value]) => (
                  <div key={key} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">{key}</label>
                        <div className="mt-1 text-gray-900">
                          {typeof value === 'boolean' ? (value ? 'Si' : 'No') :
                           Array.isArray(value) ? value.join(', ') :
                           String(value || '-')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <ClipboardList className="w-8 h-8 mx-auto mb-1 opacity-50" />
                <p className="text-sm">Nessun dato di profilazione disponibile</p>
                <p className="text-xs mt-1">Modifica il prospect per compilare la scheda di profilazione</p>
              </div>
            )}
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

            {/* bozza → Compila prequalifica */}
            {prospect.stato === 'bozza' && (
              <div className="border rounded-lg p-3">
                <h4 className="font-medium text-gray-900 mb-1">Compila la prequalifica</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Completa la sezione di qualificazione per far avanzare il prospect nella pipeline.
                </p>
                <button
                  onClick={() => {
                    setPrequalificaScrollTo(undefined)
                    setShowPrequalificaForm(true)
                  }}
                  className="btn-primary flex items-center space-x-2"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  <span>Compila Prequalifica</span>
                </button>
              </div>
            )}

            {/* qualificato → Completa valutazione ed esito */}
            {prospect.stato === 'qualificato' && (
              <div className="border rounded-lg p-3">
                <h4 className="font-medium text-gray-900 mb-1">Completa valutazione ed esito</h4>
                <p className="text-sm text-gray-600 mb-4">
                  La qualificazione e completa. Compila la valutazione e l'esito per portare il prospect in decisione.
                </p>
                <button
                  onClick={() => {
                    setPrequalificaScrollTo(3)
                    setShowPrequalificaForm(true)
                  }}
                  className="btn-primary flex items-center space-x-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Completa Valutazione</span>
                </button>
              </div>
            )}

            {/* in_decisione → Prendi in carico / Scarta */}
            {prospect.stato === 'in_decisione' && (
              <div className="space-y-4">
                <div className="border border-green-200 rounded-lg p-3 bg-green-50">
                  <h4 className="font-medium text-green-900 mb-1">Prendi in carico</h4>
                  <p className="text-sm text-green-700 mb-4">
                    Decisione positiva: il prospect viene preso in carico e sara poi convertibile in cliente.
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

                <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                  <h4 className="font-medium text-red-900 mb-1">Scarta prospect</h4>
                  <p className="text-sm text-red-700 mb-4">
                    Decisione negativa: il prospect non verra preso in carico.
                  </p>
                  <button
                    onClick={() => setShowScartaModal(true)}
                    disabled={actionLoading}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Scarta</span>
                  </button>
                </div>
              </div>
            )}

            {/* preso_in_carico → Converti a Cliente */}
            {prospect.stato === 'preso_in_carico' && (
              <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50">
                <h4 className="font-medium text-emerald-900 mb-1">Converti a Cliente</h4>
                <p className="text-sm text-emerald-700 mb-4">
                  Avvia il processo di conversione del prospect in cliente. I dati verranno mappati automaticamente.
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
            )}

            {/* convertito → info */}
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

            {/* scartato → info riepilogativa */}
            {prospect.stato === 'scartato' && (
              <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                <div className="flex items-center space-x-2 mb-1">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <h4 className="font-medium text-red-900">Prospect Scartato</h4>
                </div>
                {prospect.motivo_rifiuto && (
                  <p className="text-sm text-red-700">
                    <strong>Motivo:</strong> {prospect.motivo_rifiuto}
                  </p>
                )}
                {prospect.data_decisione && (
                  <p className="text-xs text-red-500 mt-2">
                    Decisione presa il {formatDate(prospect.data_decisione)}
                  </p>
                )}
              </div>
            )}

            {/* Elimina Prospect - sempre visibile (tranne se convertito) */}
            {prospect.stato !== 'convertito' && (
              <div className="border-t border-gray-200 pt-3 mt-6">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-red-600 hover:text-red-800 text-sm flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Elimina prospect</span>
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800 font-medium mb-3">
                      Eliminare definitivamente questo prospect?
                    </p>
                    <div className="flex space-x-3">
                      <button
                        onClick={handleDelete}
                        disabled={actionLoading}
                        className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center space-x-2"
                      >
                        {actionLoading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        <span>Conferma eliminazione</span>
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                )}
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
              <button
                onClick={() => onEdit(prospect)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Modifica prospect"
              >
                <Edit className="w-4 h-4" />
              </button>
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

      {/* Modal Scarto */}
      {showScartaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <XCircle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Scarta Prospect</h3>
                  <p className="text-sm text-gray-500">Inserisci il motivo dello scarto</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivazione *</label>
                <textarea
                  value={motivoScarto}
                  onChange={(e) => setMotivoScarto(e.target.value)}
                  className="input min-h-[100px]"
                  rows={4}
                  placeholder="Descrivi il motivo dello scarto..."
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => { setShowScartaModal(false); setMotivoScarto('') }}
                  className="btn-secondary"
                  disabled={actionLoading}
                >
                  Annulla
                </button>
                <button
                  onClick={handleScarta}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2"
                  disabled={actionLoading || !motivoScarto.trim()}
                >
                  {actionLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  <span>Conferma Scarto</span>
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
