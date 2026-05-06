'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X, Building2, Briefcase, Users, TrendingUp,
  Plus, Link, Unlink, ExternalLink, Search,
  Mail, Phone, Globe, MapPin, FileText,
  BarChart3, Euro, GraduationCap, FolderOpen
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Interfaces ───────────────────────────────────────────

interface Consulente {
  id: string
  denominazione: string
  partita_iva: string | null
  codice_fiscale: string | null
  email: string | null
  pec: string | null
  telefono: string | null
  sito_web: string | null
  indirizzo_fatturazione: string | null
  cap_fatturazione: string | null
  citta_fatturazione: string | null
  provincia_fatturazione: string | null
  note: string | null
}

interface Relationship {
  id: string
  consulente_id: string
  cliente_id: string
  tipo_segnalazione: string
  data_segnalazione: string
  note: string | null
  created_at: string
  cliente: {
    id: string
    denominazione: string
    partita_iva: string | null
    email: string | null
    telefono: string | null
    citta_fatturazione: string | null
    provincia_fatturazione: string | null
    categoria_evolvi: string | null
  } | null
}

interface ClienteSearchResult {
  id: string
  denominazione: string
  partita_iva: string | null
  citta_fatturazione: string | null
}

interface EconomicStats {
  clienti_segnalati: number
  segnalazioni_totali: number
  per_tipo_segnalazione: Record<string, number>
  progetti: { totale: number; importo_totale_progetto: number; contributo_ammesso: number; contributo_ottenuto: number; per_stato: Record<string, number> }
  contratti_evolvi: { totale: number; attivi: number; importo_annuale_totale: number; importo_totale: number; per_stato: Record<string, number> }
  fatture: { totale: number; importo_totale: number; pagate: number; importo_pagato: number; da_pagare: number; scadute: number }
  formazione: { piani_totale: number; importo_approvato: number; importo_erogato: number; ore_erogate: number; partecipanti_previsti: number }
  corsi: { totale: number; ore_durata_totale: number; partecipanti_totale: number }
  adesioni_fpi: { totale: number; attive: number; dipendenti_aderenti: number }
}

interface ConsulenteDettaglioProps {
  consulenteId: string
  isOpen: boolean
  onClose: () => void
  onNavigate?: (page: string, params?: any) => void
}

// ─── Helpers ──────────────────────────────────────────────

const formatEuro = (value: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)

const formatDate = (date: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('it-IT')
}

const TIPO_SEGNALAZIONE_CONFIG: Record<string, { label: string; color: string }> = {
  bandi: { label: 'Bandi', color: 'bg-blue-100 text-blue-700' },
  spot: { label: 'Spot', color: 'bg-yellow-100 text-yellow-700' },
  formazione: { label: 'Formazione', color: 'bg-green-100 text-green-700' },
}

// ─── Component ────────────────────────────────────────────

export default function ConsulenteDettaglio({ consulenteId, isOpen, onClose, onNavigate }: ConsulenteDettaglioProps) {
  const [consulente, setConsulente] = useState<Consulente | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTab, setCurrentTab] = useState('anagrafica')

  // Tab: Clienti Segnalati
  const [clientiSegnalati, setClientiSegnalati] = useState<Relationship[]>([])
  const [loadingClienti, setLoadingClienti] = useState(false)
  const [showAssociaModal, setShowAssociaModal] = useState(false)
  const [showNuovoClienteModal, setShowNuovoClienteModal] = useState(false)

  // Sub-modal: Associa Esistente
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<ClienteSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState<ClienteSearchResult | null>(null)
  const [tipiSegnalazione, setTipiSegnalazione] = useState<string[]>([])
  const [dataSegnalazione, setDataSegnalazione] = useState(new Date().toISOString().split('T')[0])
  const [noteSegnalazione, setNoteSegnalazione] = useState('')
  const [associaLoading, setAssociaLoading] = useState(false)
  const [associaError, setAssociaError] = useState<string | null>(null)

  // Sub-modal: Nuovo Cliente
  const [nuovoCliente, setNuovoCliente] = useState({
    denominazione: '', partita_iva: '', email: '', telefono: '',
    citta_fatturazione: '', provincia_fatturazione: ''
  })
  const [nuovoTipiSegnalazione, setNuovoTipiSegnalazione] = useState<string[]>([])
  const [nuovoDataSegnalazione, setNuovoDataSegnalazione] = useState(new Date().toISOString().split('T')[0])
  const [nuovoLoading, setNuovoLoading] = useState(false)
  const [nuovoError, setNuovoError] = useState<string | null>(null)

  // Tab: Riepilogo Economico
  const [stats, setStats] = useState<EconomicStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [statsLoaded, setStatsLoaded] = useState(false)

  // ─── Data Fetching ────────────────────────────────────

  const fetchConsulente = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_clienti')
        .select('id, denominazione, partita_iva, codice_fiscale, email, pec, telefono, sito_web, indirizzo_fatturazione, cap_fatturazione, citta_fatturazione, provincia_fatturazione, note')
        .eq('id', consulenteId)
        .single()

      if (error) throw error
      setConsulente(data)
    } catch (err) {
      console.error('Errore fetch consulente:', err)
    } finally {
      setLoading(false)
    }
  }, [consulenteId])

  const fetchClientiSegnalati = useCallback(async () => {
    setLoadingClienti(true)
    try {
      const res = await fetch(`/api/consulenti/${consulenteId}/clienti`)
      const result = await res.json()
      if (result.success) {
        setClientiSegnalati(result.data)
      }
    } catch (err) {
      console.error('Errore fetch clienti segnalati:', err)
    } finally {
      setLoadingClienti(false)
    }
  }, [consulenteId])

  const fetchStats = useCallback(async () => {
    if (statsLoaded) return
    setLoadingStats(true)
    try {
      const res = await fetch(`/api/consulenti/${consulenteId}/stats`)
      const result = await res.json()
      if (result.success) {
        setStats(result.data)
        setStatsLoaded(true)
      }
    } catch (err) {
      console.error('Errore fetch stats consulente:', err)
    } finally {
      setLoadingStats(false)
    }
  }, [consulenteId, statsLoaded])

  useEffect(() => {
    if (isOpen && consulenteId) {
      fetchConsulente()
      fetchClientiSegnalati()
    }
  }, [isOpen, consulenteId, fetchConsulente, fetchClientiSegnalati])

  useEffect(() => {
    if (currentTab === 'riepilogo') {
      fetchStats()
    }
  }, [currentTab, fetchStats])

  // ─── Search Clients ───────────────────────────────────

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const { data } = await supabase
          .from('scadenze_bandi_clienti')
          .select('id, denominazione, partita_iva, citta_fatturazione')
          .neq('categoria_evolvi', 'CONSULENTI')
          .ilike('denominazione', `%${searchTerm}%`)
          .order('denominazione')
          .limit(20)

        setSearchResults(data || [])
      } catch (err) {
        console.error('Errore ricerca clienti:', err)
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // ─── Handlers ─────────────────────────────────────────

  const handleAssociaCliente = async () => {
    if (!selectedCliente || tipiSegnalazione.length === 0) return
    setAssociaLoading(true)
    setAssociaError(null)
    try {
      const errors: string[] = []
      for (const tipo of tipiSegnalazione) {
        const res = await fetch(`/api/consulenti/${consulenteId}/clienti`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cliente_id: selectedCliente.id,
            tipo_segnalazione: tipo,
            data_segnalazione: dataSegnalazione,
            note: noteSegnalazione || null
          })
        })
        const result = await res.json()
        if (!result.success) errors.push(`${tipo}: ${result.error}`)
      }

      if (errors.length > 0 && errors.length === tipiSegnalazione.length) {
        throw new Error(errors.join('; '))
      }

      setShowAssociaModal(false)
      resetAssociaForm()
      fetchClientiSegnalati()
      setStatsLoaded(false)
    } catch (err: any) {
      setAssociaError(err.message)
    } finally {
      setAssociaLoading(false)
    }
  }

  const handleNuovoCliente = async () => {
    if (!nuovoCliente.denominazione.trim() || nuovoTipiSegnalazione.length === 0) return
    setNuovoLoading(true)
    setNuovoError(null)
    try {
      // 1. Crea il cliente
      const { data: newClient, error: insertError } = await supabase
        .from('scadenze_bandi_clienti')
        .insert([{
          denominazione: nuovoCliente.denominazione.trim(),
          partita_iva: nuovoCliente.partita_iva || null,
          email: nuovoCliente.email || null,
          telefono: nuovoCliente.telefono || null,
          citta_fatturazione: nuovoCliente.citta_fatturazione || null,
          provincia_fatturazione: nuovoCliente.provincia_fatturazione || null,
        }])
        .select('id')
        .single()

      if (insertError) throw insertError

      // 2. Crea le associazioni per ogni tipo selezionato
      for (const tipo of nuovoTipiSegnalazione) {
        const res = await fetch(`/api/consulenti/${consulenteId}/clienti`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cliente_id: newClient.id,
            tipo_segnalazione: tipo,
            data_segnalazione: nuovoDataSegnalazione,
          })
        })
        const result = await res.json()
        if (!result.success) throw new Error(result.error)
      }

      setShowNuovoClienteModal(false)
      resetNuovoForm()
      fetchClientiSegnalati()
      setStatsLoaded(false)
    } catch (err: any) {
      setNuovoError(err.message)
    } finally {
      setNuovoLoading(false)
    }
  }

  const handleRemoveRelazione = async (relId: string) => {
    if (!confirm('Rimuovere questa associazione?')) return
    try {
      const res = await fetch(`/api/consulenti/${consulenteId}/clienti/${relId}`, { method: 'DELETE' })
      const result = await res.json()
      if (result.success) {
        fetchClientiSegnalati()
        setStatsLoaded(false)
      }
    } catch (err) {
      console.error('Errore rimozione:', err)
    }
  }

  const resetAssociaForm = () => {
    setSearchTerm('')
    setSearchResults([])
    setSelectedCliente(null)
    setTipiSegnalazione([])
    setDataSegnalazione(new Date().toISOString().split('T')[0])
    setNoteSegnalazione('')
    setAssociaError(null)
  }

  const resetNuovoForm = () => {
    setNuovoCliente({ denominazione: '', partita_iva: '', email: '', telefono: '', citta_fatturazione: '', provincia_fatturazione: '' })
    setNuovoTipiSegnalazione([])
    setNuovoDataSegnalazione(new Date().toISOString().split('T')[0])
    setNuovoError(null)
  }

  // ─── Tabs ─────────────────────────────────────────────

  const tabs = [
    { id: 'anagrafica', label: 'Anagrafica Partner', icon: Building2 },
    { id: 'clienti_segnalati', label: 'Clienti Segnalati', icon: Users },
    { id: 'riepilogo', label: 'Riepilogo Economico', icon: TrendingUp },
  ]

  // ─── Tab Renders ──────────────────────────────────────

  const renderAnagrafica = () => {
    if (!consulente) return null

    const fields = [
      { label: 'Denominazione', value: consulente.denominazione },
      { label: 'Partita IVA', value: consulente.partita_iva },
      { label: 'Codice Fiscale', value: consulente.codice_fiscale },
      { label: 'Email', value: consulente.email, icon: Mail },
      { label: 'PEC', value: consulente.pec, icon: Mail },
      { label: 'Telefono', value: consulente.telefono, icon: Phone },
      { label: 'Sito Web', value: consulente.sito_web, icon: Globe },
      { label: 'Indirizzo', value: [consulente.indirizzo_fatturazione, consulente.cap_fatturazione, consulente.citta_fatturazione, consulente.provincia_fatturazione ? `(${consulente.provincia_fatturazione})` : ''].filter(Boolean).join(', ') || null, icon: MapPin },
    ]

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fields.map((field) => (
            <div key={field.label} className="bg-gray-50 rounded-lg p-3">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{field.label}</label>
              <div className="text-sm text-gray-900 mt-0.5 flex items-center space-x-1.5">
                {field.icon && <field.icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                <span>{field.value || '-'}</span>
              </div>
            </div>
          ))}
        </div>

        {consulente.note && (
          <div className="bg-gray-50 rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Note</label>
            <p className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">{consulente.note}</p>
          </div>
        )}

        {onNavigate && (
          <div className="pt-2">
            <button
              onClick={() => onNavigate('clienti', { openClientId: consulenteId })}
              className="btn-primary text-xs flex items-center space-x-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Apri Scheda Completa</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderClientiSegnalati = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center">
          <Users className="w-4 h-4 mr-2 text-purple-600" />
          Clienti Segnalati
          <span className="ml-2 bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">
            {clientiSegnalati.length}
          </span>
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => { resetAssociaForm(); setShowAssociaModal(true) }}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 text-xs"
          >
            <Link className="w-3.5 h-3.5" />
            <span>Associa Esistente</span>
          </button>
          <button
            onClick={() => { resetNuovoForm(); setShowNuovoClienteModal(true) }}
            className="btn-primary text-xs flex items-center space-x-1.5 px-3 py-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuovo Cliente</span>
          </button>
        </div>
      </div>

      {/* Table */}
      {loadingClienti ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
        </div>
      ) : clientiSegnalati.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Nessun cliente segnalato</p>
          <p className="text-xs text-gray-400 mt-1">Usa i pulsanti sopra per associare o creare clienti</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Denominazione</th>
                <th className="px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Tipo</th>
                <th className="px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Data Segn.</th>
                <th className="px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Città</th>
                <th className="px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Categoria</th>
                <th className="px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-medium text-center">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {clientiSegnalati.map((rel) => {
                const tipoConfig = TIPO_SEGNALAZIONE_CONFIG[rel.tipo_segnalazione] || { label: rel.tipo_segnalazione, color: 'bg-gray-100 text-gray-700' }
                return (
                  <tr key={rel.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-2">
                      <button
                        onClick={() => onNavigate?.('clienti', { openClientId: rel.cliente_id })}
                        className="text-sm font-medium text-primary-600 hover:underline"
                      >
                        {rel.cliente?.denominazione || '-'}
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${tipoConfig.color}`}>
                        {tipoConfig.label}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-500">{formatDate(rel.data_segnalazione)}</td>
                    <td className="px-2 py-2 text-sm text-gray-500">{rel.cliente?.citta_fatturazione || '-'}</td>
                    <td className="px-2 py-2 text-sm text-gray-500">{rel.cliente?.categoria_evolvi || '-'}</td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => handleRemoveRelazione(rel.id)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Rimuovi associazione"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const renderRiepilogo = () => {
    if (loadingStats) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-3">Caricamento statistiche...</p>
        </div>
      )
    }

    if (!stats) {
      return (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Nessun dato disponibile</p>
        </div>
      )
    }

    const KpiCard = ({ label, value, subtitle, icon: Icon, color = 'text-gray-900' }: {
      label: string; value: string | number; subtitle?: string; icon?: any; color?: string
    }) => (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{label}</div>
          {Icon && <Icon className="w-4 h-4 text-gray-400" />}
        </div>
        <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
      </div>
    )

    return (
      <div className="space-y-6">
        {/* Overview */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Panoramica</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Clienti Segnalati" value={stats.clienti_segnalati} icon={Users} color="text-purple-700" />
            <KpiCard label="Per Bandi" value={stats.per_tipo_segnalazione.bandi || 0} color="text-blue-700" />
            <KpiCard label="Per Spot" value={stats.per_tipo_segnalazione.spot || 0} color="text-yellow-700" />
            <KpiCard label="Per Formazione" value={stats.per_tipo_segnalazione.formazione || 0} color="text-green-700" />
          </div>
        </div>

        {/* Bandi & Progetti */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />Bandi & Progetti
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard label="Progetti Totali" value={stats.progetti.totale} icon={FolderOpen} />
            <KpiCard label="Contributo Ammesso" value={formatEuro(stats.progetti.contributo_ammesso)} icon={Euro} color="text-blue-700" />
            <KpiCard label="Contributo Ottenuto" value={formatEuro(stats.progetti.contributo_ottenuto)} icon={Euro} color="text-green-700" />
          </div>
        </div>

        {/* Contratti & Fatturazione */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
            <FileText className="w-3.5 h-3.5 mr-1.5" />Contratti & Fatturazione
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Contratti Evolvi" value={stats.contratti_evolvi.totale} subtitle={`${stats.contratti_evolvi.attivi} attivi`} icon={FileText} />
            <KpiCard label="Importo Annuale" value={formatEuro(stats.contratti_evolvi.importo_annuale_totale)} icon={Euro} />
            <KpiCard label="Fatturato Totale" value={formatEuro(stats.fatture.importo_totale)} icon={Euro} color="text-blue-700" />
            <KpiCard
              label="Fatture Pagate"
              value={`${stats.fatture.pagate}/${stats.fatture.totale}`}
              subtitle={stats.fatture.scadute > 0 ? `${stats.fatture.scadute} scadute` : undefined}
              color={stats.fatture.scadute > 0 ? 'text-red-600' : 'text-green-700'}
            />
          </div>
        </div>

        {/* Formazione */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
            <GraduationCap className="w-3.5 h-3.5 mr-1.5" />Formazione
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Piani Formativi" value={stats.formazione.piani_totale} icon={GraduationCap} />
            <KpiCard label="Importo Approvato" value={formatEuro(stats.formazione.importo_approvato)} icon={Euro} color="text-green-700" />
            <KpiCard label="Ore Erogate" value={stats.formazione.ore_erogate} subtitle={`${stats.corsi.totale} corsi`} />
            <KpiCard label="Partecipanti" value={stats.formazione.partecipanti_previsti + stats.corsi.partecipanti_totale} icon={Users} />
          </div>
        </div>

        {/* Adesioni FPI */}
        {stats.adesioni_fpi.totale > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Adesioni FPI</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KpiCard label="Adesioni Totali" value={stats.adesioni_fpi.totale} subtitle={`${stats.adesioni_fpi.attive} attive`} />
              <KpiCard label="Dipendenti Aderenti" value={stats.adesioni_fpi.dipendenti_aderenti} icon={Users} />
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderTabContent = () => {
    switch (currentTab) {
      case 'anagrafica': return renderAnagrafica()
      case 'clienti_segnalati': return renderClientiSegnalati()
      case 'riepilogo': return renderRiepilogo()
      default: return null
    }
  }

  // ─── Render ─────────────────────────────────────────────

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-hard max-w-6xl w-full h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="gradient-primary text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Briefcase className="w-4 h-4" />
            <h2 className="text-sm font-semibold">{consulente?.denominazione || 'Caricamento...'}</h2>
            <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full">Consulente</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
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
                  className={`py-2 px-1.5 border-b-2 font-medium text-xs flex items-center space-x-1.5 transition-colors flex-shrink-0 ${
                    currentTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.id === 'clienti_segnalati' && clientiSegnalati.length > 0 && (
                    <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                      {clientiSegnalati.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            renderTabContent()
          )}
        </div>
      </div>

      {/* ─── Sub-modal: Associa Cliente Esistente ──────── */}
      {showAssociaModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={e => e.stopPropagation()}>
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-purple-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Link className="w-4 h-4" />
                <h3 className="text-sm font-semibold">Associa Cliente Esistente</h3>
              </div>
              <button onClick={() => setShowAssociaModal(false)} className="p-1 hover:bg-white/20 rounded transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Ricerca */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Cerca Cliente</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setSelectedCliente(null) }}
                    placeholder="Digita almeno 2 caratteri..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {searchLoading && <p className="text-xs text-gray-400 mt-1">Ricerca...</p>}
                {searchResults.length > 0 && !selectedCliente && (
                  <div className="mt-1 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                    {searchResults.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedCliente(c); setSearchTerm(c.denominazione); setSearchResults([]) }}
                        className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium">{c.denominazione}</div>
                        <div className="text-xs text-gray-500">{c.partita_iva || '-'} · {c.citta_fatturazione || '-'}</div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedCliente && (
                  <div className="mt-1 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-purple-800">{selectedCliente.denominazione}</span>
                    <button onClick={() => { setSelectedCliente(null); setSearchTerm('') }} className="text-purple-400 hover:text-purple-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Tipo segnalazione (multi-select) */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Tipo Segnalazione</label>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(TIPO_SEGNALAZIONE_CONFIG).map(([value, config]) => (
                    <label key={value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tipiSegnalazione.includes(value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTipiSegnalazione(prev => [...prev, value])
                          } else {
                            setTipiSegnalazione(prev => prev.filter(t => t !== value))
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${config.color}`}>
                        {config.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Data segnalazione */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Data Segnalazione</label>
                <input
                  type="date"
                  value={dataSegnalazione}
                  onChange={(e) => setDataSegnalazione(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Note (opzionale)</label>
                <textarea
                  value={noteSegnalazione}
                  onChange={(e) => setNoteSegnalazione(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {associaError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-sm text-red-700">{associaError}</div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowAssociaModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  disabled={associaLoading}
                >
                  Annulla
                </button>
                <button
                  onClick={handleAssociaCliente}
                  className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
                  disabled={!selectedCliente || tipiSegnalazione.length === 0 || associaLoading}
                >
                  {associaLoading ? 'Associazione...' : 'Associa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Sub-modal: Nuovo Cliente ──────────────────── */}
      {showNuovoClienteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={e => e.stopPropagation()}>
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-purple-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <h3 className="text-sm font-semibold">Nuovo Cliente da Segnalazione</h3>
              </div>
              <button onClick={() => setShowNuovoClienteModal(false)} className="p-1 hover:bg-white/20 rounded transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-700 block mb-1">Denominazione *</label>
                  <input
                    type="text"
                    value={nuovoCliente.denominazione}
                    onChange={(e) => setNuovoCliente(prev => ({ ...prev, denominazione: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ragione sociale"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Partita IVA</label>
                  <input
                    type="text"
                    value={nuovoCliente.partita_iva}
                    onChange={(e) => setNuovoCliente(prev => ({ ...prev, partita_iva: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={nuovoCliente.email}
                    onChange={(e) => setNuovoCliente(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Telefono</label>
                  <input
                    type="tel"
                    value={nuovoCliente.telefono}
                    onChange={(e) => setNuovoCliente(prev => ({ ...prev, telefono: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Città</label>
                  <input
                    type="text"
                    value={nuovoCliente.citta_fatturazione}
                    onChange={(e) => setNuovoCliente(prev => ({ ...prev, citta_fatturazione: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Provincia</label>
                  <input
                    type="text"
                    value={nuovoCliente.provincia_fatturazione}
                    onChange={(e) => setNuovoCliente(prev => ({ ...prev, provincia_fatturazione: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    maxLength={2}
                    placeholder="es. MI"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1.5">Tipo Segnalazione</label>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(TIPO_SEGNALAZIONE_CONFIG).map(([value, config]) => (
                      <label key={value} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={nuovoTipiSegnalazione.includes(value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNuovoTipiSegnalazione(prev => [...prev, value])
                            } else {
                              setNuovoTipiSegnalazione(prev => prev.filter(t => t !== value))
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${config.color}`}>
                          {config.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Data Segnalazione</label>
                  <input
                    type="date"
                    value={nuovoDataSegnalazione}
                    onChange={(e) => setNuovoDataSegnalazione(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {nuovoError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-sm text-red-700">{nuovoError}</div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowNuovoClienteModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  disabled={nuovoLoading}
                >
                  Annulla
                </button>
                <button
                  onClick={handleNuovoCliente}
                  className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
                  disabled={!nuovoCliente.denominazione.trim() || nuovoTipiSegnalazione.length === 0 || nuovoLoading}
                >
                  {nuovoLoading ? 'Creazione...' : 'Crea e Associa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
