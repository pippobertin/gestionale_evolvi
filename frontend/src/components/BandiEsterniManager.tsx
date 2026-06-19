'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Landmark,
  Plus,
  RefreshCw,
  X,
  Trash2,
  Sparkles,
  ExternalLink,
  Calendar,
  Pencil,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { TIPOLOGIE_INVESTIMENTO } from '@/lib/tipologieInvestimento'

interface BandoEsterno {
  id: string
  fonte: string
  titolo: string
  investimenti_spesati: string[]
  tipologia_aiuto: string | null
  stato: string
  data_apertura: string | null
  data_scadenza: string | null
  url_dettagli: string | null
  territorio: string | null
  destinatari: string | null
  settori: string | null
  created_at: string
}

const STATO_LABEL: Record<string, string> = {
  attivo: 'Attivo',
  scaduto: 'Scaduto',
  archiviato: 'Archiviato',
}

const STATO_BADGE: Record<string, string> = {
  attivo: 'bg-green-50 border-green-200 text-green-700',
  scaduto: 'bg-gray-100 border-gray-200 text-gray-500',
  archiviato: 'bg-gray-100 border-gray-200 text-gray-500',
}

export default function BandiEsterniManager() {
  const { user } = useAuth()
  const [bandi, setBandi] = useState<BandoEsterno[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<BandoEsterno | null>(null)
  const [filtroStato, setFiltroStato] = useState<string>('attivo')

  const fetchBandi = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('scadenze_bandi_bandi_esterni')
      .select('*')
      .order('created_at', { ascending: false })
    if (filtroStato !== 'tutti') query = query.eq('stato', filtroStato)
    const { data, error } = await query
    if (!error && data) setBandi(data as BandoEsterno[])
    else if (error) console.error('[BandiEsterni] fetch:', error)
    setLoading(false)
  }, [filtroStato])

  useEffect(() => {
    fetchBandi()
  }, [fetchBandi])

  async function handleDelete(id: string) {
    if (!window.confirm('Eliminare questo bando dal catalogo?')) return
    const { error } = await supabase
      .from('scadenze_bandi_bandi_esterni')
      .delete()
      .eq('id', id)
    if (error) {
      alert('Errore eliminazione: ' + error.message)
      return
    }
    setBandi((prev) => prev.filter((b) => b.id !== id))
  }

  async function handleStato(id: string, stato: string) {
    const { error } = await supabase
      .from('scadenze_bandi_bandi_esterni')
      .update({ stato })
      .eq('id', id)
    if (error) {
      alert('Errore: ' + error.message)
      return
    }
    fetchBandi()
  }

  return (
    <div className="space-y-4">
      <div className="card-shadow bg-white rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">
              Catalogo bandi esterni
            </h3>
            <span className="text-sm text-gray-500">({bandi.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filtroStato}
              onChange={(e) => setFiltroStato(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="attivo">Attivi</option>
              <option value="scaduto">Scaduti</option>
              <option value="archiviato">Archiviati</option>
              <option value="tutti">Tutti</option>
            </select>
            <button
              onClick={fetchBandi}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setEditing(null)
                setShowModal(true)
              }}
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Aggiungi bando
            </button>
          </div>
        </div>

        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-3 inline-block">
          Catalogo a uso interno (abbonamento Agevolando). Non redistribuire i contenuti verbatim ai clienti.
        </p>
      </div>

      {loading && bandi.length === 0 ? (
        <div className="text-sm text-gray-500 p-6 bg-white rounded-xl card-shadow text-center">
          Caricamento catalogo...
        </div>
      ) : bandi.length === 0 ? (
        <div className="text-sm text-gray-500 italic p-6 bg-white rounded-xl card-shadow text-center">
          Nessun bando nel catalogo con questo filtro. Aggiungine uno incollando
          il testo di un alert Agevolando.
        </div>
      ) : (
        <div className="space-y-2">
          {bandi.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-xl card-shadow p-4 flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-gray-900">{b.titolo}</h4>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded border ${
                      STATO_BADGE[b.stato] ?? STATO_BADGE.archiviato
                    }`}
                  >
                    {STATO_LABEL[b.stato] ?? b.stato}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {b.investimenti_spesati.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800"
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 flex-wrap">
                  <span className="capitalize">{b.fonte}</span>
                  {b.tipologia_aiuto && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>{b.tipologia_aiuto}</span>
                    </>
                  )}
                  {b.territorio && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>{b.territorio}</span>
                    </>
                  )}
                  {b.data_scadenza && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(b.data_scadenza).toLocaleDateString('it-IT')}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {b.url_dettagli && (
                  <a
                    href={b.url_dettagli}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Vedi dettagli (fonte)"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <select
                  value={b.stato}
                  onChange={(e) => handleStato(b.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
                  title="Cambia stato"
                >
                  <option value="attivo">Attivo</option>
                  <option value="scaduto">Scaduto</option>
                  <option value="archiviato">Archiviato</option>
                </select>
                <button
                  onClick={() => {
                    setEditing(b)
                    setShowModal(true)
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="Modifica"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Elimina"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <BandoEsternoModal
          bando={editing}
          userEmail={user?.email ?? null}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            fetchBandi()
          }}
        />
      )}
    </div>
  )
}

interface BandoForm {
  titolo: string
  tipologia_aiuto: string
  investimenti_spesati: string[]
  stato: string
  data_apertura: string
  data_scadenza: string
  territorio: string
  destinatari: string
  settori: string
  url_dettagli: string
}

function BandoEsternoModal({
  bando,
  userEmail,
  onClose,
  onSaved,
}: {
  bando: BandoEsterno | null
  userEmail: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [testo, setTesto] = useState('')
  const [estraendo, setEstraendo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<BandoForm>({
    titolo: bando?.titolo ?? '',
    tipologia_aiuto: bando?.tipologia_aiuto ?? '',
    investimenti_spesati: bando?.investimenti_spesati ?? [],
    stato: bando?.stato ?? 'attivo',
    data_apertura: bando?.data_apertura ?? '',
    data_scadenza: bando?.data_scadenza ?? '',
    territorio: bando?.territorio ?? '',
    destinatari: bando?.destinatari ?? '',
    settori: bando?.settori ?? '',
    url_dettagli: bando?.url_dettagli ?? '',
  })

  function set<K extends keyof BandoForm>(k: K, v: BandoForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function toggleCat(cat: string) {
    setForm((f) => ({
      ...f,
      investimenti_spesati: f.investimenti_spesati.includes(cat)
        ? f.investimenti_spesati.filter((c) => c !== cat)
        : [...f.investimenti_spesati, cat],
    }))
  }

  async function handleEstrai() {
    if (!testo.trim()) {
      setError('Incolla il testo dell\'alert o del bando da cui estrarre.')
      return
    }
    setEstraendo(true)
    setError(null)
    try {
      const res = await fetch('/api/bandi-esterni/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Estrazione non riuscita.')
      } else {
        const b = json.bando
        setForm({
          titolo: b.titolo ?? '',
          tipologia_aiuto: b.tipologia_aiuto ?? '',
          investimenti_spesati: b.investimenti_spesati ?? [],
          stato: b.stato ?? 'attivo',
          data_apertura: b.data_apertura ?? '',
          data_scadenza: b.data_scadenza ?? '',
          territorio: b.territorio ?? '',
          destinatari: b.destinatari ?? '',
          settori: b.settori ?? '',
          url_dettagli: b.url_dettagli ?? '',
        })
      }
    } catch {
      setError('Errore di rete durante l\'estrazione.')
    }
    setEstraendo(false)
  }

  async function handleSave() {
    if (!form.titolo.trim()) {
      setError('Il titolo è obbligatorio.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      titolo: form.titolo.trim(),
      tipologia_aiuto: form.tipologia_aiuto.trim() || null,
      investimenti_spesati: form.investimenti_spesati,
      stato: form.stato,
      data_apertura: form.data_apertura.trim() || null,
      data_scadenza: form.data_scadenza || null,
      territorio: form.territorio.trim() || null,
      destinatari: form.destinatari.trim() || null,
      settori: form.settori.trim() || null,
      url_dettagli: form.url_dettagli.trim() || null,
    }

    const { error: dbError } = bando
      ? await supabase
          .from('scadenze_bandi_bandi_esterni')
          .update(payload)
          .eq('id', bando.id)
      : await supabase.from('scadenze_bandi_bandi_esterni').insert({
          ...payload,
          fonte: 'agevolando',
          raw_payload: testo ? { testo } : {},
          created_by: userEmail,
        })

    setSaving(false)
    if (dbError) {
      setError('Errore salvataggio: ' + dbError.message)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="gradient-primary text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4" />
            <span className="text-sm font-semibold">
              {bando ? 'Modifica bando esterno' : 'Aggiungi bando esterno'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {!bando && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Incolla il testo dell&apos;alert Agevolando (opzionale)
              </label>
              <textarea
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                rows={4}
                placeholder="Incolla qui il corpo dell'email di segnalazione o il testo della sintesi, poi premi Estrai."
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleEstrai}
                disabled={estraendo}
                className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
              >
                {estraendo ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Estrai campi con AI
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Titolo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.titolo}
              onChange={(e) => set('titolo', e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Investimenti spesati (categorie)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {TIPOLOGIE_INVESTIMENTO.map((cat) => (
                <label
                  key={cat}
                  className={`flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                    form.investimenti_spesati.includes(cat)
                      ? 'bg-blue-50 border-blue-300 text-blue-900'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.investimenti_spesati.includes(cat)}
                    onChange={() => toggleCat(cat)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {cat}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Tipologia di aiuto
              </label>
              <input
                type="text"
                value={form.tipologia_aiuto}
                onChange={(e) => set('tipologia_aiuto', e.target.value)}
                placeholder="Es. Contributi a fondo perduto"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Stato
              </label>
              <select
                value={form.stato}
                onChange={(e) => set('stato', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="attivo">Attivo</option>
                <option value="scaduto">Scaduto</option>
                <option value="archiviato">Archiviato</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Territorio
              </label>
              <input
                type="text"
                value={form.territorio}
                onChange={(e) => set('territorio', e.target.value)}
                placeholder="Es. Tutto il territorio italiano"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Destinatari
              </label>
              <input
                type="text"
                value={form.destinatari}
                onChange={(e) => set('destinatari', e.target.value)}
                placeholder="Es. PMI e Micro Imprese"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Settori
              </label>
              <input
                type="text"
                value={form.settori}
                onChange={(e) => set('settori', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Data scadenza
              </label>
              <input
                type="date"
                value={form.data_scadenza}
                onChange={(e) => set('data_scadenza', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              URL dettagli (fonte)
            </label>
            <input
              type="url"
              value={form.url_dettagli}
              onChange={(e) => set('url_dettagli', e.target.value)}
              placeholder="https://..."
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-end gap-2 flex-shrink-0 bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2 rounded-lg disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Salva bando
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
