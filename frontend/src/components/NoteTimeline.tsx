'use client'

import { useState, useEffect } from 'react'
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  RefreshCw,
  MessageSquare,
  Trash2,
  Unlink,
  X,
  FileText,
  Briefcase,
  Plus,
  Pencil,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Nota {
  id: string
  cliente_id: string | null
  data_riunione: string | null
  data_caricamento: string | null
  durata_minuti_stimata: number | null
  tipo: string | null
  titolo: string
  sintesi_one_liner: string | null
  contenuto_markdown: string
  entita: Record<string, unknown>
  verifiche_suggerite: unknown[]
  sorgente: string
  drive_file_url: string | null
  match_confidence: number | null
  match_method: string | null
  stato: string
  created_at: string
  bandi_collegati: Array<{
    link_id: string
    bando_id: string
    bando_nome: string | null
    stato: string
    score: number
  }>
  progetti_collegati: Array<{
    link_id: string
    progetto_id: string
    progetto_nome: string | null
    stato: string
    score: number
  }>
}

export default function NoteTimeline({ clienteId }: { clienteId: string }) {
  const [note, setNote] = useState<Nota[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)

  useEffect(() => {
    fetchNote()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  async function fetchNote() {
    setLoading(true)
    const { data, error } = await supabase
      .from('scadenze_bandi_clienti_note_full')
      .select('*')
      .eq('cliente_id', clienteId)
      .in('stato', ['pubblicata', 'archiviata'])
      .order('data_riunione', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (!error && data) {
      setNote(data as Nota[])
    } else if (error) {
      console.error('[NoteTimeline] Errore fetch note:', error)
    }
    setLoading(false)
  }

  async function handleDelete(notaId: string) {
    const conferma = window.confirm(
      'Vuoi eliminare definitivamente questa nota?\n\nL\'azione e\' irreversibile e rimuovera\' anche tutti i collegamenti a bandi e progetti.'
    )
    if (!conferma) return

    const { error } = await supabase
      .from('scadenze_bandi_clienti_note')
      .delete()
      .eq('id', notaId)

    if (error) {
      alert('Errore eliminazione: ' + error.message)
      return
    }
    setNote((prev) => prev.filter((n) => n.id !== notaId))
  }

  async function handleUnlinkCliente(notaId: string) {
    const conferma = window.confirm(
      'Scollegare la nota da questo cliente?\n\nLa nota tornera\' in Inbox per essere riassegnata. I collegamenti a bandi e progetti restano associati alla nota.'
    )
    if (!conferma) return

    const { error } = await supabase
      .from('scadenze_bandi_clienti_note')
      .update({
        cliente_id: null,
        stato: 'in_inbox',
        match_method: 'manuale',
        match_confidence: null,
      })
      .eq('id', notaId)

    if (error) {
      alert('Errore scollegamento: ' + error.message)
      return
    }
    setNote((prev) => prev.filter((n) => n.id !== notaId))
  }

  async function handleUnlinkBando(notaId: string, linkId: string) {
    const conferma = window.confirm('Scollegare questo bando dalla nota?')
    if (!conferma) return

    const { error } = await supabase
      .from('scadenze_bandi_note_bandi')
      .delete()
      .eq('id', linkId)

    if (error) {
      alert('Errore scollegamento bando: ' + error.message)
      return
    }
    setNote((prev) =>
      prev.map((n) =>
        n.id === notaId
          ? {
              ...n,
              bandi_collegati: n.bandi_collegati.filter(
                (b) => b.link_id !== linkId
              ),
            }
          : n
      )
    )
  }

  async function handleUnlinkProgetto(notaId: string, linkId: string) {
    const conferma = window.confirm('Scollegare questo progetto dalla nota?')
    if (!conferma) return

    const { error } = await supabase
      .from('scadenze_bandi_note_progetti')
      .delete()
      .eq('id', linkId)

    if (error) {
      alert('Errore scollegamento progetto: ' + error.message)
      return
    }
    setNote((prev) =>
      prev.map((n) =>
        n.id === notaId
          ? {
              ...n,
              progetti_collegati: n.progetti_collegati.filter(
                (p) => p.link_id !== linkId
              ),
            }
          : n
      )
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-600" />
          <h4 className="text-sm font-semibold text-gray-900">
            Note riunioni
          </h4>
          <span className="text-xs text-gray-500">
            ({note.length})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchNote}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            title="Ricarica"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Ricarica
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors"
            title="Aggiungi una nota scritta a mano"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuova nota
          </button>
        </div>
      </div>

      {loading && note.length === 0 ? (
        <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
          Caricamento note...
        </div>
      ) : note.length === 0 ? (
        <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          Nessuna nota riunione per questo cliente. Le note vengono create
          automaticamente dalle trascrizioni caricate su Google Drive, oppure
          puoi aggiungerne una a mano con &laquo;Nuova nota&raquo;.
        </div>
      ) : (
        <div className="space-y-2">
          {note.map((n) => (
            <NotaCard
              key={n.id}
              nota={n}
              expanded={expandedId === n.id}
              onToggle={() =>
                setExpandedId(expandedId === n.id ? null : n.id)
              }
              onDelete={() => handleDelete(n.id)}
              onUnlinkCliente={() => handleUnlinkCliente(n.id)}
              onUnlinkBando={(linkId) => handleUnlinkBando(n.id, linkId)}
              onUnlinkProgetto={(linkId) =>
                handleUnlinkProgetto(n.id, linkId)
              }
            />
          ))}
        </div>
      )}

      {showNewModal && (
        <NewNoteModal
          clienteId={clienteId}
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false)
            fetchNote()
          }}
        />
      )}
    </div>
  )
}

function NewNoteModal({
  clienteId,
  onClose,
  onCreated,
}: {
  clienteId: string
  onClose: () => void
  onCreated: () => void
}) {
  const { user } = useAuth()
  const today = new Date().toISOString().slice(0, 10)

  const [titolo, setTitolo] = useState('')
  const [dataRiunione, setDataRiunione] = useState(today)
  const [tipo, setTipo] = useState('riunione_cliente')
  const [durata, setDurata] = useState('')
  const [sintesi, setSintesi] = useState('')
  const [contenuto, setContenuto] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const titoloTrim = titolo.trim()
    const contenutoTrim = contenuto.trim()
    if (!titoloTrim) {
      setError('Il titolo e\' obbligatorio.')
      return
    }
    if (!contenutoTrim) {
      setError('Il contenuto della nota e\' obbligatorio.')
      return
    }

    setSaving(true)
    setError(null)

    const durataNum = durata.trim() ? parseInt(durata, 10) : null

    const { error: insertError } = await supabase
      .from('scadenze_bandi_clienti_note')
      .insert({
        cliente_id: clienteId,
        data_riunione: dataRiunione || null,
        data_caricamento: today,
        durata_minuti_stimata:
          durataNum != null && !Number.isNaN(durataNum) ? durataNum : null,
        tipo,
        titolo: titoloTrim,
        sintesi_one_liner: sintesi.trim() || null,
        contenuto_markdown: contenutoTrim,
        entita: {},
        verifiche_suggerite: [],
        sorgente: 'manuale',
        match_method: 'manuale',
        match_confidence: 1.0,
        stato: 'pubblicata',
        created_by: user?.email ?? null,
      })

    setSaving(false)

    if (insertError) {
      setError('Errore salvataggio: ' + insertError.message)
      return
    }
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="gradient-primary text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            <span className="text-sm font-semibold">Nuova nota riunione</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Titolo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              placeholder="Es. Riunione di allineamento progetto X"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Data riunione
              </label>
              <input
                type="date"
                value={dataRiunione}
                onChange={(e) => setDataRiunione(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="riunione_cliente">Riunione cliente</option>
                <option value="riunione_interna">Riunione interna</option>
                <option value="altro">Altro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Durata (min)
              </label>
              <input
                type="number"
                min="0"
                value={durata}
                onChange={(e) => setDurata(e.target.value)}
                placeholder="—"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Sintesi (una riga)
            </label>
            <input
              type="text"
              value={sintesi}
              onChange={(e) => setSintesi(e.target.value)}
              placeholder="Riassunto breve, opzionale"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Contenuto <span className="text-red-500">*</span>
            </label>
            <textarea
              value={contenuto}
              onChange={(e) => setContenuto(e.target.value)}
              rows={10}
              placeholder={
                'Scrivi qui la nota della riunione.\n\nPuoi usare un formato semplice:\n## Titolo sezione\n- punto elenco\n**testo in grassetto**'
              }
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Supporta una formattazione markdown leggera: ## sezioni, - liste,
              **grassetto**.
            </p>
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
                Salva nota
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function NotaCard({
  nota,
  expanded,
  onToggle,
  onDelete,
  onUnlinkCliente,
  onUnlinkBando,
  onUnlinkProgetto,
}: {
  nota: Nota
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onUnlinkCliente: () => void
  onUnlinkBando: (linkId: string) => void
  onUnlinkProgetto: (linkId: string) => void
}) {
  const dataDisplay = nota.data_riunione
    ? new Date(nota.data_riunione).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : new Date(nota.created_at).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })

  const numVerifiche = Array.isArray(nota.verifiche_suggerite)
    ? nota.verifiche_suggerite.length
    : 0

  const numLinkBandi = nota.bandi_collegati?.length ?? 0
  const numLinkProgetti = nota.progetti_collegati?.length ?? 0

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors">
      <button
        onClick={onToggle}
        className="w-full p-3 text-left bg-white hover:bg-gray-50 flex items-start justify-between gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1 flex-wrap">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span>{dataDisplay}</span>
            <span className="text-gray-300">·</span>
            <span className="capitalize">{nota.sorgente}</span>
            {nota.durata_minuti_stimata && (
              <>
                <span className="text-gray-300">·</span>
                <span>{nota.durata_minuti_stimata} min</span>
              </>
            )}
            {numVerifiche > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="flex items-center gap-1 text-amber-600">
                  <Sparkles className="w-3 h-3" />
                  {numVerifiche} verifich{numVerifiche === 1 ? 'a' : 'e'}
                </span>
              </>
            )}
            {(numLinkBandi > 0 || numLinkProgetti > 0) && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-blue-600">
                  {numLinkBandi > 0 && `${numLinkBandi} bando`}
                  {numLinkBandi > 0 && numLinkProgetti > 0 && ', '}
                  {numLinkProgetti > 0 && `${numLinkProgetti} progetto`}
                </span>
              </>
            )}
          </div>
          <h5 className="font-medium text-sm text-gray-900 truncate">
            {nota.titolo}
          </h5>
          {nota.sintesi_one_liner && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
              {nota.sintesi_one_liner}
            </p>
          )}
        </div>
        <div className="text-gray-400 mt-1 flex-shrink-0">
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
          <MarkdownView content={nota.contenuto_markdown} />

          <CollegamentiSection
            bandi={nota.bandi_collegati}
            progetti={nota.progetti_collegati}
            onUnlinkBando={onUnlinkBando}
            onUnlinkProgetto={onUnlinkProgetto}
          />

          <div className="pt-2 border-t border-gray-200 flex items-center justify-between gap-3 flex-wrap">
            {nota.drive_file_url ? (
              <a
                href={nota.drive_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="w-3 h-3" />
                Apri trascrizione su Drive
              </a>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={onUnlinkCliente}
                className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 px-2 py-1 rounded border border-amber-200"
                title="Scollega la nota dal cliente: tornera' in Inbox"
              >
                <Unlink className="w-3 h-3" />
                Scollega dal cliente
              </button>
              <button
                onClick={onDelete}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded"
                title="Elimina definitivamente la nota"
              >
                <Trash2 className="w-3 h-3" />
                Elimina nota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CollegamentiSection({
  bandi,
  progetti,
  onUnlinkBando,
  onUnlinkProgetto,
}: {
  bandi: Nota['bandi_collegati']
  progetti: Nota['progetti_collegati']
  onUnlinkBando: (linkId: string) => void
  onUnlinkProgetto: (linkId: string) => void
}) {
  const bandiVisibili = (bandi ?? []).filter((b) => b.stato !== 'rifiutato')
  const progettiVisibili = (progetti ?? []).filter(
    (p) => p.stato !== 'rifiutato'
  )

  if (bandiVisibili.length === 0 && progettiVisibili.length === 0) {
    return null
  }

  return (
    <div className="pt-2 border-t border-gray-200 space-y-2">
      <div className="text-xs font-semibold text-gray-700">Collegamenti</div>

      {bandiVisibili.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {bandiVisibili.map((b) => (
            <LinkChip
              key={b.link_id}
              icon={<FileText className="w-3 h-3" />}
              label={b.bando_nome ?? 'Bando senza nome'}
              stato={b.stato}
              onRemove={() => onUnlinkBando(b.link_id)}
              tone="bando"
            />
          ))}
        </div>
      )}

      {progettiVisibili.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {progettiVisibili.map((p) => (
            <LinkChip
              key={p.link_id}
              icon={<Briefcase className="w-3 h-3" />}
              label={p.progetto_nome ?? 'Progetto senza nome'}
              stato={p.stato}
              onRemove={() => onUnlinkProgetto(p.link_id)}
              tone="progetto"
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LinkChip({
  icon,
  label,
  stato,
  onRemove,
  tone,
}: {
  icon: React.ReactNode
  label: string
  stato: string
  onRemove: () => void
  tone: 'bando' | 'progetto'
}) {
  const baseColor =
    tone === 'bando'
      ? 'bg-blue-50 border-blue-200 text-blue-800'
      : 'bg-purple-50 border-purple-200 text-purple-800'

  const statoBadge =
    stato === 'confermato'
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-yellow-100 text-yellow-800 border-yellow-200'

  const statoLabel = stato === 'confermato' ? 'Confermato' : 'Suggerito'

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${baseColor}`}
    >
      {icon}
      <span className="font-medium truncate max-w-[200px]" title={label}>
        {label}
      </span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded border ${statoBadge}`}
      >
        {statoLabel}
      </span>
      <button
        onClick={onRemove}
        className="ml-0.5 hover:bg-red-100 hover:text-red-700 rounded p-0.5 transition-colors"
        title="Scollega"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

/**
 * Mini-renderer markdown adatto al formato che produce Gemini:
 * supporta H2 (##), H3 (###), liste (- ), paragrafi e bold (**...**).
 * Niente dipendenze esterne.
 */
function MarkdownView({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listBuffer: string[] = []
  let key = 0

  function flushList() {
    if (listBuffer.length > 0) {
      elements.push(
        <ul
          key={`ul-${key++}`}
          className="list-disc pl-5 space-y-1 text-sm text-gray-700"
        >
          {listBuffer.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      )
      listBuffer = []
    }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('## ')) {
      flushList()
      elements.push(
        <h4
          key={`h-${key++}`}
          className="font-semibold text-sm text-gray-900 mt-3 first:mt-0"
        >
          {line.slice(3)}
        </h4>
      )
    } else if (line.startsWith('### ')) {
      flushList()
      elements.push(
        <h5
          key={`h-${key++}`}
          className="font-medium text-sm text-gray-800 mt-2"
        >
          {line.slice(4)}
        </h5>
      )
    } else if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2))
    } else if (line === '') {
      flushList()
    } else {
      flushList()
      elements.push(
        <p key={`p-${key++}`} className="text-sm text-gray-700">
          {renderInline(line)}
        </p>
      )
    }
  }
  flushList()

  return <div className="space-y-1">{elements}</div>
}

/**
 * Inline render: gestisce **bold**.
 */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i}>{p.slice(2, -2)}</strong>
    }
    return <span key={i}>{p}</span>
  })
}
