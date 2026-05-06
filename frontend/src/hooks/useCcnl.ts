import { useState, useEffect } from 'react'

interface Ccnl {
  id: string
  codice: string
  denominazione: string
  settore: string
}

let cachedCcnl: Ccnl[] | null = null

export function useCcnl() {
  const [ccnlList, setCcnlList] = useState<Ccnl[]>(cachedCcnl || [])
  const [loading, setLoading] = useState(!cachedCcnl)

  useEffect(() => {
    if (cachedCcnl) return
    const fetchCcnl = async () => {
      try {
        const res = await fetch('/api/formazione/ccnl')
        const json = await res.json()
        if (json.success) {
          cachedCcnl = json.data
          setCcnlList(json.data)
        }
      } catch (err) {
        console.error('[useCcnl] Error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchCcnl()
  }, [])

  return { ccnlList, loading }
}
