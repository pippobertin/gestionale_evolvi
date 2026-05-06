'use client'

import { useState, useEffect, useRef } from 'react'

export interface GlobalSearchResults {
  clienti: Array<{ id: string; denominazione: string; partita_iva?: string; email?: string }>
  bandi: Array<{ id: string; nome: string; codice_bando?: string; ente_erogatore?: string }>
  progetti: Array<{ id: string; titolo_progetto: string; codice_progetto?: string; cliente_id?: string; cliente_denominazione?: string; bando_nome?: string }>
  prospect: Array<{ id: string; denominazione: string; partita_iva?: string; email?: string; stato: string; motivo_congelamento?: string }>
  scadenze: Array<{ id: string; titolo: string; data_scadenza?: string; stato?: string; progetto_titolo?: string }>
  contratti: Array<{ id: string; numero_contratto: string; stato?: string; cliente_id?: string; cliente_denominazione?: string }>
  fatture: Array<{ id: string; numero_fattura: string; stato_pagamento?: string; cliente_id?: string; cliente_denominazione?: string }>
}

const EMPTY_RESULTS: GlobalSearchResults = {
  clienti: [], bandi: [], progetti: [], prospect: [],
  scadenze: [], contratti: [], fatture: [],
}

export function useGlobalSearch(query: string) {
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY_RESULTS)
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(EMPTY_RESULTS)
      setTotalCount(0)
      setLoading(false)
      return
    }

    setLoading(true)

    const timer = setTimeout(async () => {
      // Cancel previous request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(`/api/search/global?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('Search failed')
        const data = await res.json()
        if (data.success) {
          setResults(data.results)
          setTotalCount(data.totalCount)
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Global search error:', err)
          setResults(EMPTY_RESULTS)
          setTotalCount(0)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, 300)

    return () => {
      clearTimeout(timer)
    }
  }, [query])

  return { results, loading, totalCount }
}
