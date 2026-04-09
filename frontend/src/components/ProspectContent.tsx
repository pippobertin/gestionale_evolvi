'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Filter,
  Users,
  UserPlus,
  ClipboardCheck,
  ArrowRightCircle,
  Star
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Prospect, ProspectStato, PROSPECT_STATI, FONTI_ACQUISIZIONE } from '@/types/prospect'
import ProspectForm from './ProspectForm'
import ProspectDettaglio from './ProspectDettaglio'

export default function ProspectContent({ onNavigate }: { onNavigate?: (page: string, params?: any) => void }) {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStato, setFiltroStato] = useState<string>('tutti')
  const [filtroFonte, setFiltroFonte] = useState<string>('all')

  // Modal states
  const [showForm, setShowForm] = useState(false)
  const [showDettaglio, setShowDettaglio] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState<Prospect | undefined>(undefined)
  const [selectedProspectId, setSelectedProspectId] = useState<string>('')

  useEffect(() => {
    fetchProspects()
  }, [])

  const fetchProspects = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('scadenze_bandi_prospect')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProspects(data || [])
    } catch (error) {
      console.error('Errore nel caricamento prospect:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handlers modali
  const handleNuovoProspect = () => {
    setSelectedProspect(undefined)
    setShowForm(true)
  }

  const handleDettaglioProspect = (prospectId: string) => {
    setSelectedProspectId(prospectId)
    setShowDettaglio(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setSelectedProspect(undefined)
  }

  const handleCloseDettaglio = () => {
    setShowDettaglio(false)
    setSelectedProspectId('')
  }

  const handleSaveProspect = () => {
    fetchProspects()
  }

  const handleEditFromDettaglio = (prospect: Prospect) => {
    setShowDettaglio(false)
    setSelectedProspect(prospect)
    setShowForm(true)
  }

  // Filtri
  const filteredProspects = prospects.filter(prospect => {
    const matchSearch = prospect.denominazione?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       prospect.partita_iva?.includes(searchTerm) ||
                       prospect.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       prospect.numero_prospect?.includes(searchTerm)

    const matchStato = filtroStato === 'tutti' || prospect.stato === filtroStato
    const matchFonte = filtroFonte === 'all' || prospect.fonte_acquisizione === filtroFonte

    return matchSearch && matchStato && matchFonte
  })

  // Stats
  const stats = {
    totale: prospects.length,
    nuovi: prospects.filter(p => p.stato === 'nuovo').length,
    in_valutazione: prospects.filter(p => p.stato === 'in_valutazione').length,
    approvati: prospects.filter(p => p.stato === 'approvato').length,
    convertiti: prospects.filter(p => p.stato === 'convertito').length
  }

  const getStatoBadge = (stato: ProspectStato) => {
    const config = PROSPECT_STATI[stato]
    if (!config) return 'bg-gray-100 text-gray-700'
    return `${config.bgColor} ${config.color}`
  }

  const getStatoLabel = (stato: ProspectStato) => {
    const config = PROSPECT_STATI[stato]
    return config?.label || stato
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-sm font-semibold text-gray-900">Gestione Prospect</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleNuovoProspect}
            className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Nuovo Prospect
          </button>
        </div>
      </div>

      {/* Statistiche Rapide */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl border border-blue-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white/90 drop-shadow-sm">Totale</p>
              <p className="text-lg font-black text-white drop-shadow">{stats.totale}</p>
            </div>
            <Users className="w-6 h-6 text-white drop-shadow" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-yellow-500 p-4 rounded-xl border border-amber-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white/90 drop-shadow-sm">Nuovi</p>
              <p className="text-lg font-black text-white drop-shadow">{stats.nuovi}</p>
            </div>
            <UserPlus className="w-6 h-6 text-white drop-shadow" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500 to-teal-500 p-4 rounded-xl border border-cyan-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white/90 drop-shadow-sm">In Valutazione</p>
              <p className="text-lg font-black text-white drop-shadow">{stats.in_valutazione}</p>
            </div>
            <ClipboardCheck className="w-6 h-6 text-white drop-shadow" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-500 p-4 rounded-xl border border-emerald-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white/90 drop-shadow-sm">Convertiti</p>
              <p className="text-lg font-black text-white drop-shadow">{stats.convertiti}</p>
            </div>
            <ArrowRightCircle className="w-6 h-6 text-white drop-shadow" />
          </div>
        </div>
      </div>

      {/* Filtri e Ricerca */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cerca per denominazione, P.IVA, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-80"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filtroFonte}
              onChange={(e) => setFiltroFonte(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">Tutte le fonti</option>
              {FONTI_ACQUISIZIONE.map((fonte) => (
                <option key={fonte.value} value={fonte.value}>{fonte.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stato Pill Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltroStato('tutti')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filtroStato === 'tutti'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tutti ({prospects.length})
        </button>
        {(Object.keys(PROSPECT_STATI) as ProspectStato[]).map((stato) => {
          const count = prospects.filter(p => p.stato === stato).length
          const config = PROSPECT_STATI[stato]
          return (
            <button
              key={stato}
              onClick={() => setFiltroStato(stato)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filtroStato === stato
                  ? `${config.bgColor} ${config.color} ring-2 ring-offset-1 ring-current`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {config.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Lista Prospect */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prospect
                </th>
                <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contatti
                </th>
                <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fonte
                </th>
                <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assegnato a
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProspects.map((prospect) => (
                <tr
                  key={prospect.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleDettaglioProspect(prospect.id)}
                >
                  <td className="px-1 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{prospect.denominazione}</div>
                      {prospect.numero_prospect && (
                        <div className="text-sm text-gray-500">#{prospect.numero_prospect}</div>
                      )}
                      {prospect.citta && (
                        <div className="text-sm text-gray-500">
                          {prospect.citta}{prospect.provincia ? ` (${prospect.provincia})` : ''}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-1 py-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatoBadge(prospect.stato)}`}>
                      {getStatoLabel(prospect.stato)}
                    </span>
                  </td>
                  <td className="px-1 py-2">
                    <div className="text-sm">
                      {prospect.email && (
                        <div className="text-blue-600">{prospect.email}</div>
                      )}
                      {prospect.telefono && (
                        <div className="text-gray-500">{prospect.telefono}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-1 py-2">
                    <div className="text-sm text-gray-600">
                      {FONTI_ACQUISIZIONE.find(f => f.value === prospect.fonte_acquisizione)?.label || prospect.fonte_acquisizione || '-'}
                    </div>
                  </td>
                  <td className="px-1 py-2">
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm font-medium text-gray-700">
                        {prospect.profiling_score ?? '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-1 py-2">
                    <div className="text-sm text-gray-600">
                      {prospect.assegnato_a || '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProspects.length === 0 && (
          <div className="text-center py-12">
            <UserPlus className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun prospect trovato</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || filtroStato !== 'tutti' || filtroFonte !== 'all'
                ? 'Prova a modificare i filtri di ricerca.'
                : 'Non ci sono prospect. Inizia aggiungendone uno.'}
            </p>
          </div>
        )}
      </div>

      {/* Modali */}
      <ProspectForm
        prospect={selectedProspect}
        isOpen={showForm}
        onClose={handleCloseForm}
        onSave={handleSaveProspect}
      />

      <ProspectDettaglio
        prospectId={selectedProspectId}
        isOpen={showDettaglio}
        onClose={handleCloseDettaglio}
        onEdit={handleEditFromDettaglio}
        onRefresh={fetchProspects}
      />
    </div>
  )
}
