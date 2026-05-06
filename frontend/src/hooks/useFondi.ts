'use client'

import { useState, useEffect } from 'react'

interface Fondo {
  id: string
  codice: string
  nome: string
  sigla: string
  settori_ccnl: string[]
  url_area_riservata: string | null
  attivo: boolean
}

let cachedFondi: Fondo[] | null = null

export function useFondi() {
  const [fondi, setFondi] = useState<Fondo[]>(cachedFondi || [])
  const [loading, setLoading] = useState(!cachedFondi)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cachedFondi) return

    const fetchFondi = async () => {
      try {
        const res = await fetch('/api/formazione/fondi')
        const data = await res.json()
        if (data.success) {
          cachedFondi = data.data
          setFondi(data.data)
        } else {
          setError(data.error)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Errore caricamento fondi')
      } finally {
        setLoading(false)
      }
    }

    fetchFondi()
  }, [])

  return { fondi, loading, error }
}
