'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare,
  Calendar,
  Check,
  X,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface NotaCollegata {
  link_id: string
  nota_id: string
  titolo: string
  cliente_id: string | null
  cliente_denominazione: string | null
  data_riunione: string | null
  stato: 'suggerito' | 'confermato' | 'rifiutato'
  score: number | null
}

interface NotaCandidata {
  nota_id: string
  titolo: string
  cliente_id: string | null
  cliente_denominazione: string | null
  data_riunione: string | null
  score: number
}

interface Props {
  /** Tipo di entita verso cui collegare le note */
  tipo: 'bando' | 'progetto'
  /** Id del bando o progetto */
  id: string
}

/**
 * Mostra le note collegate a un bando/progetto e propone candidati
 * (note che citano l'entita ma non sono ancora collegate).
 * L'utente puo' confermare un candidato o rifiutarlo.
 */
export default function NoteCollegateBox({ tipo, id }: Props) {
  const [collegate, setCollegate] = useState<NotaCollegata[]>([])
  const [candidati, setCandidati] = useState<NotaCandidata[]>([])
  const [loading, setLoading] = useState(true)

  const tableJoin =
    tipo === 'bando'
      ? 'scadenze_bandi_note_bandi'
      : 'scadenze_bandi_note_progetti'
  const fkColumn = tipo === 'bando' ? 'bando_id' : 'progetto_id'
  const rpcCandidati =
    tipo === 'bando'
      ? 'find_note_candidate_for_bando'
      : 'find_note_candidate_for_progetto'
  const rpcParam = tipo === 'bando' ? 'p_bando_id' : 'p_progetto_id'

  const fetchTutto = useCallback(async () => {
    setLoading(true)

    // 1) Note gia' collegate (qualunque stato)
    const { data: linksData, error: linksErr } = await supabase
      .from(tableJoin)
      .select(
        `
        id,
        nota_id,
        stato,
        score,
        scadenze_bandi_clienti_note (
          titolo,
          cliente_id,
          data_riunione
        )
      `
      )
      .eq(fkColumn, id)

    if (linksErr) {
      console.error('[NoteCollegateBox] errore fetch links:', linksErr)
    }

    // Per ottenere la denominazione cliente faccio un lookup separato
    const linksList = (linksData ?? []) as Array<{
      id: string
      nota_id: string
      stato: 'suggerito' | 'confermato' | 'rifiutato'
      score: number | null
      scadenze_bandi_clienti_note:
        | { titolo: string; cliente_id: string | null; data_riunione: string | null }
        | null
    }>

    const clienteIds = Array.from(
      new Set(
        linksList
          .map((l) => l.scadenze_bandi_clienti_note?.cliente_id)
          .filter((v): v is string => !!v)
      )
    )

    const denomMap: Record<string, string> = {}
    if (clienteIds.length > 0) {
      const { data: clientiData } = await supabase
        .from('scadenze_bandi_clienti')
        .select('id, denominazione')
        .in('id', clienteIds)
      ;(clientiData ?? []).forEach((c: { id: string; denominazione: string }) => {
        denomMap[c.id] = c.denominazione
      })
    }

    const collegateOut: NotaCollegata[] = linksList.map((l) => ({
      link_id: l.id,
      nota_id: l.nota_id,
      titolo: l.scadenze_bandi_clienti_note?.titolo ?? '(senza titolo)',
      cliente_id: l.scadenze_bandi_clienti_note?.cliente_id ?? null,
      cliente_denominazione: l.scadenze_bandi_clienti_note?.cliente_id
        ? denomMap[l.scadenze_bandi_clienti_note.cliente_id] ?? null
        : null,
      data_riunione: l.scadenze_bandi_clienti_note?.data_riunione ?? null,
      stato: l.stato,
      score: l.score,
    }))

    // 2) Candidati (RPC backward-link)
    const { data: candData, error: candErr } = await supabase.rpc(
      rpcCandidati,
      {
        [rpcParam]: id,
        p_soglia: 0.3,
      }
    )

    if (candErr) {
      console.error('[NoteCollegateBox] errore RPC candidati:', candErr)
    }

    setCollegate(collegateOut)
    setCandidati((candData ?? []) as NotaCandidata[])
    setLoading(false)
  }, [id, tableJoin, fkColumn, rpcCandidati, rpcParam])

  useEffect(() => {
    fetchTutto()
  }, [fetchTutto])

  async function handleConferma(notaId: string, score: number) {
    const { error } = await supabase
      .from(tableJoin)
      .insert([
        {
          nota_id: notaId,
          [fkColumn]: id,
          stato: 'confermato',
          score,
          metodo: 'backward_manuale',
        },
      ])

    if (error) {
      alert('Errore conferma: ' + error.message)
      return
    }
    fetchTutto()
  }

  async function handleRifiuta(notaId: string) {
    const { error } = await supabase
      .from(tableJoin)
      .insert([
        {
          nota_id: notaId,
          [fkColumn]: id,
          stato: 'rifiutato',
          score: 0,
          metodo: 'backward_manuale',
        },
      ])
    if (error) {
      alert('Errore rifiuto: ' + error.message)
      return
    }
    fetchTutto()
  }

  async function handleScollega(linkId: string) {
    const { error } = await supabase
      .from(tableJoin)
      .delete()
      .eq('id', linkId)
    if (error) {
      alert('Errore: ' + error.message)
      return
    }
    fetchTutto()
  }

  async function handleConfermaSuggerito(linkId: string) {
    const { error } = await supabase
      .from(tableJoin)
      .update({ stato: 'confermato' })
      .eq('id', linkId)
    if (error) {
      alert('Errore: ' + error.message)
      return
    }
    fetchTutto()
  }

  // Filtra collegate visibili (escludo i rifiutati dall'elenco principale)
  const collegateVisibili = collegate.filter((c) => c.stato !== 'rifiutato')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-700" />
          <h4 className="text-sm font-semibold text-gray-900">
            Note collegate
          </h4>
          <span className="text-xs text-gray-500">
            ({collegateVisibili.length})
          </span>
        </div>
        <button
          onClick={fetchTutto}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Ricarica
        </button>
      </div>

      {loading && collegateVisibili.length === 0 && candidati.length === 0 ? (
        <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
          Caricamento...
        </div>
      ) : (
        <>
          {collegateVisibili.length === 0 ? (
            <div className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded border border-dashed border-gray-300">
              Nessuna nota ancora collegata.
            </div>
          ) : (
            <div className="space-y-2">
              {collegateVisibili.map((c) => (
                <NotaCollegataCard
                  key={c.link_id}
                  nota={c}
                  onScollega={() => handleScollega(c.link_id)}
                  onConferma={() => handleConfermaSuggerito(c.link_id)}
                />
              ))}
            </div>
          )}

          {candidati.length > 0 && (
            <div className="pt-3 mt-2 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <h5 className="text-sm font-medium text-gray-900">
                  Candidati al collegamento
                </h5>
                <span className="text-xs text-gray-500">
                  ({candidati.length})
                </span>
              </div>
              <div className="space-y-2">
                {candidati.map((c) => (
                  <NotaCandidataCard
                    key={c.nota_id}
                    nota={c}
                    onConferma={() => handleConferma(c.nota_id, c.score)}
                    onRifiuta={() => handleRifiuta(c.nota_id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function NotaCollegataCard({
  nota,
  onScollega,
  onConferma,
}: {
  nota: NotaCollegata
  onScollega: () => void
  onConferma: () => void
}) {
  const dataDisplay = nota.data_riunione
    ? new Date(nota.data_riunione).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  const isSuggested = nota.stato === 'suggerito'

  return (
    <div
      className={`border rounded-lg p-3 flex items-center justify-between gap-3 ${
        isSuggested
          ? 'border-amber-200 bg-amber-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-0.5">
          {dataDisplay && (
            <>
              <Calendar className="w-3 h-3" />
              <span>{dataDisplay}</span>
              <span className="text-gray-300">·</span>
            </>
          )}
          <span>{nota.cliente_denominazione ?? 'Senza cliente'}</span>
          {isSuggested && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-amber-600">suggerito</span>
            </>
          )}
        </div>
        <div className="text-sm text-gray-900 truncate">{nota.titolo}</div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {isSuggested && (
          <button
            onClick={onConferma}
            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
            title="Conferma collegamento"
          >
            <Check className="w-3 h-3" />
            Conferma
          </button>
        )}
        <button
          onClick={onScollega}
          className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
          title="Scollega"
        >
          Scollega
        </button>
      </div>
    </div>
  )
}

function NotaCandidataCard({
  nota,
  onConferma,
  onRifiuta,
}: {
  nota: NotaCandidata
  onConferma: () => void
  onRifiuta: () => void
}) {
  const dataDisplay = nota.data_riunione
    ? new Date(nota.data_riunione).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <div className="border border-gray-200 bg-white rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-0.5">
          {dataDisplay && (
            <>
              <Calendar className="w-3 h-3" />
              <span>{dataDisplay}</span>
              <span className="text-gray-300">·</span>
            </>
          )}
          <span>{nota.cliente_denominazione ?? 'Senza cliente'}</span>
          <span className="text-gray-300">·</span>
          <span className="font-mono text-gray-500">
            match {(nota.score * 100).toFixed(0)}%
          </span>
        </div>
        <div className="text-sm text-gray-900 truncate">{nota.titolo}</div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onConferma}
          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
        >
          <Check className="w-3 h-3" />
          Collega
        </button>
        <button
          onClick={onRifiuta}
          className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          Ignora
        </button>
      </div>
    </div>
  )
}
