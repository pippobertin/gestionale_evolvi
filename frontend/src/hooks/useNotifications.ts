'use client'

import { useEffect, useState, useCallback } from 'react'

export interface Notification {
  id: string
  title: string
  message: string
  time: string
  type: 'warning' | 'success' | 'info'
  unread: boolean
  link?: string
}

const STORAGE_KEY = 'evolvi_read_notifications'

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as { ids: string[]; ts: number }
    // Expire after 30 days
    if (Date.now() - parsed.ts > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY)
      return new Set()
    }
    return new Set(parsed.ids)
  } catch {
    return new Set()
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: [...ids], ts: Date.now() }))
  } catch { /* quota exceeded, ignore */ }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applyReadState = useCallback((notifs: Notification[]): Notification[] => {
    const readIds = getReadIds()
    return notifs.map(n => readIds.has(n.id) ? { ...n, unread: false } : n)
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/notifications/recent')
      const data = await response.json()

      if (data.success) {
        const withReadState = applyReadState(data.notifications)
        setNotifications(withReadState)
        setUnreadCount(withReadState.filter(n => n.unread).length)
        setError(null)
      } else {
        setError(data.error || 'Errore durante il caricamento')
        setNotifications([])
        setUnreadCount(0)
      }
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setError('Errore di connessione')
      setNotifications([])
      setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, unread: false } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))

    const readIds = getReadIds()
    readIds.add(notificationId)
    saveReadIds(readIds)
  }

  const markAllAsRead = async () => {
    const readIds = getReadIds()
    notifications.forEach(n => readIds.add(n.id))
    saveReadIds(readIds)

    setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
    setUnreadCount(0)
  }

  useEffect(() => {
    fetchNotifications()

    // Refresh notifications every 3 minutes
    const interval = setInterval(fetchNotifications, 3 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead
  }
}
