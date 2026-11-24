'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Inbox,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  Search,
  Check,
  X,
  Building2,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface NotaInbox {
  id: string
  cliente_id: string | null
  data_riunione: string | null
  durata_minuti_stimata: number | null
  tipo: string | null
  titolo: string
  sintesi_one_liner: string | null
  contenuto_markdown: string
  entita: Record<string, unknown>
  verifiche_suggerite: unknown[]
  sorgente: string
  drive_file_url: string | null
  filename_originale: string | null
  match_confidence: number | null
  match_method: string | null
  stato: string
  created_at: string
}

interface CandidatoCliente {
  id: string
  denominazione: string
  partita_iva: string | null
  score: number
}

export default function NoteInboxContent() {
  const [note, setNote] = useState<NotaInbox[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Note archiviate (riunioni interne e scartate): si possono riportare tra quelle da assegnare
  const [archivio, setArchivio] = useState<NotaInbox[]>([])
  const [mostraArchivio, setMostraArchivio] = useState(false)

  const fetchNote = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('scadenze_bandi_clienti_note')
      .select('*')
      .eq('stato', 'in_inbox')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[NoteInbox] Errore fetch:', error)
      setNote([])
    } else {
      setNote((data ?? []) as NotaInbox[])
    }
    const { data: arch } = await supabase
      .from('scadenze_bandi_clienti_note')
      .select('*')
      .is('cliente_id', null)
      .in('stato', ['archiviata', 'scartata'])
      .order('created_at', { ascending: false })
      .limit(100)
    setArchivio((arch ?? []) as NotaInbox[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchNote()
  }, [fetchNote])

  async function handleAssegna(notaId: string, clienteId: string) {
    const { error } = await supabase
      .from('scadenze_bandi_clienti_note')
      .update({
        cliente_id: clienteId,
        stato: 'pubblicata',
        match_method: 'manuale',
        match_confidence: 1.0,
        // Una nota riportata dall'archivio delle riunioni interne torna riunione con il cliente
        ...(note.find((n) => n.id === notaId)?.tipo === 'riunione_interna' ? { tipo: 'riunione_cliente' } : {}),
      })
      .eq('id', notaId)

    if (error) {
      alert('Errore nell\'assegnazione: ' + error.message)
      return
    }

    // Rimuovi dalla lista locale
    setNote((prev) => prev.filter((n) => n.id !== notaId))
  }

  async function handleMarcaInterna(notaId: string) {
    const { error } = await supabase
      .from('scadenze_bandi_clienti_note')
      .update({
        stato: 'archiviata',
        tipo: 'riunione_interna',
      })
      .eq('id', notaId)

    if (error) {
      alert('Errore: ' + error.message)
      return
    }
    const nota = note.find((n) => n.id === notaId)
    setNote((prev) => prev.filter((n) => n.id !== notaId))
    if (nota) setArchivio((prev) => [{ ...nota, stato: 'archiviata', tipo: 'riunione_interna' }, ...prev])
  }

  async function handleRipristina(notaId: string) {
    const { error } = await supabase
      .from('scadenze_bandi_clienti_note')
      .update({ stato: 'in_inbox' })
      .eq('id', notaId)
    if (error) {
      alert('Errore: ' + error.message)
      return
    }
    const nota = archivio.find((n) => n.id === notaId)
    setArchivio((prev) => prev.filter((n) => n.id !== notaId))
    if (nota) setNote((prev) => [{ ...nota, stato: 'in_inbox' }, ...prev])
  }

  async function handleScarta(notaId: string) {
    if (!confirm('Scartare questa nota? Finisce tra le note archiviate in fondo alla pagina, da dove si può riportare qui.')) {
      return
    }
    const { error } = await supabase
      .from('scadenze_bandi_clienti_note')
      .update({ stato: 'scartata' })
      .eq('id', notaId)

    if (error) {
      alert('Errore: ' + error.message)
      return
    }
    const nota = note.find((n) => n.id === notaId)
    setNote((prev) => prev.filter((n) => n.id !== notaId))
    if (nota) setArchivio((prev) => [{ ...nota, stato: 'scartata' }, ...prev])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Inbox className="w-6 h-6 text-gray-700" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Note da assegnare</h2>
            <p className="text-sm text-gray-500">
              Verbali delle riunioni registrate, trascritti in automatico, che non sono stati collegati da soli a un cliente.
              Assegnata a un cliente, la nota compare tra le note della sua scheda.
            </p>
          </div>
        </div>
        <button
          onClick={fetchNote}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Ricarica
        </button>
      </div>

      <div className="text-xs text-gray-500">
        {note.length} {note.length === 1 ? 'nota da assegnare' : 'note da assegnare'}
      </div>

      {loading && note.length === 0 ? (
        <div className="text-sm text-gray-500 p-6 bg-white rounded-lg border border-gray-200">
          Caricamento...
        </div>
      ) : note.length === 0 ? (
        <div className="text-sm text-gray-500 italic p-6 bg-white rounded-lg border border-dashed border-gray-300 text-center">
          Nessuna nota da assegnare.
        </div>
      ) : (
        <div className="space-y-3">
          {note.map((n) => (
            <NotaInboxCard
              key={n.id}
              nota={n}
              expanded={expandedId === n.id}
              onToggle={() =>
                setExpandedId(expandedId === n.id ? null : n.id)
              }
              onAssegna={(clienteId) => handleAssegna(n.id, clienteId)}
              onMarcaInterna={() => handleMarcaInterna(n.id)}
              onScarta={() => handleScarta(n.id)}
            />
          ))}
        </div>
      )}

      {archivio.length > 0 && (
        <div className="pt-2">
          <button type="button" onClick={() => setMostraArchivio(!mostraArchivio)} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
            {mostraArchivio ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Note archiviate: riunioni interne e note scartate ({archivio.length})
          </button>
          {mostraArchivio && (
            <div className="mt-2 bg-white border border-gray-200 rounded-lg divide-y">
              {archivio.map((n) => (
                <div key={n.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-900 truncate">{n.titolo}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(n.data_riunione || n.created_at).toLocaleDateString('it-IT')} · {n.stato === 'scartata' ? 'scartata' : 'riunione interna'}
                      {n.drive_file_url && <> · <a href={n.drive_file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">trascrizione su Drive</a></>}
                    </div>
                  </div>
                  <button type="button" onClick={() => handleRipristina(n.id)} className="text-xs px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700">
                    Riporta tra le note da assegnare
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

function NotaInboxCard({
  nota,
  expanded,
  onToggle,
  onAssegna,
  onMarcaInterna,
  onScarta,
}: {
  nota: NotaInbox
  expanded: boolean
  onToggle: () => void
  onAssegna: (clienteId: string) => void
  onMarcaInterna: () => void
  onScarta: () => void
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

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-gray-50 flex items-start justify-between gap-3"
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
                  {numVerifiche} {numVerifiche === 1 ? 'punto da controllare' : 'punti da controllare'}
                </span>
              </>
            )}
          </div>
          <h3 className="font-medium text-gray-900 truncate">
            {nota.titolo}
          </h3>
          {nota.sintesi_one_liner && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
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
        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
          <MarkdownPreview content={nota.contenuto_markdown} />

          {numVerifiche > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <div className="text-sm font-medium text-amber-900 flex items-center gap-1 mb-1">
                <Sparkles className="w-4 h-4" /> Punti da controllare nella trascrizione
              </div>
              <ul className="space-y-1.5 text-sm text-amber-900">
                {(nota.verifiche_suggerite as { estratto?: string; suggerito?: string; motivazione?: string }[]).map((v, i) => (
                  <li key={i}>
                    {v.estratto && <span>«{v.estratto}»</span>}
                    {v.suggerito && <span> → <strong>{v.suggerito}</strong></span>}
                    {v.motivazione && <div className="text-xs text-amber-800">{v.motivazione}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {nota.drive_file_url && (
            <a
              href={nota.drive_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="w-3 h-3" />
              Apri trascrizione su Drive
            </a>
          )}

          <div className="pt-3 border-t border-gray-200">
            <ClienteAssignmentBox
              hint={nota.titolo}
              onAssegna={onAssegna}
              onMarcaInterna={onMarcaInterna}
              onScarta={onScarta}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Box per cercare e assegnare un cliente alla nota.
 * Usa la RPC match_clienti via supabase client (RLS authenticated).
 */
function ClienteAssignmentBox({
  hint,
  onAssegna,
  onMarcaInterna,
  onScarta,
}: {
  hint: string
  onAssegna: (clienteId: string) => void
  onMarcaInterna: () => void
  onScarta: () => void
}) {
  const [query, setQuery] = useState('')
  const [candidati, setCandidati] = useState<CandidatoCliente[]>([])
  const [searching, setSearching] = useState(false)
  const [proposti, setProposti] = useState(true)

  // All'apertura cerca i clienti che il titolo della nota suggerisce
  useEffect(() => {
    cerca(hint)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hint])

  async function cerca(text: string) {
    if (text.trim().length < 2) {
      setCandidati([])
      return
    }
    setSearching(true)
    const { data, error } = await supabase.rpc('match_clienti', {
      query_text: text.trim(),
      max_results: 8,
      soglia_minima: 0.15,
    })
    if (!error && data) {
      setCandidati(data as CandidatoCliente[])
    }
    setSearching(false)
  }

  function handleQueryChange(v: string) {
    setQuery(v)
    setProposti(v.trim().length === 0)
    cerca(v.trim().length === 0 ? hint : v)
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <Building2 className="w-4 h-4" />
        Assegna a cliente
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Cerca un altro cliente per nome o partita IVA"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {searching && (
        <div className="text-xs text-gray-500">Ricerca...</div>
      )}

      {candidati.length > 0 && proposti && (
        <div className="text-xs text-gray-500">Clienti proposti in base al titolo della nota: un clic assegna la nota.</div>
      )}
      {candidati.length === 0 && proposti && !searching && (
        <div className="text-xs text-gray-500">Il titolo non suggerisce nessun cliente: cercalo per nome o partita IVA.</div>
      )}

      {candidati.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white">
          {candidati.map((c) => (
            <button
              key={c.id}
              onClick={() => onAssegna(c.id)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between gap-3 border-b border-gray-100 last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {c.denominazione}
                </div>
                {c.partita_iva && (
                  <div className="text-xs text-gray-500">
                    P.IVA {c.partita_iva}
                  </div>
                )}
              </div>
              <div className="text-xs font-mono text-gray-500 flex-shrink-0">
                {(c.score * 100).toFixed(0)}%
              </div>
              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {!proposti && query.trim().length >= 2 && candidati.length === 0 && !searching && (
        <div className="text-xs text-gray-500 italic">
          Nessun cliente trovato per &quot;{query}&quot;.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={onMarcaInterna}
          className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-100 text-gray-700"
        >
          È una riunione interna
        </button>
        <button
          onClick={onScarta}
          className="text-xs px-3 py-1.5 border border-red-200 rounded-md hover:bg-red-50 text-red-600 flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          Scarta
        </button>
        <span className="basis-full text-xs text-gray-500">Le riunioni interne non vanno in nessun cliente: restano tra le note archiviate, in fondo alla pagina.</span>
      </div>
    </div>
  )
}

/**
 * Mini render markdown per preview (replica del MarkdownView in NoteTimeline).
 */
function MarkdownPreview({ content }: { content: string }) {
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
            <li key={i}>{item}</li>
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
        <h5 key={`h-${key++}`} className="font-medium text-sm text-gray-800 mt-2">
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
          {line}
        </p>
      )
    }
  }
  flushList()

  return <div className="space-y-1">{elements}</div>
}
