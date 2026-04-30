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
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
        <button
          onClick={fetchNote}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          title="Ricarica"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Ricarica
        </button>
      </div>

      {loading && note.length === 0 ? (
        <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
          Caricamento note...
        </div>
      ) : note.length === 0 ? (
        <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          Nessuna nota riunione ancora ingestionata per questo cliente.
          Le note vengono create automaticamente dalle trascrizioni
          caricate su Google Drive.
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
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NotaCard({
  nota,
  expanded,
  onToggle,
}: {
  nota: Nota
  expanded: boolean
  onToggle: () => void
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

          {nota.drive_file_url && (
            <div className="pt-2 border-t border-gray-200">
              <a
                href={nota.drive_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="w-3 h-3" />
                Apri trascrizione su Drive
              </a>
            </div>
          )}
        </div>
      )}
    </div>
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
