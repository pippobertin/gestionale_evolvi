'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Plus, RefreshCw, Edit, Trash2, Loader2, X, ChevronRight } from 'lucide-react'
import { useFondi } from '@/hooks/useFondi'
import { STATO_PIANO_LABELS, STATO_PIANO_COLORS, getValidNextStates, canTransition, type StatoPiano } from '@/lib/formazione/pianoStateMachine'

interface Piano {
  id: string
  cliente_id: string
  adesione_fpi_id: string | null
  fondo_id: string | null
  codice_piano: string | null
  titolo: string
  descrizione: string | null
  tipologia: string | null
  canale_finanziamento: string | null
  avviso_riferimento: string | null
  stato: StatoPiano
  data_presentazione: string | null
  data_approvazione: string | null
  data_inizio_attivita: string | null
  data_fine_attivita: string | null
  data_scadenza_rendicontazione: string | null
  importo_richiesto: number | null
  importo_approvato: number | null
  importo_erogato: number | null
  ore_previste: number | null
  ore_erogate: number | null
  num_partecipanti_previsti: number | null
  num_partecipanti_effettivi: number | null
  responsabile_piano: unknown
  note: string | null
  fondo: { id: string; codice: string; nome: string; sigla: string } | null
}

interface PianiFormativiManagerProps {
  clienteId: string
  hasAdesioneFpi: boolean
}

const TIPOLOGIE = [
  { value: 'AZIENDALE', label: 'Aziendale' },
  { value: 'PLURIAZIENDALE', label: 'Pluriaziendale' },
  { value: 'SETTORIALE', label: 'Settoriale' },
  { value: 'TERRITORIALE', label: 'Territoriale' },
  { value: 'PRIVATO', label: 'Privato' },
  { value: 'OBBLIGATORIO', label: 'Obbligatorio' },
]

const CANALI = [
  { value: 'CONTO_FORMAZIONE', label: 'Conto Formazione' },
  { value: 'CONTO_SISTEMA', label: 'Conto di Sistema' },
  { value: 'AVVISO', label: 'Avviso' },
  { value: 'PRIVATO', label: 'Privato' },
  { value: 'NON_APPLICABILE', label: 'Non applicabile' },
]

export default function PianiFormativiManager({ clienteId, hasAdesioneFpi }: PianiFormativiManagerProps) {
  const { fondi } = useFondi()
  const [piani, setPiani] = useState<Piano[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Piano | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterStato, setFilterStato] = useState('')

  const [form, setForm] = useState({
    titolo: '', codice_piano: '', descrizione: '', tipologia: 'AZIENDALE',
    canale_finanziamento: 'CONTO_FORMAZIONE', fondo_id: '', adesione_fpi_id: '',
    avviso_riferimento: '',
    data_presentazione: '', data_approvazione: '', data_inizio_attivita: '',
    data_fine_attivita: '', data_scadenza_rendicontazione: '',
    importo_richiesto: '', importo_approvato: '',
    ore_previste: '', num_partecipanti_previsti: '', note: '',
  })

  useEffect(() => { loadPiani() }, [clienteId, filterStato])

  const loadPiani = async () => {
    try {
      setLoading(true)
      const qs = filterStato ? `?stato=${filterStato}` : ''
      const res = await fetch(`/api/clienti/${clienteId}/formazione/piani${qs}`)
      const json = await res.json()
      if (json.success) setPiani(json.data)
    } catch (err) {
      console.error('[PianiFormativiManager] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const openNew = () => {
    setEditing(null)
    setForm({
      titolo: '', codice_piano: '', descrizione: '', tipologia: 'AZIENDALE',
      canale_finanziamento: 'CONTO_FORMAZIONE', fondo_id: '', adesione_fpi_id: '',
      avviso_riferimento: '',
      data_presentazione: '', data_approvazione: '', data_inizio_attivita: '',
      data_fine_attivita: '', data_scadenza_rendicontazione: '',
      importo_richiesto: '', importo_approvato: '',
      ore_previste: '', num_partecipanti_previsti: '', note: '',
    })
    setShowModal(true)
  }

  const openEdit = (p: Piano) => {
    setEditing(p)
    setForm({
      titolo: p.titolo, codice_piano: p.codice_piano || '', descrizione: p.descrizione || '',
      tipologia: p.tipologia || 'AZIENDALE', canale_finanziamento: p.canale_finanziamento || 'CONTO_FORMAZIONE',
      fondo_id: p.fondo_id || '', adesione_fpi_id: p.adesione_fpi_id || '',
      avviso_riferimento: p.avviso_riferimento || '',
      data_presentazione: p.data_presentazione || '', data_approvazione: p.data_approvazione || '',
      data_inizio_attivita: p.data_inizio_attivita || '', data_fine_attivita: p.data_fine_attivita || '',
      data_scadenza_rendicontazione: p.data_scadenza_rendicontazione || '',
      importo_richiesto: p.importo_richiesto?.toString() || '',
      importo_approvato: p.importo_approvato?.toString() || '',
      ore_previste: p.ore_previste?.toString() || '',
      num_partecipanti_previsti: p.num_partecipanti_previsti?.toString() || '',
      note: p.note || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.titolo) return
    setSaving(true)
    try {
      const payload = {
        titolo: form.titolo,
        codice_piano: form.codice_piano || null,
        descrizione: form.descrizione || null,
        tipologia: form.tipologia,
        canale_finanziamento: form.canale_finanziamento,
        fondo_id: form.fondo_id || null,
        adesione_fpi_id: form.adesione_fpi_id || null,
        avviso_riferimento: form.avviso_riferimento || null,
        data_presentazione: form.data_presentazione || null,
        data_approvazione: form.data_approvazione || null,
        data_inizio_attivita: form.data_inizio_attivita || null,
        data_fine_attivita: form.data_fine_attivita || null,
        data_scadenza_rendicontazione: form.data_scadenza_rendicontazione || null,
        importo_richiesto: form.importo_richiesto ? parseFloat(form.importo_richiesto) : null,
        importo_approvato: form.importo_approvato ? parseFloat(form.importo_approvato) : null,
        ore_previste: form.ore_previste ? parseInt(form.ore_previste) : null,
        num_partecipanti_previsti: form.num_partecipanti_previsti ? parseInt(form.num_partecipanti_previsti) : null,
        note: form.note || null,
      }

      const url = editing
        ? `/api/clienti/${clienteId}/formazione/piani/${editing.id}`
        : `/api/clienti/${clienteId}/formazione/piani`

      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (json.success) {
        setShowModal(false)
        loadPiani()
      } else {
        alert(json.error || 'Errore nel salvataggio')
      }
    } catch (err) {
      console.error('[PianiFormativiManager] Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleChangeStato = async (piano: Piano, newStato: StatoPiano) => {
    const result = canTransition(piano.stato, newStato, piano)
    if (!result.valid) {
      alert(result.error)
      return
    }

    if (!confirm(`Confermi il passaggio di stato da "${STATO_PIANO_LABELS[piano.stato]}" a "${STATO_PIANO_LABELS[newStato]}"?`)) return

    try {
      const res = await fetch(`/api/clienti/${clienteId}/formazione/piani/${piano.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stato: newStato }),
      })
      const json = await res.json()
      if (json.success) loadPiani()
      else alert(json.error || 'Errore nel cambio stato')
    } catch (err) {
      console.error('[PianiFormativiManager] State change error:', err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questo piano formativo?')) return
    try {
      const res = await fetch(`/api/clienti/${clienteId}/formazione/piani/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) loadPiani()
    } catch (err) {
      console.error('[PianiFormativiManager] Delete error:', err)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center">
          <BookOpen className="w-4 h-4 mr-2" />
          Piani Formativi
        </h4>
        <div className="flex items-center space-x-2">
          <select
            value={filterStato}
            onChange={e => setFilterStato(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5"
          >
            <option value="">Tutti gli stati</option>
            {Object.entries(STATO_PIANO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button onClick={loadPiani} className="btn-secondary text-sm py-1.5 px-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openNew} className="btn-primary text-sm py-1.5 px-3">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Nuovo piano
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : piani.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nessun piano formativo</p>
          <button onClick={openNew} className="btn-primary text-sm py-2 px-4 mt-4">
            <Plus className="w-4 h-4 mr-1" /> Crea il primo piano
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {piani.map(p => (
            <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-3 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATO_PIANO_COLORS[p.stato]}`}>
                      {STATO_PIANO_LABELS[p.stato]}
                    </span>
                    {p.fondo?.sigla && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{p.fondo.sigla}</span>
                    )}
                    {p.codice_piano && (
                      <span className="text-xs text-gray-500">{p.codice_piano}</span>
                    )}
                  </div>
                  <h5 className="text-sm font-medium text-gray-900 truncate">{p.titolo}</h5>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    {p.tipologia && <span>{TIPOLOGIE.find(t => t.value === p.tipologia)?.label}</span>}
                    {p.ore_previste && <span>{p.ore_erogate || 0}/{p.ore_previste} ore</span>}
                    {p.importo_approvato && <span>€ {p.importo_approvato.toLocaleString('it-IT')}</span>}
                  </div>
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  {/* State transitions */}
                  {getValidNextStates(p.stato).length > 0 && (
                    <div className="relative group">
                      <button className="p-1 hover:bg-gray-100 rounded text-gray-500" title="Cambia stato">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 hidden group-hover:block min-w-[160px]">
                        {getValidNextStates(p.stato).map(ns => (
                          <button
                            key={ns}
                            onClick={() => handleChangeStato(p, ns)}
                            className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                          >
                            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${STATO_PIANO_COLORS[ns].split(' ')[0]}`} />
                            {STATO_PIANO_LABELS[ns]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={() => openEdit(p)} className="p-1 hover:bg-gray-100 rounded" title="Modifica">
                    <Edit className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1 hover:bg-red-50 rounded" title="Elimina">
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                {editing ? 'Modifica piano formativo' : 'Nuovo piano formativo'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titolo *</label>
                <input type="text" value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Codice piano</label>
                  <input type="text" value={form.codice_piano} onChange={e => setForm({ ...form, codice_piano: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipologia</label>
                  <select value={form.tipologia} onChange={e => setForm({ ...form, tipologia: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    {TIPOLOGIE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Canale finanziamento</label>
                  <select value={form.canale_finanziamento} onChange={e => setForm({ ...form, canale_finanziamento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    {CANALI.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fondo</label>
                  <select value={form.fondo_id} onChange={e => setForm({ ...form, fondo_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    disabled={!hasAdesioneFpi && form.tipologia !== 'PRIVATO' && form.tipologia !== 'OBBLIGATORIO'}>
                    <option value="">Nessun fondo</option>
                    {fondi.map(f => <option key={f.id} value={f.id}>{f.sigla}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avviso di riferimento</label>
                <input type="text" value={form.avviso_riferimento} onChange={e => setForm({ ...form, avviso_riferimento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="es. Avviso 3/2024" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data presentazione</label>
                  <input type="date" value={form.data_presentazione} onChange={e => setForm({ ...form, data_presentazione: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data inizio attività</label>
                  <input type="date" value={form.data_inizio_attivita} onChange={e => setForm({ ...form, data_inizio_attivita: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data fine attività</label>
                  <input type="date" value={form.data_fine_attivita} onChange={e => setForm({ ...form, data_fine_attivita: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scad. rendicontazione</label>
                  <input type="date" value={form.data_scadenza_rendicontazione} onChange={e => setForm({ ...form, data_scadenza_rendicontazione: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data approvazione</label>
                  <input type="date" value={form.data_approvazione} onChange={e => setForm({ ...form, data_approvazione: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Importo richiesto (€)</label>
                  <input type="number" step="0.01" value={form.importo_richiesto} onChange={e => setForm({ ...form, importo_richiesto: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Importo approvato (€)</label>
                  <input type="number" step="0.01" value={form.importo_approvato} onChange={e => setForm({ ...form, importo_approvato: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ore previste</label>
                  <input type="number" value={form.ore_previste} onChange={e => setForm({ ...form, ore_previste: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Partecipanti previsti</label>
                  <input type="number" value={form.num_partecipanti_previsti} onChange={e => setForm({ ...form, num_partecipanti_previsti: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <textarea value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" rows={2} />
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
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Salva' : 'Crea piano'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
