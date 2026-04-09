'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Filter,
  Building2,
  Mail,
  Phone,
  MapPin,
  Users,
  TrendingUp,
  UserCheck,
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
  const [showFilters, setShowFilters] = useState(false)

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
    <div className="space-y-6">
      {/* Header and Search - Sticky Section */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 pb-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Gestione Prospect</h2>
              <p className="text-gray-600">{filteredProspects.length} prospect trovati</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNuovoProspect}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Nuovo Prospect</span>
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="card p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Users className="w-5 h-5 text-gray-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totale}</div>
            <div className="text-sm text-gray-600">Totale</div>
          </div>
          <div className="card p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <UserPlus className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats.nuovi}</div>
            <div className="text-sm text-gray-600">Nuovi</div>
          </div>
          <div className="card p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <ClipboardCheck className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="text-2xl font-bold text-yellow-600">{stats.in_valutazione}</div>
            <div className="text-sm text-gray-600">In Valutazione</div>
          </div>
          <div className="card p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <UserCheck className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.approvati}</div>
            <div className="text-sm text-gray-600">Approvati</div>
          </div>
          <div className="card p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <ArrowRightCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600">{stats.convertiti}</div>
            <div className="text-sm text-gray-600">Convertiti</div>
          </div>
        </div>

        {/* Filtri e Ricerca */}
        <div className="card p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Ricerca */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Cerca per denominazione, P.IVA, email o numero prospect..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>

            {/* Toggle Filtri */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary flex items-center space-x-2"
            >
              <Filter className="w-4 h-4" />
              <span>Filtri</span>
            </button>
          </div>

          {/* Filtri Stato (sempre visibili come pill buttons) */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Stato</label>
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
          </div>

          {/* Filtri Avanzati */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fonte Acquisizione</label>
                <select
                  value={filtroFonte}
                  onChange={(e) => setFiltroFonte(e.target.value)}
                  className="input"
                >
                  <option value="all">Tutte le fonti</option>
                  {FONTI_ACQUISIZIONE.map((fonte) => (
                    <option key={fonte.value} value={fonte.value}>{fonte.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lista Prospect */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Lista Prospect</h3>
        </div>

        {filteredProspects.length === 0 ? (
          <div className="p-12 text-center">
            <UserPlus className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun prospect trovato</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filtroStato !== 'tutti' || filtroFonte !== 'all'
                ? 'Prova a modificare i filtri di ricerca'
                : 'Inizia aggiungendo il primo prospect'
              }
            </p>
            <button onClick={handleNuovoProspect} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Aggiungi Prospect
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Prospect</th>
                  <th className="table-header-cell">Stato</th>
                  <th className="table-header-cell">Contatti</th>
                  <th className="table-header-cell">Fonte</th>
                  <th className="table-header-cell">Score</th>
                  <th className="table-header-cell">Assegnato a</th>
                </tr>
              </thead>
              <tbody>
                {filteredProspects.map((prospect) => (
                  <tr
                    key={prospect.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                    onClick={() => handleDettaglioProspect(prospect.id)}
                  >
                    <td className="px-1 py-2">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{prospect.denominazione}</div>
                          {prospect.numero_prospect && (
                            <div className="text-sm text-gray-600">#{prospect.numero_prospect}</div>
                          )}
                          {prospect.citta && (
                            <div className="text-sm text-gray-500 flex items-center">
                              <MapPin className="w-3 h-3 mr-1" />
                              {prospect.citta}{prospect.provincia ? ` (${prospect.provincia})` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-1 py-2">
                      <span className={`badge ${getStatoBadge(prospect.stato)}`}>
                        {getStatoLabel(prospect.stato)}
                      </span>
                    </td>
                    <td className="px-1 py-2">
                      <div className="space-y-1">
                        {prospect.email && (
                          <div className="text-sm text-blue-600 flex items-center">
                            <Mail className="w-3 h-3 mr-1" />
                            {prospect.email}
                          </div>
                        )}
                        {prospect.telefono && (
                          <div className="text-sm text-gray-600 flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            {prospect.telefono}
                          </div>
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
