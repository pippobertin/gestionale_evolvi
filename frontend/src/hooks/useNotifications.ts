'use client'

import { useEffect, useState } from 'react'

export interface Notification {
  id: string
  title: string
  message: string
  time: string
  type: 'warning' | 'success' | 'info'
  unread: boolean
  link?: string
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/notifications/recent')
      const data = await response.json()

      if (data.success) {
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
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
    // Update local state immediately for better UX
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, unread: false } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))

    // TODO: Call API to mark as read in database when implemented
    // await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' })
  }

  const markAllAsRead = async () => {
    // Update local state immediately for better UX
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
    setUnreadCount(0)

    // TODO: Call API to mark all as read in database when implemented
    // await fetch('/api/notifications/mark-all-read', { method: 'POST' })
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
