'use client'

import React, { useState, useEffect } from 'react'
import {
  Calendar,
  List,
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus,
  Filter,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Tag,
  RefreshCw,
  XCircle
} from 'lucide-react'
import {
  ScadenzaContrattuale,
  TIPI_SCADENZA,
  PRIORITA_SCADENZA
} from '@/types/evolvi-contract'
import ScadenzaContrattualeForm from './ScadenzaContrattualeForm'

type ViewMode = 'lista' | 'calendario'

const STATI_SCADENZA: Record<string, { label: string; color: string; bgColor: string }> = {
  APERTA: { label: 'Aperta', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  IN_CORSO: { label: 'In Corso', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  COMPLETATA: { label: 'Completata', color: 'text-green-700', bgColor: 'bg-green-100' },
  ANNULLATA: { label: 'Annullata', color: 'text-gray-500', bgColor: 'bg-gray-100' }
}

export default function ScadenzeContrattualiContent() {
  const [scadenze, setScadenze] = useState<ScadenzaContrattuale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('lista')

  // Filtri
  const [filtroTipo, setFiltroTipo] = useState<string>('tutti')
  const [filtroStato, setFiltroStato] = useState<string>('tutti')
  const [filtroPriorita, setFiltroPriorita] = useState<string>('tutti')
  const [filtroResponsabile, setFiltroResponsabile] = useState<string>('tutti')
  const [dataFrom, setDataFrom] = useState<string>('')
  const [dataTo, setDataTo] = useState<string>('')

  // Modali
  const [showForm, setShowForm] = useState(false)
  const [scadenzaEdit, setScadenzaEdit] = useState<ScadenzaContrattuale | undefined>(undefined)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [scadenzaDaEliminare, setScadenzaDaEliminare] = useState<ScadenzaContrattuale | null>(null)
  const [showCompletaModal, setShowCompletaModal] = useState(false)
  const [scadenzaDaCompletare, setScadenzaDaCompletare] = useState<ScadenzaContrattuale | null>(null)
  const [noteCompletamento, setNoteCompletamento] = useState('')

  // Stats
  const [stats, setStats] = useState<{
    totale: number; aperte: number; scadute: number; completate: number
  }>({ totale: 0, aperte: 0, scadute: 0, completate: 0 })

  // Calendario
  const [calendarioMese, setCalendarioMese] = useState(new Date())

  useEffect(() => {
    fetchScadenze()
  }, [])

  const fetchScadenze = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/scadenze-contrattuali')
      const result = await res.json()

      if (!result.success) throw new Error(result.error)

      setScadenze(result.data)

      // Calcola stats
      const all = result.data as ScadenzaContrattuale[]
      const today = new Date().toISOString().split('T')[0]
      setStats({
        totale: all.length,
        aperte: all.filter(s => s.stato === 'APERTA' || s.stato === 'IN_CORSO').length,
        scadute: all.filter(s =>
          s.data_scadenza < today &&
          s.stato !== 'COMPLETATA' &&
          s.stato !== 'ANNULLATA'
        ).length,
        completate: all.filter(s => s.stato === 'COMPLETATA').length
      })
    } catch (err: any) {
      console.error('Errore nel caricamento scadenze contrattuali:', err)
      setError('Errore nel caricamento delle scadenze contrattuali')
    } finally {
      setLoading(false)
    }
  }

  // Filtra scadenze
  const scadenzeFiltrate = scadenze.filter(s => {
    if (filtroTipo !== 'tutti' && s.tipo_scadenza !== filtroTipo) return false
    if (filtroStato !== 'tutti' && s.stato !== filtroStato) return false
    if (filtroPriorita !== 'tutti' && s.priorita !== filtroPriorita) return false
    if (filtroResponsabile !== 'tutti' && s.responsabile_email !== filtroResponsabile) return false
    if (dataFrom && s.data_scadenza < dataFrom) return false
    if (dataTo && s.data_scadenza > dataTo) return false
    return true
  })

  // Valori unici per filtri
  const responsabiliUnici = [...new Set(scadenze.map(s => s.responsabile_email).filter(Boolean))].sort() as string[]

  // Calcola giorni rimanenti e colore riga
  const getRowColor = (scadenza: ScadenzaContrattuale) => {
    if (scadenza.stato === 'COMPLETATA' || scadenza.stato === 'ANNULLATA') return ''
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dataScadenza = new Date(scadenza.data_scadenza)
    dataScadenza.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((dataScadenza.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return 'bg-red-50 border-l-4 border-l-red-500'
    if (diffDays < 3) return 'bg-red-50 border-l-4 border-l-red-400'
    if (diffDays < 7) return 'bg-orange-50 border-l-4 border-l-orange-400'
    if (diffDays < 15) return 'bg-yellow-50 border-l-4 border-l-yellow-400'
    return ''
  }

  const getGiorniRimanenti = (dataScadenza: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const data = new Date(dataScadenza)
    data.setHours(0, 0, 0, 0)
    return Math.ceil((data.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  // Handlers
  const handleEdit = (scadenza: ScadenzaContrattuale) => {
    setScadenzaEdit(scadenza)
    setShowForm(true)
  }

  const handleDelete = (scadenza: ScadenzaContrattuale) => {
    setScadenzaDaEliminare(scadenza)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!scadenzaDaEliminare) return
    try {
      const res = await fetch(`/api/scadenze-contrattuali/${scadenzaDaEliminare.id}`, {
        method: 'DELETE'
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      fetchScadenze()
      setShowDeleteModal(false)
      setScadenzaDaEliminare(null)
    } catch (err: any) {
      alert('Errore nell\'eliminazione: ' + err.message)
    }
  }

  const handleCompleta = (scadenza: ScadenzaContrattuale) => {
    setScadenzaDaCompletare(scadenza)
    setNoteCompletamento('')
    setShowCompletaModal(true)
  }

  const confirmCompleta = async () => {
    if (!scadenzaDaCompletare) return
    try {
      const res = await fetch(`/api/scadenze-contrattuali/${scadenzaDaCompletare.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note_completamento: noteCompletamento || undefined
        })
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      fetchScadenze()
      setShowCompletaModal(false)
      setScadenzaDaCompletare(null)
      setNoteCompletamento('')
    } catch (err: any) {
      alert('Errore nel completamento: ' + err.message)
    }
  }

  const handleFormSave = () => {
    fetchScadenze()
    setShowForm(false)
    setScadenzaEdit(undefined)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setScadenzaEdit(undefined)
  }

  // Calendario helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    return day === 0 ? 6 : day - 1 // Lunedi = 0
  }

  const getScadenzeForDay = (day: number) => {
    const year = calendarioMese.getFullYear()
    const month = String(calendarioMese.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const dateStr = `${year}-${month}-${dayStr}`
    return scadenzeFiltrate.filter(s => s.data_scadenza === dateStr)
  }

  const prevMonth = () => {
    setCalendarioMese(new Date(calendarioMese.getFullYear(), calendarioMese.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCalendarioMese(new Date(calendarioMese.getFullYear(), calendarioMese.getMonth() + 1, 1))
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Scadenze Contrattuali</h1>
        <button
          onClick={() => { setScadenzaEdit(undefined); setShowForm(true) }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuova Scadenza
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl border border-blue-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-blue-100">Totale</p>
              <p className="text-2xl font-black text-white">{stats.totale}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500 to-teal-500 p-4 rounded-xl border border-cyan-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-cyan-100">Aperte</p>
              <p className="text-2xl font-black text-white">{stats.aperte}</p>
            </div>
            <Clock className="w-8 h-8 text-cyan-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 p-4 rounded-xl border border-red-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-red-100">Scadute</p>
              <p className="text-2xl font-black text-white">{stats.scadute}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-500 p-4 rounded-xl border border-emerald-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-100">Completate</p>
              <p className="text-2xl font-black text-white">{stats.completate}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-200" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        {/* Toggle Vista */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('lista')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
              viewMode === 'lista'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            <List className="w-4 h-4" />
            Lista
          </button>
          <button
            onClick={() => setViewMode('calendario')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
              viewMode === 'calendario'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Calendario
          </button>
        </div>

        {/* Filtri */}
        <div className="flex gap-3 flex-wrap items-center">
          <Filter className="w-4 h-4 text-gray-500" />

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value="tutti">Tutti i tipi</option>
            {TIPI_SCADENZA.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <select
            value={filtroStato}
            onChange={(e) => setFiltroStato(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value="tutti">Tutti gli stati</option>
            {Object.entries(STATI_SCADENZA).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>

          <select
            value={filtroPriorita}
            onChange={(e) => setFiltroPriorita(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value="tutti">Tutte le priorita</option>
            {Object.entries(PRIORITA_SCADENZA).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>

          <select
            value={filtroResponsabile}
            onChange={(e) => setFiltroResponsabile(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value="tutti">Tutti i responsabili</option>
            {responsabiliUnici.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <input
            type="date"
            value={dataFrom}
            onChange={(e) => setDataFrom(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            placeholder="Da"
          />

          <input
            type="date"
            value={dataTo}
            onChange={(e) => setDataTo(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            placeholder="A"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Vista Lista */}
      {viewMode === 'lista' && (
        <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Titolo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Scadenza
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priorita
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Responsabile
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tags
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scadenzeFiltrate.map((scadenza) => {
                  const giorniRim = getGiorniRimanenti(scadenza.data_scadenza)
                  const tipoLabel = TIPI_SCADENZA.find(t => t.value === scadenza.tipo_scadenza)?.label || scadenza.tipo_scadenza
                  const prioritaInfo = PRIORITA_SCADENZA[scadenza.priorita]
                  const statoInfo = STATI_SCADENZA[scadenza.stato]

                  return (
                    <tr key={scadenza.id} className={`hover:bg-gray-50 ${getRowColor(scadenza)}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {scadenza.titolo}
                        </div>
                        {scadenza.descrizione && (
                          <div className="text-xs text-gray-500 truncate max-w-48">
                            {scadenza.descrizione}
                          </div>
                        )}
                        {scadenza.is_recurring && (
                          <span className="inline-flex items-center gap-1 text-xs text-purple-600 mt-1">
                            <RefreshCw className="w-3 h-3" />
                            Ricorrente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                          {tipoLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(scadenza.data_scadenza)}</div>
                        <div className={`text-xs font-medium ${
                          giorniRim < 0 ? 'text-red-600' :
                          giorniRim < 3 ? 'text-red-600' :
                          giorniRim < 7 ? 'text-orange-600' :
                          giorniRim < 15 ? 'text-yellow-600' :
                          'text-gray-500'
                        }`}>
                          {scadenza.stato === 'COMPLETATA' || scadenza.stato === 'ANNULLATA'
                            ? '-'
                            : giorniRim < 0
                            ? `${Math.abs(giorniRim)} gg fa`
                            : giorniRim === 0
                            ? 'Oggi'
                            : `${giorniRim} gg`
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {prioritaInfo && (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${prioritaInfo.bgColor} ${prioritaInfo.color}`}>
                            {prioritaInfo.label}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {statoInfo && (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statoInfo.bgColor} ${statoInfo.color}`}>
                            {statoInfo.label}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {scadenza.responsabile_email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div>{scadenza.entity_type}</div>
                        {scadenza.entity_id && (
                          <div className="text-xs text-gray-400 truncate max-w-24">{scadenza.entity_id}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {(scadenza.tags || []).slice(0, 2).map((tag, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                              <Tag className="w-2.5 h-2.5" />
                              {tag}
                            </span>
                          ))}
                          {(scadenza.tags || []).length > 2 && (
                            <span className="text-xs text-gray-400">+{scadenza.tags.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {scadenza.stato !== 'COMPLETATA' && scadenza.stato !== 'ANNULLATA' && (
                            <button
                              onClick={() => handleCompleta(scadenza)}
                              className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded"
                              title="Completa"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(scadenza)}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            title="Modifica"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(scadenza)}
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                            title="Elimina"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {scadenzeFiltrate.length === 0 && (
            <div className="text-center py-12">
              <Clock className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna scadenza</h3>
              <p className="mt-1 text-sm text-gray-500">
                Non ci sono scadenze che corrispondono ai filtri selezionati.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Vista Calendario */}
      {viewMode === 'calendario' && (
        <div className="bg-white rounded-lg shadow p-6">
          {/* Header Calendario */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900">
              {calendarioMese.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Giorni settimana */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Griglia giorni */}
          <div className="grid grid-cols-7 gap-1">
            {/* Celle vuote per offset */}
            {Array.from({ length: getFirstDayOfMonth(calendarioMese) }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-24 bg-gray-50 rounded" />
            ))}

            {/* Celle giorni */}
            {Array.from({ length: getDaysInMonth(calendarioMese) }).map((_, idx) => {
              const day = idx + 1
              const scadenzeGiorno = getScadenzeForDay(day)
              const today = new Date()
              const isToday = day === today.getDate() &&
                calendarioMese.getMonth() === today.getMonth() &&
                calendarioMese.getFullYear() === today.getFullYear()

              return (
                <div
                  key={day}
                  className={`h-24 border rounded p-1 overflow-hidden ${
                    isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-600'}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {scadenzeGiorno.slice(0, 3).map(s => {
                      const pInfo = PRIORITA_SCADENZA[s.priorita]
                      return (
                        <div
                          key={s.id}
                          className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer ${
                            s.stato === 'COMPLETATA'
                              ? 'bg-green-100 text-green-700 line-through'
                              : s.stato === 'ANNULLATA'
                              ? 'bg-gray-100 text-gray-500 line-through'
                              : pInfo
                              ? `${pInfo.bgColor} ${pInfo.color}`
                              : 'bg-blue-100 text-blue-700'
                          }`}
                          title={`${s.titolo} - ${s.tipo_scadenza}`}
                          onClick={() => handleEdit(s)}
                        >
                          {s.titolo}
                        </div>
                      )
                    })}
                    {scadenzeGiorno.length > 3 && (
                      <div className="text-xs text-gray-400 px-1">
                        +{scadenzeGiorno.length - 3} altre
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Form Nuova/Modifica Scadenza */}
      {showForm && (
        <ScadenzaContrattualeForm
          isOpen={showForm}
          onClose={handleFormClose}
          onSave={handleFormSave}
          scadenza={scadenzaEdit}
        />
      )}

      {/* Modal Completamento */}
      {showCompletaModal && scadenzaDaCompletare && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Completa Scadenza</h3>
              <button
                onClick={() => setShowCompletaModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Stai per completare:
              </p>
              <p className="font-medium">{scadenzaDaCompletare.titolo}</p>
              <p className="text-sm text-gray-500">
                Scadenza: {formatDate(scadenzaDaCompletare.data_scadenza)}
              </p>
              {scadenzaDaCompletare.is_recurring && (
                <p className="text-sm text-purple-600 mt-1 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Ricorrente - verra generata la prossima occorrenza
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note completamento (opzionale)
              </label>
              <textarea
                value={noteCompletamento}
                onChange={(e) => setNoteCompletamento(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Aggiungi eventuali note sul completamento..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCompletaModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={confirmCompleta}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Completa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Elimina */}
      {showDeleteModal && scadenzaDaEliminare && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-red-600">Elimina Scadenza</h3>
              <button
                onClick={() => { setShowDeleteModal(false); setScadenzaDaEliminare(null) }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">
                Sei sicuro di voler eliminare definitivamente questa scadenza?
              </p>
              <div className="bg-gray-50 p-3 rounded-lg border-l-4 border-red-400">
                <p className="font-medium text-gray-900">{scadenzaDaEliminare.titolo}</p>
                <p className="text-sm text-gray-600">
                  Scadenza: {formatDate(scadenzaDaEliminare.data_scadenza)}
                </p>
              </div>
              <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-800">
                  <strong>Attenzione:</strong> Questa azione non puo essere annullata.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => { setShowDeleteModal(false); setScadenzaDaEliminare(null) }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Elimina Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
