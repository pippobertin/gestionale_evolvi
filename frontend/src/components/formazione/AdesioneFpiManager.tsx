'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Award, Plus, RefreshCw, Edit, Trash2, Loader2, X, Search, Check, ChevronRight } from 'lucide-react'
import { useFondi } from '@/hooks/useFondi'
import { useCcnl } from '@/hooks/useCcnl'

interface Ccnl {
  id: string
  codice: string
  denominazione: string
  settore: string
}

interface SiglaSindacale {
  id: string
  sigla: string
  nome_completo: string
  confederazione: string
}

interface Adesione {
  id: string
  cliente_id: string
  fondo_id: string
  codice_adesione: string | null
  data_adesione: string | null
  data_cessazione: string | null
  ccnl_applicato: string | null
  ccnl_id: string | null
  sigle_sindacali_ids: string[] | null
  matricole_inps_associate: string[] | null
  dipendenti_aderenti: number | null
  stato: 'ATTIVA' | 'CESSATA' | 'SOSPESA'
  note: string | null
  fondo: { id: string; codice: string; nome: string; sigla: string } | null
  ccnl: Ccnl | null
}

interface AdesioneFpiManagerProps {
  clienteId: string
  onAdesioneChange?: () => void
}

const STATO_COLORS: Record<string, string> = {
  ATTIVA: 'bg-green-100 text-green-700',
  CESSATA: 'bg-gray-100 text-gray-600',
  SOSPESA: 'bg-amber-100 text-amber-700',
}

// Ordered sectors for the guided tool
const SETTORI_ORDER = [
  'Commercio',
  'Meccanici',
  'Edilizia',
  'Trasporti',
  'Alimentaristi - Agroindustriale',
  'Aziende di Servizi',
  'Enti e Istituzioni Private',
  'Chimici',
  'Tessili',
  'Agricoltura',
  'Poligrafici e Spettacolo',
  'Credito Assicurazioni',
  'Amministrazione Pubblica',
  'Altri Vari',
]

export default function AdesioneFpiManager({ clienteId, onAdesioneChange }: AdesioneFpiManagerProps) {
  const { fondi } = useFondi()
  const { ccnlList } = useCcnl()
  const [adesioni, setAdesioni] = useState<Adesione[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Adesione | null>(null)
  const [saving, setSaving] = useState(false)

  // Sigle sindacali state
  const [sigleDisponibili, setSigleDisponibili] = useState<SiglaSindacale[]>([])
  const [loadingSigle, setLoadingSigle] = useState(false)

  // CCNL guided selection state
  const [showCcnlPicker, setShowCcnlPicker] = useState(false)
  const [selectedSettore, setSelectedSettore] = useState<string | null>(null)
  const [ccnlSearch, setCcnlSearch] = useState('')
  const ccnlPickerRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    fondo_id: '',
    codice_adesione: '',
    data_adesione: '',
    data_cessazione: '',
    ccnl_id: '',
    ccnl_applicato: '',
    sigle_sindacali_ids: [] as string[],
    matricole_inps_associate: '',
    dipendenti_aderenti: '',
    stato: 'ATTIVA',
    note: '',
  })

  useEffect(() => {
    loadAdesioni()
  }, [clienteId])

  // Load sigle when ccnl_id changes
  const loadSigle = useCallback(async (ccnlId: string) => {
    if (!ccnlId) {
      setSigleDisponibili([])
      return
    }
    setLoadingSigle(true)
    try {
      const res = await fetch(`/api/formazione/sigle-sindacali?ccnl_id=${ccnlId}`)
      const json = await res.json()
      if (json.success) setSigleDisponibili(json.data)
    } catch (err) {
      console.error('[AdesioneFpiManager] Error loading sigle:', err)
    } finally {
      setLoadingSigle(false)
    }
  }, [])

  useEffect(() => {
    if (form.ccnl_id) {
      loadSigle(form.ccnl_id)
    } else {
      setSigleDisponibili([])
    }
  }, [form.ccnl_id, loadSigle])

  // Close CCNL picker on outside click
  useEffect(() => {
    if (!showCcnlPicker) return
    const handler = (e: MouseEvent) => {
      if (ccnlPickerRef.current && !ccnlPickerRef.current.contains(e.target as Node)) {
        setShowCcnlPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCcnlPicker])

  const loadAdesioni = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/clienti/${clienteId}/formazione/adesioni`)
      const json = await res.json()
      if (json.success) setAdesioni(json.data)
    } catch (err) {
      console.error('[AdesioneFpiManager] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const openNew = () => {
    setEditing(null)
    setForm({
      fondo_id: '',
      codice_adesione: '',
      data_adesione: '',
      data_cessazione: '',
      ccnl_id: '',
      ccnl_applicato: '',
      sigle_sindacali_ids: [],
      matricole_inps_associate: '',
      dipendenti_aderenti: '',
      stato: 'ATTIVA',
      note: '',
    })
    setCcnlSearch('')
    setSelectedSettore(null)
    setSigleDisponibili([])
    setShowCcnlPicker(false)
    setShowModal(true)
  }

  const openEdit = (a: Adesione) => {
    setEditing(a)
    setForm({
      fondo_id: a.fondo_id,
      codice_adesione: a.codice_adesione || '',
      data_adesione: a.data_adesione || '',
      data_cessazione: a.data_cessazione || '',
      ccnl_id: a.ccnl_id || '',
      ccnl_applicato: a.ccnl_applicato || '',
      sigle_sindacali_ids: a.sigle_sindacali_ids || [],
      matricole_inps_associate: (a.matricole_inps_associate || []).join(', '),
      dipendenti_aderenti: a.dipendenti_aderenti?.toString() || '',
      stato: a.stato,
      note: a.note || '',
    })
    setCcnlSearch('')
    setSelectedSettore(a.ccnl?.settore || null)
    setShowCcnlPicker(false)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.fondo_id) return
    setSaving(true)
    try {
      const selectedCcnl = ccnlList.find(c => c.id === form.ccnl_id)
      const payload = {
        fondo_id: form.fondo_id,
        codice_adesione: form.codice_adesione || null,
        data_adesione: form.data_adesione || null,
        data_cessazione: form.data_cessazione || null,
        ccnl_id: form.ccnl_id || null,
        ccnl_applicato: selectedCcnl ? selectedCcnl.denominazione : (form.ccnl_applicato || null),
        sigle_sindacali_ids: form.sigle_sindacali_ids.length > 0 ? form.sigle_sindacali_ids : [],
        matricole_inps_associate: form.matricole_inps_associate
          ? form.matricole_inps_associate.split(',').map(s => s.trim()).filter(Boolean)
          : null,
        dipendenti_aderenti: form.dipendenti_aderenti ? parseInt(form.dipendenti_aderenti) : null,
        stato: form.stato,
        note: form.note || null,
      }

      const url = editing
        ? `/api/clienti/${clienteId}/formazione/adesioni/${editing.id}`
        : `/api/clienti/${clienteId}/formazione/adesioni`

      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (json.success) {
        setShowModal(false)
        loadAdesioni()
        onAdesioneChange?.()
      }
    } catch (err) {
      console.error('[AdesioneFpiManager] Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questa adesione?')) return
    try {
      const res = await fetch(`/api/clienti/${clienteId}/formazione/adesioni/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        loadAdesioni()
        onAdesioneChange?.()
      }
    } catch (err) {
      console.error('[AdesioneFpiManager] Delete error:', err)
    }
  }

  const selectCcnl = (c: Ccnl) => {
    setForm(prev => ({
      ...prev,
      ccnl_id: c.id,
      ccnl_applicato: c.denominazione,
      sigle_sindacali_ids: [],
    }))
    setShowCcnlPicker(false)
    setCcnlSearch('')
  }

  const clearCcnl = () => {
    setForm(prev => ({
      ...prev,
      ccnl_id: '',
      ccnl_applicato: '',
      sigle_sindacali_ids: [],
    }))
    setSelectedSettore(null)
    setSigleDisponibili([])
  }

  const toggleSigla = (siglaId: string) => {
    setForm(prev => ({
      ...prev,
      sigle_sindacali_ids: prev.sigle_sindacali_ids.includes(siglaId)
        ? prev.sigle_sindacali_ids.filter(id => id !== siglaId)
        : [...prev.sigle_sindacali_ids, siglaId],
    }))
  }

  const selectAllSigle = () => {
    setForm(prev => ({
      ...prev,
      sigle_sindacali_ids: sigleDisponibili.map(s => s.id),
    }))
  }

  const deselectAllSigle = () => {
    setForm(prev => ({ ...prev, sigle_sindacali_ids: [] }))
  }

  // Compute CCNL counts per sector
  const ccnlPerSettore = ccnlList.reduce((acc, c) => {
    acc[c.settore] = (acc[c.settore] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Available sectors (only those with CCNL data)
  const availableSettori = SETTORI_ORDER.filter(s => ccnlPerSettore[s])

  // Filter logic: search OR settore filter
  const isSearching = ccnlSearch.length >= 2
  const filteredCcnl = isSearching
    ? ccnlList.filter(c =>
        c.denominazione.toLowerCase().includes(ccnlSearch.toLowerCase()) ||
        c.codice.toLowerCase().includes(ccnlSearch.toLowerCase())
      ).slice(0, 50) // cap results for performance
    : selectedSettore
      ? ccnlList.filter(c => c.settore === selectedSettore)
      : []

  // Group filtered results by sector (for search mode)
  const filteredBySector = filteredCcnl.reduce((acc, c) => {
    if (!acc[c.settore]) acc[c.settore] = []
    acc[c.settore].push(c)
    return acc
  }, {} as Record<string, Ccnl[]>)

  // Group sigle by confederazione
  const sigleByCon = sigleDisponibili.reduce((acc, s) => {
    const key = s.confederazione || 'Altro'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {} as Record<string, SiglaSindacale[]>)

  // Confederazione display order
  const confOrder = ['Datoriale', 'CGIL', 'CISL', 'UIL', 'UGL', 'CONFSAL', 'CISAL', 'Dirigenti', '']
  const sortedConf = Object.keys(sigleByCon).sort((a, b) => {
    const ia = confOrder.indexOf(a)
    const ib = confOrder.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  // Get selected CCNL label
  const selectedCcnl = form.ccnl_id ? ccnlList.find(c => c.id === form.ccnl_id) : null

  // Get sigle count for display in table
  const getSigleCount = (a: Adesione): string => {
    if (!a.sigle_sindacali_ids || a.sigle_sindacali_ids.length === 0) return '-'
    return `${a.sigle_sindacali_ids.length} firmatari`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center">
          <Award className="w-4 h-4 mr-2" />
          Adesioni ai fondi interprofessionali
        </h4>
        <div className="flex items-center space-x-2">
          <button onClick={loadAdesioni} className="btn-secondary text-sm py-1.5 px-2" title="Aggiorna">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openNew} className="btn-primary text-sm py-1.5 px-3">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Nuova adesione
          </button>
        </div>
      </div>

      {/* Empty state */}
      {adesioni.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nessuna adesione registrata</p>
          <p className="text-gray-400 text-sm mt-1">Registra la prima adesione a un fondo interprofessionale</p>
          <button onClick={openNew} className="btn-primary text-sm py-2 px-4 mt-4">
            <Plus className="w-4 h-4 mr-1" />
            Registra la prima adesione
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Fondo</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Codice</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Data adesione</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">CCNL</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Firmatari</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Dipendenti</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Stato</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {adesioni.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm">
                    <span className="font-medium text-gray-900">{a.fondo?.sigla || '-'}</span>
                    <br />
                    <span className="text-xs text-gray-500">{a.fondo?.nome || ''}</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{a.codice_adesione || '-'}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">
                    {a.data_adesione ? new Date(a.data_adesione).toLocaleDateString('it-IT') : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-700 max-w-[200px] truncate" title={a.ccnl?.denominazione || a.ccnl_applicato || ''}>
                    {a.ccnl?.denominazione || a.ccnl_applicato || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{getSigleCount(a)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{a.dipendenti_aderenti ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATO_COLORS[a.stato] || ''}`}>
                      {a.stato}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button onClick={() => openEdit(a)} className="p-1 hover:bg-gray-100 rounded" title="Modifica">
                        <Edit className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                      <button onClick={() => handleDelete(a.id)} className="p-1 hover:bg-red-50 rounded" title="Elimina">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                {editing ? 'Modifica adesione' : 'Nuova adesione FPI'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {/* Fondo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fondo *</label>
                <select
                  value={form.fondo_id}
                  onChange={e => setForm({ ...form, fondo_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Seleziona fondo...</option>
                  {fondi.map(f => (
                    <option key={f.id} value={f.id}>{f.sigla} - {f.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Codice adesione</label>
                  <input
                    type="text"
                    value={form.codice_adesione}
                    onChange={e => setForm({ ...form, codice_adesione: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dipendenti aderenti</label>
                  <input
                    type="number"
                    value={form.dipendenti_aderenti}
                    onChange={e => setForm({ ...form, dipendenti_aderenti: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>

              {/* ═══ CCNL GUIDED PICKER ═══ */}
              <div ref={ccnlPickerRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">CCNL applicato</label>

                {/* Selected CCNL display */}
                {selectedCcnl ? (
                  <div className="flex items-center justify-between px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-teal-800">{selectedCcnl.denominazione}</span>
                      <span className="text-xs text-teal-600 ml-2">({selectedCcnl.settore})</span>
                    </div>
                    <button type="button" onClick={clearCcnl} className="p-0.5 hover:bg-teal-100 rounded">
                      <X className="w-3.5 h-3.5 text-teal-600" />
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Search bar */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={ccnlSearch}
                        onChange={e => {
                          setCcnlSearch(e.target.value)
                          if (e.target.value.length >= 2) {
                            setSelectedSettore(null)
                            setShowCcnlPicker(true)
                          }
                        }}
                        onFocus={() => setShowCcnlPicker(true)}
                        placeholder="Cerca CCNL per nome... oppure scegli il settore sotto"
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>

                    {showCcnlPicker && (
                      <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-sm">
                        {/* Settore tabs */}
                        {!isSearching && (
                          <div className="p-2 border-b border-gray-100">
                            <div className="text-xs font-medium text-gray-500 mb-1.5 px-1">
                              1. Scegli il settore
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {availableSettori.map(s => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => setSelectedSettore(selectedSettore === s ? null : s)}
                                  className={`px-2 py-1 rounded text-xs transition-colors ${
                                    selectedSettore === s
                                      ? 'bg-teal-100 text-teal-800 font-medium'
                                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                  }`}
                                >
                                  {s}
                                  <span className="ml-1 text-gray-400">({ccnlPerSettore[s]})</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* CCNL list */}
                        {(isSearching || selectedSettore) && (
                          <div className="max-h-52 overflow-y-auto">
                            <div className="text-xs font-medium text-gray-500 px-3 pt-2 pb-1">
                              {isSearching
                                ? `${filteredCcnl.length} risultati per "${ccnlSearch}"${filteredCcnl.length === 50 ? ' (primi 50)' : ''}`
                                : `2. Seleziona il CCNL (${filteredCcnl.length} in ${selectedSettore})`}
                            </div>
                            {isSearching ? (
                              // Search results grouped by sector
                              Object.entries(filteredBySector).map(([settore, list]) => (
                                <div key={settore}>
                                  <div className="px-3 py-1 text-xs text-gray-400 bg-gray-50 font-medium">
                                    {settore}
                                  </div>
                                  {list.map(c => (
                                    <CcnlOption key={c.id} ccnl={c} selected={form.ccnl_id === c.id} onClick={() => selectCcnl(c)} />
                                  ))}
                                </div>
                              ))
                            ) : (
                              // Filtered by settore
                              filteredCcnl.map(c => (
                                <CcnlOption key={c.id} ccnl={c} selected={form.ccnl_id === c.id} onClick={() => selectCcnl(c)} />
                              ))
                            )}
                            {filteredCcnl.length === 0 && (
                              <div className="px-3 py-4 text-sm text-gray-400 text-center">
                                Nessun CCNL trovato
                              </div>
                            )}
                          </div>
                        )}

                        {/* Hint when nothing selected */}
                        {!isSearching && !selectedSettore && (
                          <div className="px-3 py-4 text-center text-sm text-gray-400">
                            <ChevronRight className="w-4 h-4 inline mr-1" />
                            Seleziona un settore oppure cerca per nome
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ═══ FIRMATARI MULTI-SELECT ═══ */}
              {form.ccnl_id && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Firmatari del CCNL
                    </label>
                    {sigleDisponibili.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <button type="button" onClick={selectAllSigle} className="text-xs text-teal-600 hover:text-teal-800">
                          Seleziona tutti
                        </button>
                        <span className="text-gray-300">|</span>
                        <button type="button" onClick={deselectAllSigle} className="text-xs text-gray-500 hover:text-gray-700">
                          Deseleziona
                        </button>
                      </div>
                    )}
                  </div>
                  {loadingSigle ? (
                    <div className="flex items-center py-3 text-gray-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Caricamento firmatari...
                    </div>
                  ) : sigleDisponibili.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">
                      Nessun firmatario associato a questo CCNL
                    </p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-2 max-h-48 overflow-y-auto space-y-2">
                      {sortedConf.map(conf => (
                        <div key={conf}>
                          {conf && (
                            <div className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
                              {conf}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {sigleByCon[conf].map(s => {
                              const selected = form.sigle_sindacali_ids.includes(s.id)
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => toggleSigla(s.id)}
                                  title={s.nome_completo !== s.sigla ? s.nome_completo : undefined}
                                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                    selected
                                      ? 'bg-teal-50 border-teal-300 text-teal-700'
                                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                  }`}
                                >
                                  {selected && <Check className="w-3 h-3 mr-1" />}
                                  {s.sigla}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                      {form.sigle_sindacali_ids.length > 0 && (
                        <div className="text-xs text-gray-500 pt-1 border-t border-gray-100">
                          {form.sigle_sindacali_ids.length} di {sigleDisponibili.length} firmatari selezionati
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data adesione</label>
                  <input
                    type="date"
                    value={form.data_adesione}
                    onChange={e => setForm({ ...form, data_adesione: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data cessazione</label>
                  <input
                    type="date"
                    value={form.data_cessazione}
                    onChange={e => setForm({ ...form, data_cessazione: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                  <select
                    value={form.stato}
                    onChange={e => setForm({ ...form, stato: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="ATTIVA">Attiva</option>
                    <option value="SOSPESA">Sospesa</option>
                    <option value="CESSATA">Cessata</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Matricole INPS</label>
                  <input
                    type="text"
                    value={form.matricole_inps_associate}
                    onChange={e => setForm({ ...form, matricole_inps_associate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="es. 1234567890, 0987654321"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="btn-secondary text-sm py-2 px-4">
                Annulla
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.fondo_id}
                className="btn-primary text-sm py-2 px-4"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Salva modifiche' : 'Crea adesione'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Sub-component for CCNL list items
function CcnlOption({ ccnl, selected, onClick }: { ccnl: Ccnl; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm hover:bg-teal-50 flex items-center justify-between ${
        selected ? 'bg-teal-50 text-teal-700' : 'text-gray-700'
      }`}
    >
      <span className="truncate pr-2">{ccnl.denominazione}</span>
      {selected && <Check className="w-4 h-4 text-teal-600 flex-shrink-0" />}
    </button>
  )
}
