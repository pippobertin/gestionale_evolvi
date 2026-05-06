'use client'

import { useEffect, useState } from 'react'

export function useUnreadEmailCount() {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUnreadCount = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/gmail/unread-count')
      const data = await response.json()

      if (data.success) {
        setCount(data.count)
        setError(null)
      } else {
        setError(data.error || 'Errore durante il caricamento')
        setCount(0)
      }
    } catch (err) {
      console.error('Error fetching unread email count:', err)
      setError('Errore di connessione')
      setCount(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUnreadCount()

    // Refresh count every 2 minutes
    const interval = setInterval(fetchUnreadCount, 2 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return {
    count,
    loading,
    error,
    refresh: fetchUnreadCount
  }
}
