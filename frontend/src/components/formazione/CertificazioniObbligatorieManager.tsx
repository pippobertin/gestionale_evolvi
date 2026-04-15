'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, Plus, RefreshCw, Edit, Trash2, Loader2, X, RotateCcw } from 'lucide-react'

interface Certificazione {
  id: string
  cliente_id: string
  tipo_obbligo: string
  normativa_riferimento: string | null
  persona_nome: string | null
  persona_codice_fiscale: string | null
  data_conseguimento: string | null
  data_scadenza: string | null
  validita_mesi: number | null
  stato: 'VALIDA' | 'IN_SCADENZA' | 'SCADUTA' | 'DA_RINNOVARE'
  corso_collegato_id: string | null
  file_attestato_storage_path: string | null
  note: string | null
}

interface CertificazioniObbligatorieManagerProps {
  clienteId: string
}

const TIPO_OBBLIGO_OPTIONS = [
  { value: 'FORMAZIONE_LAVORATORI_RISCHIO_BASSO', label: 'Form. lavoratori rischio basso', validita: 60 },
  { value: 'FORMAZIONE_LAVORATORI_RISCHIO_MEDIO', label: 'Form. lavoratori rischio medio', validita: 60 },
  { value: 'FORMAZIONE_LAVORATORI_RISCHIO_ALTO', label: 'Form. lavoratori rischio alto', validita: 60 },
  { value: 'RSPP', label: 'RSPP', validita: 60 },
  { value: 'DIRIGENTI_SSL', label: 'Dirigenti SSL', validita: 60 },
  { value: 'PREPOSTI', label: 'Preposti', validita: 24 },
  { value: 'RLS', label: 'RLS', validita: 12 },
  { value: 'ANTINCENDIO_BASSO', label: 'Antincendio rischio basso', validita: 36 },
  { value: 'ANTINCENDIO_MEDIO', label: 'Antincendio rischio medio', validita: 36 },
  { value: 'ANTINCENDIO_ALTO', label: 'Antincendio rischio alto', validita: 36 },
  { value: 'PRIMO_SOCCORSO', label: 'Primo soccorso', validita: 36 },
  { value: 'HACCP', label: 'HACCP', validita: 24 },
  { value: 'PRIVACY_GDPR', label: 'Privacy/GDPR', validita: 12 },
  { value: 'ANTIRICICLAGGIO', label: 'Antiriciclaggio', validita: 12 },
  { value: 'ALTRO', label: 'Altro', validita: null },
]

const STATO_COLORS: Record<string, string> = {
  VALIDA: 'bg-green-100 text-green-700',
  IN_SCADENZA: 'bg-amber-100 text-amber-700',
  SCADUTA: 'bg-red-100 text-red-700',
  DA_RINNOVARE: 'bg-gray-100 text-gray-500',
}

const STATO_LABELS: Record<string, string> = {
  VALIDA: 'Valida',
  IN_SCADENZA: 'In scadenza',
  SCADUTA: 'Scaduta',
  DA_RINNOVARE: 'Da rinnovare',
}

const ROW_COLORS: Record<string, string> = {
  SCADUTA: 'bg-red-50',
  IN_SCADENZA: 'bg-amber-50',
  VALIDA: '',
  DA_RINNOVARE: 'bg-gray-50',
}

export default function CertificazioniObbligatorieManager({ clienteId }: CertificazioniObbligatorieManagerProps) {
  const [certificazioni, setCertificazioni] = useState<Certificazione[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Certificazione | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterStato, setFilterStato] = useState('')

  const [form, setForm] = useState({
    tipo_obbligo: '',
    normativa_riferimento: '',
    persona_nome: '',
    persona_codice_fiscale: '',
    data_conseguimento: '',
    data_scadenza: '',
    validita_mesi: '',
    note: '',
  })

  useEffect(() => { loadCertificazioni() }, [clienteId])

  const loadCertificazioni = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/clienti/${clienteId}/formazione/certificazioni`)
      const json = await res.json()
      if (json.success) setCertificazioni(json.data)
    } catch (err) {
      console.error('[CertificazioniManager] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const openNew = () => {
    setEditing(null)
    setForm({
      tipo_obbligo: '', normativa_riferimento: '', persona_nome: '',
      persona_codice_fiscale: '', data_conseguimento: '', data_scadenza: '',
      validita_mesi: '', note: '',
    })
    setShowModal(true)
  }

  const openEdit = (c: Certificazione) => {
    setEditing(c)
    setForm({
      tipo_obbligo: c.tipo_obbligo,
      normativa_riferimento: c.normativa_riferimento || '',
      persona_nome: c.persona_nome || '',
      persona_codice_fiscale: c.persona_codice_fiscale || '',
      data_conseguimento: c.data_conseguimento || '',
      data_scadenza: c.data_scadenza || '',
      validita_mesi: c.validita_mesi?.toString() || '',
      note: c.note || '',
    })
    setShowModal(true)
  }

  const handleTipoChange = (tipo: string) => {
    const tipoInfo = TIPO_OBBLIGO_OPTIONS.find(t => t.value === tipo)
    const newValidita = tipoInfo?.validita?.toString() || form.validita_mesi

    // Auto-calculate scadenza if data_conseguimento is set
    let newScadenza = form.data_scadenza
    if (form.data_conseguimento && tipoInfo?.validita) {
      const d = new Date(form.data_conseguimento)
      d.setMonth(d.getMonth() + tipoInfo.validita)
      newScadenza = d.toISOString().split('T')[0]
    }

    setForm({ ...form, tipo_obbligo: tipo, validita_mesi: newValidita, data_scadenza: newScadenza })
  }

  const handleDataConseguimentoChange = (date: string) => {
    let newScadenza = form.data_scadenza
    const validitaMesi = parseInt(form.validita_mesi)
    if (date && validitaMesi) {
      const d = new Date(date)
      d.setMonth(d.getMonth() + validitaMesi)
      newScadenza = d.toISOString().split('T')[0]
    }
    setForm({ ...form, data_conseguimento: date, data_scadenza: newScadenza })
  }

  const handleSave = async () => {
    if (!form.tipo_obbligo) return
    setSaving(true)
    try {
      const payload = {
        tipo_obbligo: form.tipo_obbligo,
        normativa_riferimento: form.normativa_riferimento || null,
        persona_nome: form.persona_nome || null,
        persona_codice_fiscale: form.persona_codice_fiscale || null,
        data_conseguimento: form.data_conseguimento || null,
        data_scadenza: form.data_scadenza || null,
        validita_mesi: form.validita_mesi ? parseInt(form.validita_mesi) : null,
        note: form.note || null,
      }

      const url = editing
        ? `/api/clienti/${clienteId}/formazione/certificazioni/${editing.id}`
        : `/api/clienti/${clienteId}/formazione/certificazioni`

      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (json.success) { setShowModal(false); loadCertificazioni() }
    } catch (err) {
      console.error('[CertificazioniManager] Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questa certificazione?')) return
    try {
      const res = await fetch(`/api/clienti/${clienteId}/formazione/certificazioni/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) loadCertificazioni()
    } catch (err) {
      console.error('[CertificazioniManager] Delete error:', err)
    }
  }

  const handleRinnova = async (id: string) => {
    if (!confirm('Rinnovare questa certificazione? Verrà creata una nuova certificazione con la data di oggi.')) return
    try {
      const res = await fetch(`/api/clienti/${clienteId}/formazione/certificazioni/${id}/rinnova`, { method: 'POST' })
      const json = await res.json()
      if (json.success) loadCertificazioni()
    } catch (err) {
      console.error('[CertificazioniManager] Rinnova error:', err)
    }
  }

  const filtered = filterStato
    ? certificazioni.filter(c => c.stato === filterStato)
    : certificazioni

  // Summary counts
  const countScadute = certificazioni.filter(c => c.stato === 'SCADUTA').length
  const countInScadenza = certificazioni.filter(c => c.stato === 'IN_SCADENZA').length

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
          <ShieldCheck className="w-4 h-4 mr-2" />
          Certificazioni obbligatorie
          {countScadute > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              {countScadute} scadute
            </span>
          )}
          {countInScadenza > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              {countInScadenza} in scadenza
            </span>
          )}
        </h4>
        <div className="flex items-center space-x-2">
          <select
            value={filterStato}
            onChange={e => setFilterStato(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-md text-xs"
          >
            <option value="">Tutti gli stati</option>
            <option value="SCADUTA">Scadute</option>
            <option value="IN_SCADENZA">In scadenza</option>
            <option value="VALIDA">Valide</option>
            <option value="DA_RINNOVARE">Da rinnovare</option>
          </select>
          <button onClick={loadCertificazioni} className="btn-secondary text-sm py-1.5 px-2" title="Aggiorna">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openNew} className="btn-primary text-sm py-1.5 px-3">
            <Plus className="w-3.5 h-3.5 mr-1" /> Nuova certificazione
          </button>
        </div>
      </div>

      {/* Empty state */}
      {certificazioni.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nessuna certificazione registrata</p>
          <p className="text-gray-400 text-sm mt-1">Registra le certificazioni obbligatorie per monitorarne le scadenze</p>
          <button onClick={openNew} className="btn-primary text-sm py-2 px-4 mt-4">
            <Plus className="w-4 h-4 mr-1" /> Registra la prima certificazione
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Tipo obbligo</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Persona</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Conseguimento</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Scadenza</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Validità</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Stato</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => {
                const tipoLabel = TIPO_OBBLIGO_OPTIONS.find(t => t.value === c.tipo_obbligo)?.label || c.tipo_obbligo
                const daysLeft = c.data_scadenza
                  ? Math.ceil((new Date(c.data_scadenza).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null

                return (
                  <tr key={c.id} className={`hover:bg-gray-50 ${ROW_COLORS[c.stato] || ''}`}>
                    <td className="px-4 py-2.5 text-sm">
                      <span className="font-medium text-gray-900">{tipoLabel}</span>
                      {c.normativa_riferimento && (
                        <><br /><span className="text-xs text-gray-500">{c.normativa_riferimento}</span></>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">
                      {c.persona_nome || '-'}
                      {c.persona_codice_fiscale && (
                        <><br /><span className="text-xs text-gray-400">{c.persona_codice_fiscale}</span></>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">
                      {c.data_conseguimento ? new Date(c.data_conseguimento).toLocaleDateString('it-IT') : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      <span className={c.stato === 'SCADUTA' ? 'text-red-700 font-medium' : c.stato === 'IN_SCADENZA' ? 'text-amber-700 font-medium' : 'text-gray-700'}>
                        {c.data_scadenza ? new Date(c.data_scadenza).toLocaleDateString('it-IT') : '-'}
                      </span>
                      {daysLeft !== null && daysLeft > 0 && daysLeft <= 90 && (
                        <span className="ml-1 text-xs text-amber-600">({daysLeft}gg)</span>
                      )}
                      {daysLeft !== null && daysLeft <= 0 && (
                        <span className="ml-1 text-xs text-red-600">(scaduta)</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500">
                      {c.validita_mesi ? `${c.validita_mesi} mesi` : '-'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATO_COLORS[c.stato] || ''}`}>
                        {STATO_LABELS[c.stato] || c.stato}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {(c.stato === 'SCADUTA' || c.stato === 'IN_SCADENZA') && (
                          <button onClick={() => handleRinnova(c.id)} className="p-1 hover:bg-green-50 rounded" title="Rinnova">
                            <RotateCcw className="w-3.5 h-3.5 text-green-600" />
                          </button>
                        )}
                        <button onClick={() => openEdit(c)} className="p-1 hover:bg-gray-100 rounded" title="Modifica">
                          <Edit className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-1 hover:bg-red-50 rounded" title="Elimina">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                {editing ? 'Modifica certificazione' : 'Nuova certificazione obbligatoria'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo obbligo *</label>
                <select
                  value={form.tipo_obbligo}
                  onChange={e => handleTipoChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Seleziona tipo...</option>
                  {TIPO_OBBLIGO_OPTIONS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Normativa di riferimento</label>
                <input
                  type="text"
                  value={form.normativa_riferimento}
                  onChange={e => setForm({ ...form, normativa_riferimento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="es. D.Lgs. 81/2008 art. 37"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome persona</label>
                  <input
                    type="text"
                    value={form.persona_nome}
                    onChange={e => setForm({ ...form, persona_nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Codice fiscale</label>
                  <input
                    type="text"
                    value={form.persona_codice_fiscale}
                    onChange={e => setForm({ ...form, persona_codice_fiscale: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data conseguimento</label>
                  <input
                    type="date"
                    value={form.data_conseguimento}
                    onChange={e => handleDataConseguimentoChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data scadenza</label>
                  <input
                    type="date"
                    value={form.data_scadenza}
                    onChange={e => setForm({ ...form, data_scadenza: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Validità (mesi)</label>
                  <input
                    type="number"
                    value={form.validita_mesi}
                    onChange={e => setForm({ ...form, validita_mesi: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
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
                disabled={saving || !form.tipo_obbligo}
                className="btn-primary text-sm py-2 px-4"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Salva modifiche' : 'Crea certificazione'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
