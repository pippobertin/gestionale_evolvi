'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  X,
  Trash2,
  Pencil,
  Sparkles,
  ExternalLink,
  Target,
  Calendar,
  CheckCircle2,
  Archive,
  EyeOff,
  RotateCcw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { TIPOLOGIE_INVESTIMENTO } from '@/lib/tipologieInvestimento'

interface Esigenza {
  id: string
  cliente_id: string
  categorie: string[]
  descrizione: string | null
  origine: string
  nota_id: string | null
  stato: string
  created_by: string | null
  created_at: string
}

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

export default function ListaSpesa({ clienteId }: { clienteId: string }) {
  const { user } = useAuth()
  const [esigenze, setEsigenze] = useState<Esigenza[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Esigenza | null>(null)

  const fetchEsigenze = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('scadenze_bandi_clienti_esigenze')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
    if (!error && data) setEsigenze(data as Esigenza[])
    else if (error) console.error('[ListaSpesa] fetch esigenze:', error)
    setLoading(false)
  }, [clienteId])

  useEffect(() => {
    fetchEsigenze()
  }, [fetchEsigenze])

  async function handleDelete(id: string) {
    if (!window.confirm('Eliminare questa esigenza?')) return
    const { error } = await supabase
      .from('scadenze_bandi_clienti_esigenze')
      .delete()
      .eq('id', id)
    if (error) {
      alert('Errore eliminazione: ' + error.message)
      return
    }
    setEsigenze((prev) => prev.filter((e) => e.id !== id))
  }

  async function handleStato(id: string, stato: string) {
    const { error } = await supabase
      .from('scadenze_bandi_clienti_esigenze')
      .update({ stato })
      .eq('id', id)
    if (error) {
      alert('Errore aggiornamento: ' + error.message)
      return
    }
    setEsigenze((prev) =>
      prev.map((e) => (e.id === id ? { ...e, stato } : e))
    )
  }

  // Unione delle categorie delle esigenze ATTIVE: serve per evidenziare i match.
  const categorieAttive = new Set(
    esigenze
      .filter((e) => e.stato === 'attiva')
      .flatMap((e) => e.categorie)
  )

  return (
    <div className="space-y-6">
      {/* --- Esigenze --- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-900">
              Lista della spesa
            </h4>
            <span className="text-xs text-gray-500">({esigenze.length})</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchEsigenze}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              title="Ricarica"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Ricarica
            </button>
            <button
              onClick={() => {
                setEditing(null)
                setShowModal(true)
              }}
              className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuova esigenza
            </button>
          </div>
        </div>

        {loading && esigenze.length === 0 ? (
          <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
            Caricamento esigenze...
          </div>
        ) : esigenze.length === 0 ? (
          <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            Nessuna esigenza registrata. Aggiungi cosa vuole fare il cliente
            (acquisti, formazione, energia...) con &laquo;Nuova esigenza&raquo;
            per confrontarla con i bandi disponibili.
          </div>
        ) : (
          <div className="space-y-2">
            {esigenze.map((e) => (
              <EsigenzaCard
                key={e.id}
                esigenza={e}
                onEdit={() => {
                  setEditing(e)
                  setShowModal(true)
                }}
                onDelete={() => handleDelete(e.id)}
                onStato={(s) => handleStato(e.id, s)}
              />
            ))}
          </div>
        )}
      </div>

      {/* --- Bandi suggeriti --- */}
      <BandiSuggeriti
        clienteId={clienteId}
        categorieAttive={categorieAttive}
        userEmail={user?.email ?? null}
      />

      {showModal && (
        <EsigenzaModal
          clienteId={clienteId}
          esigenza={editing}
          userEmail={user?.email ?? null}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            fetchEsigenze()
          }}
        />
      )}
    </div>
  )
}

const STATO_ESIGENZA_LABEL: Record<string, string> = {
  attiva: 'Attiva',
  soddisfatta: 'Soddisfatta',
  archiviata: 'Archiviata',
}

function EsigenzaCard({
  esigenza,
  onEdit,
  onDelete,
  onStato,
}: {
  esigenza: Esigenza
  onEdit: () => void
  onDelete: () => void
  onStato: (stato: string) => void
}) {
  const attiva = esigenza.stato === 'attiva'
  return (
    <div
      className={`border rounded-lg p-3 ${
        attiva ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {esigenza.categorie.length === 0 ? (
              <span className="text-xs text-gray-400 italic">
                Nessuna categoria
              </span>
            ) : (
              esigenza.categorie.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800"
                >
                  {c}
                </span>
              ))
            )}
          </div>
          {esigenza.descrizione && (
            <p className="text-sm text-gray-700">{esigenza.descrizione}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
            <span
              className={`px-1.5 py-0.5 rounded border ${
                attiva
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-gray-100 border-gray-200 text-gray-500'
              }`}
            >
              {STATO_ESIGENZA_LABEL[esigenza.stato] ?? esigenza.stato}
            </span>
            {esigenza.origine === 'da_nota' && (
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                da nota
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {attiva ? (
            <button
              onClick={() => onStato('soddisfatta')}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
              title="Segna come soddisfatta"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => onStato('attiva')}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
              title="Riattiva"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Modifica"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Elimina"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function BandiSuggeriti({
  clienteId,
  categorieAttive,
  userEmail,
}: {
  clienteId: string
  categorieAttive: Set<string>
  userEmail: string | null
}) {
  const [bandi, setBandi] = useState<BandoEsterno[]>([])
  const [loading, setLoading] = useState(true)
  const [scartati, setScartati] = useState<BandoEsterno[]>([])
  const [showScartati, setShowScartati] = useState(false)

  const fetchMatch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc(
      'match_bandi_esterni_per_cliente',
      { p_cliente_id: clienteId }
    )
    if (!error && data) setBandi(data as BandoEsterno[])
    else if (error) console.error('[BandiSuggeriti] rpc match:', error)
    setLoading(false)
  }, [clienteId])

  const fetchScartati = useCallback(async () => {
    const { data, error } = await supabase
      .from('scadenze_bandi_clienti_bandi_esterni')
      .select('stato, bando:bando_esterno_id (*)')
      .eq('cliente_id', clienteId)
      .eq('stato', 'scartato')
    if (!error && data) {
      setScartati(
        (data as unknown as { bando: BandoEsterno | null }[])
          .map((r) => r.bando)
          .filter((b): b is BandoEsterno => !!b)
      )
    }
  }, [clienteId])

  useEffect(() => {
    fetchMatch()
    fetchScartati()
  }, [fetchMatch, fetchScartati])

  async function handleScarta(bandoId: string) {
    const { error } = await supabase
      .from('scadenze_bandi_clienti_bandi_esterni')
      .upsert(
        {
          cliente_id: clienteId,
          bando_esterno_id: bandoId,
          stato: 'scartato',
          created_by: userEmail,
        },
        { onConflict: 'cliente_id,bando_esterno_id' }
      )
    if (error) {
      alert('Errore: ' + error.message)
      return
    }
    setBandi((prev) => prev.filter((b) => b.id !== bandoId))
    fetchScartati()
  }

  async function handleRipristina(bandoId: string) {
    const { error } = await supabase
      .from('scadenze_bandi_clienti_bandi_esterni')
      .delete()
      .eq('cliente_id', clienteId)
      .eq('bando_esterno_id', bandoId)
    if (error) {
      alert('Errore: ' + error.message)
      return
    }
    setScartati((prev) => prev.filter((b) => b.id !== bandoId))
    fetchMatch()
  }

  return (
    <div className="pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-gray-600" />
          <h4 className="text-sm font-semibold text-gray-900">
            Bandi suggeriti
          </h4>
          <span className="text-xs text-gray-500">({bandi.length})</span>
        </div>
        <button
          onClick={fetchMatch}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          title="Ricarica"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Ricarica
        </button>
      </div>

      <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2 inline-block">
        Uso interno: i contenuti dei bandi esterni non vanno inoltrati verbatim ai clienti.
      </div>

      {loading && bandi.length === 0 ? (
        <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
          Ricerca match...
        </div>
      ) : bandi.length === 0 ? (
        <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          Nessun bando esterno corrisponde alle esigenze attive di questo cliente.
          Aggiungi esigenze, oppure popola il catalogo dalla sezione
          &laquo;Bandi esterni&raquo;.
        </div>
      ) : (
        <div className="space-y-2">
          {bandi.map((b) => (
            <BandoSuggeritoCard
              key={b.id}
              bando={b}
              categorieAttive={categorieAttive}
              onScarta={() => handleScarta(b.id)}
            />
          ))}
        </div>
      )}

      {scartati.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowScartati((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <EyeOff className="w-3 h-3" />
            {scartati.length} scartati
            {showScartati ? ' — nascondi' : ' — mostra'}
          </button>
          {showScartati && (
            <div className="space-y-1 mt-1">
              {scartati.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-1"
                >
                  <span className="truncate">{b.titolo}</span>
                  <button
                    onClick={() => handleRipristina(b.id)}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 flex-shrink-0"
                    title="Ripristina tra i suggeriti"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Ripristina
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BandoSuggeritoCard({
  bando,
  categorieAttive,
  onScarta,
}: {
  bando: BandoEsterno
  categorieAttive: Set<string>
  onScarta: () => void
}) {
  const scadenza = bando.data_scadenza
    ? new Date(bando.data_scadenza).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {bando.url_dettagli ? (
            <a
              href={`/api/bandi-esterni/agevolando-sso?url=${encodeURIComponent(bando.url_dettagli)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sm text-gray-900 hover:text-blue-700 hover:underline"
              title="Apri il bando su Agevolando (accesso automatico)"
            >
              {bando.titolo}
            </a>
          ) : (
            <h5 className="font-medium text-sm text-gray-900">{bando.titolo}</h5>
          )}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {bando.investimenti_spesati.map((c) => {
              const match = categorieAttive.has(c)
              return (
                <span
                  key={c}
                  className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${
                    match
                      ? 'bg-green-50 border-green-300 text-green-800 font-medium'
                      : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}
                  title={match ? 'Corrisponde a una esigenza del cliente' : undefined}
                >
                  {c}
                </span>
              )
            })}
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 flex-wrap">
            {bando.stato === 'in_apertura' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700 font-medium">
                In apertura{bando.data_apertura ? ` · ${bando.data_apertura}` : ''}
              </span>
            )}
            <span className="capitalize">{bando.fonte}</span>
            {bando.tipologia_aiuto && (
              <>
                <span className="text-gray-300">·</span>
                <span>{bando.tipologia_aiuto}</span>
              </>
            )}
            {bando.territorio && (
              <>
                <span className="text-gray-300">·</span>
                <span>{bando.territorio}</span>
              </>
            )}
            {scadenza && (
              <>
                <span className="text-gray-300">·</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {scadenza}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {bando.url_dettagli && (
            <a
              href={bando.url_dettagli}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="Vedi dettagli (fonte)"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={onScarta}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Scarta per questo cliente"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function EsigenzaModal({
  clienteId,
  esigenza,
  userEmail,
  onClose,
  onSaved,
}: {
  clienteId: string
  esigenza: Esigenza | null
  userEmail: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [categorie, setCategorie] = useState<string[]>(
    esigenza?.categorie ?? []
  )
  const [descrizione, setDescrizione] = useState(esigenza?.descrizione ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggerendo, setSuggerendo] = useState(false)

  function toggle(cat: string) {
    setCategorie((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  async function handleSuggerisci() {
    if (!descrizione.trim()) {
      setError('Scrivi una descrizione da cui suggerire le categorie.')
      return
    }
    setSuggerendo(true)
    setError(null)
    try {
      const res = await fetch('/api/esigenze/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo: descrizione }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Suggerimento non riuscito.')
      } else {
        const sugg: string[] = json.categorie ?? []
        setCategorie((prev) => Array.from(new Set([...prev, ...sugg])))
        if (!descrizione.trim() && json.descrizione)
          setDescrizione(json.descrizione)
      }
    } catch {
      setError('Errore di rete durante il suggerimento.')
    }
    setSuggerendo(false)
  }

  async function handleSave() {
    if (categorie.length === 0 && !descrizione.trim()) {
      setError('Seleziona almeno una categoria o scrivi una descrizione.')
      return
    }
    if (categorie.length === 0) {
      setError(
        'Seleziona almeno una categoria: senza categoria non genera match con i bandi.'
      )
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      cliente_id: clienteId,
      categorie,
      descrizione: descrizione.trim() || null,
    }

    const { error: dbError } = esigenza
      ? await supabase
          .from('scadenze_bandi_clienti_esigenze')
          .update(payload)
          .eq('id', esigenza.id)
      : await supabase.from('scadenze_bandi_clienti_esigenze').insert({
          ...payload,
          origine: 'manuale',
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
            <ShoppingCart className="w-4 h-4" />
            <span className="text-sm font-semibold">
              {esigenza ? 'Modifica esigenza' : 'Nuova esigenza'}
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
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Categorie di spesa <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {TIPOLOGIE_INVESTIMENTO.map((cat) => (
                <label
                  key={cat}
                  className={`flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                    categorie.includes(cat)
                      ? 'bg-blue-50 border-blue-300 text-blue-900'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={categorie.includes(cat)}
                    onChange={() => toggle(cat)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {cat}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-700">
                Descrizione
              </label>
              <button
                onClick={handleSuggerisci}
                disabled={suggerendo}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                title="Suggerisci le categorie dal testo (AI)"
              >
                {suggerendo ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Suggerisci categorie dal testo
              </button>
            </div>
            <textarea
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              rows={4}
              placeholder="Es. Vuole acquistare un tornio CNC e formare il personale di produzione."
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
                Salva
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
