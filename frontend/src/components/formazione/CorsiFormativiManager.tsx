'use client'

import { useState, useEffect } from 'react'
import { GraduationCap, Plus, RefreshCw, Edit, Trash2, Loader2, X, Users, ChevronDown, ChevronUp } from 'lucide-react'

interface Corso {
  id: string
  cliente_id: string
  piano_formativo_id: string | null
  titolo: string
  area_tematica: string | null
  modalita: string | null
  ore_durata: number | null
  data_inizio: string | null
  data_fine: string | null
  sede: string | null
  ente_erogatore: string | null
  docente: string | null
  numero_partecipanti: number | null
  stato: string
  attestato_rilasciato: boolean
  costo_totale: number | null
  note: string | null
  piano: { id: string; titolo: string; codice_piano: string | null } | null
}

interface Partecipante {
  id: string
  corso_id: string
  cognome: string
  nome: string
  codice_fiscale: string | null
  qualifica: string | null
  ruolo_sicurezza: string | null
  presente: boolean
  ore_frequentate: number | null
  esito: string
}

interface CorsiFormativiManagerProps {
  clienteId: string
}

const AREE = ['Sicurezza', 'Gestionale', 'Linguistica', 'Digitale', 'Soft Skills', 'Tecnica', 'Altro']
const MODALITA = [
  { value: 'AULA', label: 'Aula' },
  { value: 'ONLINE_SINCRONA', label: 'Online sincrona' },
  { value: 'ONLINE_ASINCRONA', label: 'Online asincrona' },
  { value: 'BLENDED', label: 'Blended' },
  { value: 'AFFIANCAMENTO', label: 'Affiancamento' },
]
const STATI_CORSO = [
  { value: 'PIANIFICATO', label: 'Pianificato', color: 'bg-gray-100 text-gray-700' },
  { value: 'IN_CORSO', label: 'In corso', color: 'bg-blue-100 text-blue-700' },
  { value: 'CONCLUSO', label: 'Concluso', color: 'bg-green-100 text-green-700' },
  { value: 'ANNULLATO', label: 'Annullato', color: 'bg-red-100 text-red-700' },
]

export default function CorsiFormativiManager({ clienteId }: CorsiFormativiManagerProps) {
  const [corsi, setCorsi] = useState<Corso[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Corso | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedCorso, setExpandedCorso] = useState<string | null>(null)
  const [partecipanti, setPartecipanti] = useState<Partecipante[]>([])
  const [loadingPart, setLoadingPart] = useState(false)

  const [form, setForm] = useState({
    titolo: '', area_tematica: '', modalita: 'AULA', ore_durata: '',
    data_inizio: '', data_fine: '', sede: '', ente_erogatore: '',
    docente: '', stato: 'PIANIFICATO', costo_totale: '', note: '',
  })

  // Partecipante form
  const [showPartForm, setShowPartForm] = useState(false)
  const [partForm, setPartForm] = useState({
    cognome: '', nome: '', codice_fiscale: '', qualifica: '', ruolo_sicurezza: '',
  })

  useEffect(() => { loadCorsi() }, [clienteId])

  const loadCorsi = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/clienti/${clienteId}/formazione/corsi`)
      const json = await res.json()
      if (json.success) setCorsi(json.data)
    } catch (err) {
      console.error('[CorsiFormativiManager] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadPartecipanti = async (corsoId: string) => {
    try {
      setLoadingPart(true)
      const res = await fetch(`/api/clienti/${clienteId}/formazione/corsi/${corsoId}/partecipanti`)
      const json = await res.json()
      if (json.success) setPartecipanti(json.data)
    } catch (err) {
      console.error('[CorsiFormativiManager] Partecipanti error:', err)
    } finally {
      setLoadingPart(false)
    }
  }

  const toggleExpand = (corsoId: string) => {
    if (expandedCorso === corsoId) {
      setExpandedCorso(null)
    } else {
      setExpandedCorso(corsoId)
      loadPartecipanti(corsoId)
    }
  }

  const openNew = () => {
    setEditing(null)
    setForm({
      titolo: '', area_tematica: '', modalita: 'AULA', ore_durata: '',
      data_inizio: '', data_fine: '', sede: '', ente_erogatore: '',
      docente: '', stato: 'PIANIFICATO', costo_totale: '', note: '',
    })
    setShowModal(true)
  }

  const openEdit = (c: Corso) => {
    setEditing(c)
    setForm({
      titolo: c.titolo, area_tematica: c.area_tematica || '', modalita: c.modalita || 'AULA',
      ore_durata: c.ore_durata?.toString() || '', data_inizio: c.data_inizio || '',
      data_fine: c.data_fine || '', sede: c.sede || '', ente_erogatore: c.ente_erogatore || '',
      docente: c.docente || '', stato: c.stato, costo_totale: c.costo_totale?.toString() || '',
      note: c.note || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.titolo) return
    setSaving(true)
    try {
      const payload = {
        titolo: form.titolo,
        area_tematica: form.area_tematica || null,
        modalita: form.modalita,
        ore_durata: form.ore_durata ? parseFloat(form.ore_durata) : null,
        data_inizio: form.data_inizio || null,
        data_fine: form.data_fine || null,
        sede: form.sede || null,
        ente_erogatore: form.ente_erogatore || null,
        docente: form.docente || null,
        stato: form.stato,
        costo_totale: form.costo_totale ? parseFloat(form.costo_totale) : null,
        note: form.note || null,
      }

      const url = editing
        ? `/api/clienti/${clienteId}/formazione/corsi/${editing.id}`
        : `/api/clienti/${clienteId}/formazione/corsi`

      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (json.success) { setShowModal(false); loadCorsi() }
    } catch (err) {
      console.error('[CorsiFormativiManager] Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questo corso?')) return
    try {
      const res = await fetch(`/api/clienti/${clienteId}/formazione/corsi/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) loadCorsi()
    } catch (err) {
      console.error('[CorsiFormativiManager] Delete error:', err)
    }
  }

  const handleAddPartecipante = async (corsoId: string) => {
    if (!partForm.cognome || !partForm.nome) return
    try {
      const res = await fetch(`/api/clienti/${clienteId}/formazione/corsi/${corsoId}/partecipanti`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partForm),
      })
      const json = await res.json()
      if (json.success) {
        setShowPartForm(false)
        setPartForm({ cognome: '', nome: '', codice_fiscale: '', qualifica: '', ruolo_sicurezza: '' })
        loadPartecipanti(corsoId)
        loadCorsi()
      }
    } catch (err) {
      console.error('[CorsiFormativiManager] Add partecipante error:', err)
    }
  }

  const handleDeletePartecipante = async (corsoId: string, partId: string) => {
    try {
      const res = await fetch(`/api/clienti/${clienteId}/formazione/corsi/${corsoId}/partecipanti?partecipanteId=${partId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) { loadPartecipanti(corsoId); loadCorsi() }
    } catch (err) {
      console.error('[CorsiFormativiManager] Delete partecipante error:', err)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center">
          <GraduationCap className="w-4 h-4 mr-2" />
          Corsi ed Edizioni
        </h4>
        <div className="flex items-center space-x-2">
          <button onClick={loadCorsi} className="btn-secondary text-sm py-1.5 px-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openNew} className="btn-primary text-sm py-1.5 px-3">
            <Plus className="w-3.5 h-3.5 mr-1" /> Nuovo corso
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : corsi.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nessun corso registrato</p>
          <button onClick={openNew} className="btn-primary text-sm py-2 px-4 mt-4">
            <Plus className="w-4 h-4 mr-1" /> Aggiungi il primo corso
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {corsi.map(c => {
            const statoInfo = STATI_CORSO.find(s => s.value === c.stato)
            const isExpanded = expandedCorso === c.id

            return (
              <div key={c.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="p-3 flex items-start justify-between">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(c.id)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statoInfo?.color || ''}`}>
                        {statoInfo?.label || c.stato}
                      </span>
                      {c.area_tematica && <span className="text-xs text-gray-500">{c.area_tematica}</span>}
                      {c.modalita && <span className="text-xs text-gray-400">{MODALITA.find(m => m.value === c.modalita)?.label}</span>}
                    </div>
                    <h5 className="text-sm font-medium text-gray-900">{c.titolo}</h5>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      {c.data_inizio && <span>{new Date(c.data_inizio).toLocaleDateString('it-IT')}</span>}
                      {c.ore_durata && <span>{c.ore_durata}h</span>}
                      {c.numero_partecipanti != null && (
                        <span className="flex items-center"><Users className="w-3 h-3 mr-1" />{c.numero_partecipanti}</span>
                      )}
                      {c.piano && <span className="text-teal-600">Piano: {c.piano.titolo}</span>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    <button onClick={() => toggleExpand(c.id)} className="p-1 hover:bg-gray-100 rounded">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => openEdit(c)} className="p-1 hover:bg-gray-100 rounded"><Edit className="w-3.5 h-3.5 text-gray-500" /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                  </div>
                </div>

                {/* Expanded: Partecipanti */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <h6 className="text-xs font-semibold text-gray-700 flex items-center">
                        <Users className="w-3.5 h-3.5 mr-1" /> Partecipanti
                      </h6>
                      <button onClick={() => setShowPartForm(!showPartForm)} className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                        + Aggiungi
                      </button>
                    </div>

                    {showPartForm && (
                      <div className="bg-white rounded border border-gray-200 p-2 mb-2 grid grid-cols-5 gap-2">
                        <input placeholder="Cognome *" value={partForm.cognome} onChange={e => setPartForm({ ...partForm, cognome: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-xs" />
                        <input placeholder="Nome *" value={partForm.nome} onChange={e => setPartForm({ ...partForm, nome: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-xs" />
                        <input placeholder="Cod. Fiscale" value={partForm.codice_fiscale} onChange={e => setPartForm({ ...partForm, codice_fiscale: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-xs" />
                        <input placeholder="Qualifica" value={partForm.qualifica} onChange={e => setPartForm({ ...partForm, qualifica: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-xs" />
                        <button onClick={() => handleAddPartecipante(c.id)} className="btn-primary text-xs py-1">Aggiungi</button>
                      </div>
                    )}

                    {loadingPart ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-auto" />
                    ) : partecipanti.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">Nessun partecipante</p>
                    ) : (
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left py-1 px-1">Cognome</th>
                            <th className="text-left py-1 px-1">Nome</th>
                            <th className="text-left py-1 px-1">CF</th>
                            <th className="text-left py-1 px-1">Qualifica</th>
                            <th className="text-right py-1 px-1"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {partecipanti.map(p => (
                            <tr key={p.id} className="border-t border-gray-100">
                              <td className="py-1 px-1">{p.cognome}</td>
                              <td className="py-1 px-1">{p.nome}</td>
                              <td className="py-1 px-1 text-gray-500">{p.codice_fiscale || '-'}</td>
                              <td className="py-1 px-1 text-gray-500">{p.qualifica || '-'}</td>
                              <td className="py-1 px-1 text-right">
                                <button onClick={() => handleDeletePartecipante(c.id, p.id)}
                                  className="p-0.5 hover:bg-red-50 rounded">
                                  <Trash2 className="w-3 h-3 text-red-400" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Corso Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">{editing ? 'Modifica corso' : 'Nuovo corso'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titolo *</label>
                <input type="text" value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Area tematica</label>
                  <select value={form.area_tematica} onChange={e => setForm({ ...form, area_tematica: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="">Seleziona...</option>
                    {AREE.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modalità</label>
                  <select value={form.modalita} onChange={e => setForm({ ...form, modalita: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    {MODALITA.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ore durata</label>
                  <input type="number" step="0.5" value={form.ore_durata} onChange={e => setForm({ ...form, ore_durata: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data inizio</label>
                  <input type="date" value={form.data_inizio} onChange={e => setForm({ ...form, data_inizio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data fine</label>
                  <input type="date" value={form.data_fine} onChange={e => setForm({ ...form, data_fine: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ente erogatore</label>
                  <input type="text" value={form.ente_erogatore} onChange={e => setForm({ ...form, ente_erogatore: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Docente</label>
                  <input type="text" value={form.docente} onChange={e => setForm({ ...form, docente: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sede</label>
                  <input type="text" value={form.sede} onChange={e => setForm({ ...form, sede: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                  <select value={form.stato} onChange={e => setForm({ ...form, stato: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    {STATI_CORSO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Costo totale (€)</label>
                <input type="number" step="0.01" value={form.costo_totale} onChange={e => setForm({ ...form, costo_totale: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" rows={2} />
              </div>
            </div>
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="btn-secondary text-sm py-2 px-4">Annulla</button>
              <button onClick={handleSave} disabled={saving || !form.titolo} className="btn-primary text-sm py-2 px-4">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Salva' : 'Crea corso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
