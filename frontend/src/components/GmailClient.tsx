'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import '../styles/gmail.css'
import {
  Mail, Search, Settings, Archive, Star, StarOff, Reply, ReplyAll,
  Forward, MoreVertical, Paperclip, Send, X, ChevronLeft, ChevronRight,
  Inbox, RefreshCw, Edit3, Trash2, Eye, EyeOff
} from 'lucide-react'

interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  payload: {
    headers: Array<{ name: string; value: string }>
    parts?: Array<{
      mimeType: string
      body: { data?: string; size: number }
      filename?: string
    }>
  }
  labelIds: string[]
  internalDate: string
  sizeEstimate: number
  bodyText?: string
  bodyHtml?: string
  attachments?: Array<{
    filename: string
    mimeType: string
    size: number
    attachmentId: string
  }>
}

interface GmailLabel {
  id: string
  name: string
  messageListVisibility: string
  labelListVisibility: string
  type: string
  messagesTotal?: number
  messagesUnread?: number
}

interface GmailThread {
  id: string
  snippet: string
  historyId: string
  messages: GmailMessage[]
}

interface GmailClientProps {
  isOpen: boolean
  onClose: () => void
}

export default function GmailClient({ isOpen, onClose }: GmailClientProps) {
  console.log('🔄 GmailClient render, isOpen:', isOpen)

  // States
  const [view, setView] = useState<'inbox' | 'compose' | 'search'>('inbox')
  const [messages, setMessages] = useState<GmailMessage[]>([])
  const [labels, setLabels] = useState<GmailLabel[]>([])
  const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null)
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [currentLabel, setCurrentLabel] = useState('INBOX')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const ALLOWED_LABELS = ['INBOX', 'STARRED', 'SENT', 'SPAM', 'TRASH']
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [markAsReadTimer, setMarkAsReadTimer] = useState<NodeJS.Timeout | null>(null)

  // Compose states
  const [composeData, setComposeData] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
    replyTo: null as GmailMessage | null,
    attachments: [] as File[]
  })
  const [sendingEmail, setSendingEmail] = useState(false)
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)

  // Email autocomplete states
  const [emailHistory, setEmailHistory] = useState<string[]>([])
  const [showToSuggestions, setShowToSuggestions] = useState(false)
  const [showCcSuggestions, setShowCcSuggestions] = useState(false)
  const [showBccSuggestions, setShowBccSuggestions] = useState(false)
  const [filteredEmails, setFilteredEmails] = useState<string[]>([])
  const [filteredCcEmails, setFilteredCcEmails] = useState<string[]>([])
  const [filteredBccEmails, setFilteredBccEmails] = useState<string[]>([])

  // Column widths state (percentages)
  const [sidebarWidth, setSidebarWidth] = useState(20) // 20% default
  const [messageListWidth, setMessageListWidth] = useState(40) // 40% default
  const [isResizing, setIsResizing] = useState<'sidebar' | 'messageList' | null>(null)

  // Function to handle file attachment
  const handleFileAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const newFiles = Array.from(files)
      setComposeData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newFiles]
      }))
    }
    // Reset the input so the same file can be selected again
    event.target.value = ''
  }

  // Function to remove attachment
  const removeAttachment = (index: number) => {
    setComposeData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }

  // Email history management
  const loadEmailHistory = () => {
    const saved = localStorage.getItem('gmail_email_history')
    if (saved) {
      setEmailHistory(JSON.parse(saved))
    }
  }

  const saveEmailToHistory = (email: string) => {
    if (email && email.includes('@')) {
      const current = [...emailHistory]
      if (!current.includes(email)) {
        current.unshift(email) // Add to beginning
        if (current.length > 50) current.pop() // Keep only 50 emails
        setEmailHistory(current)
        localStorage.setItem('gmail_email_history', JSON.stringify(current))
      }
    }
  }

  const filterEmails = (input: string, field: 'to' | 'cc' | 'bcc') => {
    if (!input || input.length < 2) {
      if (field === 'to') setFilteredEmails([])
      else if (field === 'cc') setFilteredCcEmails([])
      else if (field === 'bcc') setFilteredBccEmails([])
      return []
    }
    const filtered = emailHistory.filter(email =>
      email.toLowerCase().includes(input.toLowerCase())
    ).slice(0, 10) // Show max 10 suggestions

    if (field === 'to') setFilteredEmails(filtered)
    else if (field === 'cc') setFilteredCcEmails(filtered)
    else if (field === 'bcc') setFilteredBccEmails(filtered)

    return filtered
  }

  const selectEmail = (email: string, field: 'to' | 'cc' | 'bcc') => {
    setComposeData(prev => ({ ...prev, [field]: email }))
    setShowToSuggestions(false)
    setShowCcSuggestions(false)
    setShowBccSuggestions(false)
  }

  // Load Gmail labels - memoized to prevent re-creation
  const loadLabels = useCallback(async () => {
    try {
      console.log('Loading labels...')
      const response = await fetch('/api/gmail/labels', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      })
      const result = await response.json()
      console.log('Labels result:', result)
      if (result.success) {
        console.log('Setting labels:', result.labels.map((l: any) => ({ id: l.id, unread: l.messagesUnread, total: l.messagesTotal })))
        setLabels(result.labels)
      } else {
        console.error('Labels API error:', result.error)
      }
    } catch (error) {
      console.error('Error loading labels:', error)
    }
  }, [])

  // Load messages for current label - memoized
  const loadMessages = useCallback(async (labelId: string, searchQuery = '', unreadOnly = false) => {
    try {
      setLoading(true)
      let url = `/api/gmail/messages?labelIds=${labelId}&maxResults=50`

      // Build the combined query
      let combinedQuery = searchQuery.trim()

      // Add unread filter if enabled
      if (unreadOnly) {
        combinedQuery = combinedQuery ? `${combinedQuery} is:unread` : 'is:unread'
      }

      // Add query parameter if we have one
      if (combinedQuery) {
        url += `&q=${encodeURIComponent(combinedQuery)}`
      }

      console.log('🔍 Loading messages with query:', combinedQuery)

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      })
      const result = await response.json()
      if (result.success) {
        let filteredMessages = result.messages

        // Apply client-side unread filter if needed (as backup)
        if (unreadOnly && !searchQuery.trim()) {
          filteredMessages = result.messages.filter((msg: GmailMessage) =>
            msg.labelIds && msg.labelIds.includes('UNREAD')
          )
          console.log('📧 Client-side unread filter applied, found:', filteredMessages.length, 'unread messages')
        }

        setMessages(filteredMessages)
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load data on open - only when opening Gmail client
  useEffect(() => {
    console.log('📧 GmailClient useEffect [isOpen]:', isOpen)
    if (isOpen) {
      console.log('🔍 Loading initial data...')
      loadLabels()
      loadMessages(currentLabel, searchQuery, showUnreadOnly)
      loadEmailHistory() // Load email history for autocomplete
    }
  }, [isOpen, loadLabels, loadMessages, currentLabel])

  // Load messages when label, search or filter changes
  useEffect(() => {
    if (isOpen && currentLabel) {
      loadMessages(currentLabel, searchQuery, showUnreadOnly)
    }
  }, [currentLabel, isOpen, loadMessages, searchQuery, showUnreadOnly])

  // Cleanup timer on unmount or when Gmail client closes
  useEffect(() => {
    return () => {
      if (markAsReadTimer) {
        clearTimeout(markAsReadTimer)
      }
    }
  }, [markAsReadTimer])

  useEffect(() => {
    if (!isOpen && markAsReadTimer) {
      clearTimeout(markAsReadTimer)
      setMarkAsReadTimer(null)
    }
  }, [isOpen, markAsReadTimer])

  // Get message details
  const loadMessageDetail = async (messageId: string) => {
    try {
      // Clear any existing timer
      if (markAsReadTimer) {
        clearTimeout(markAsReadTimer)
      }

      const response = await fetch(`/api/gmail/messages/${messageId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      })
      const result = await response.json()
      if (result.success) {
        setSelectedMessage(result.message)

        // Auto-mark as read after 1 second if message is unread
        const isMessageUnread = result.message.labelIds?.includes('UNREAD')
        if (isMessageUnread) {
          const timer = setTimeout(async () => {
            try {
              console.log('🔄 Auto-marking message as read after 1 second...')
              await fetch(`/api/gmail/messages/${messageId}/read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
              })
              // Update local state without refreshing the entire list
              setSelectedMessage(prev => prev ? {
                ...prev,
                labelIds: prev.labelIds?.filter(id => id !== 'UNREAD') || []
              } : null)

              // Update message in the local messages array
              setMessages(prevMessages =>
                prevMessages.map(msg =>
                  msg.id === messageId
                    ? { ...msg, labelIds: msg.labelIds?.filter(id => id !== 'UNREAD') || [] }
                    : msg
                )
              )

              // Only update counters, not the entire message list
              loadLabels()
            } catch (error) {
              console.error('Error auto-marking message as read:', error)
            }
          }, 1000)
          setMarkAsReadTimer(timer)
        }
      }
    } catch (error) {
      console.error('Error loading message detail:', error)
    }
  }

  // Send email
  const sendEmail = async () => {
    if (!composeData.to || !composeData.subject) {
      alert('Inserisci destinatario e oggetto')
      return
    }

    try {
      setLoading(true)
      console.log('Sending email:', composeData)

      // Prepare FormData for files or JSON for simple emails
      let requestBody: FormData | string
      let headers: Record<string, string> = {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }

      if (composeData.attachments.length > 0) {
        // Use FormData for emails with attachments
        const formData = new FormData()
        formData.append('to', composeData.to)
        if (composeData.cc) formData.append('cc', composeData.cc)
        if (composeData.bcc) formData.append('bcc', composeData.bcc)
        formData.append('subject', composeData.subject)
        formData.append('body', composeData.body)
        if (composeData.replyTo) formData.append('replyTo', JSON.stringify(composeData.replyTo))

        // Add attachments
        composeData.attachments.forEach((file, index) => {
          formData.append(`attachments`, file)
        })

        requestBody = formData
      } else {
        // Use JSON for simple emails without attachments
        headers['Content-Type'] = 'application/json'
        requestBody = JSON.stringify(composeData)
      }

      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers,
        body: requestBody
      })

      const result = await response.json()
      console.log('Send email result:', result)

      if (result.success) {
        // Save emails to history
        saveEmailToHistory(composeData.to)
        if (composeData.cc) saveEmailToHistory(composeData.cc)
        if (composeData.bcc) saveEmailToHistory(composeData.bcc)

        alert('✅ Email inviata con successo!')
        setView('inbox')
        setComposeData({ to: '', cc: '', bcc: '', subject: '', body: '', replyTo: null, attachments: [] })
        setShowCc(false)
        setShowBcc(false)

        // Reload labels to update counters
        loadLabels()

        // Reload messages for current label
        loadMessages(currentLabel, searchQuery, showUnreadOnly)

        // If we're in SENT folder, reload to show new message after delay
        if (currentLabel === 'SENT') {
          setTimeout(() => {
            loadMessages('SENT', searchQuery, showUnreadOnly)
            loadLabels() // Update counters again
          }, 2000)
        }
      } else {
        alert(`❌ Errore invio email: ${result.error}`)
      }
    } catch (error: any) {
      console.error('Error sending email:', error)
      alert(`❌ Errore invio email: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Handle message actions
  const markAsRead = async (messageId: string) => {
    await fetch(`/api/gmail/messages/${messageId}/markAsRead`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
    })
    loadMessages(currentLabel)
  }

  const starMessage = async (messageId: string) => {
    await fetch(`/api/gmail/messages/${messageId}/star`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
    })
    loadMessages(currentLabel)
  }

  const deleteMessage = async (messageId: string) => {
    // If we're in TRASH, delete permanently, otherwise move to trash
    const permanent = currentLabel === 'TRASH'
    const url = permanent
      ? `/api/gmail/messages/${messageId}?permanent=true`
      : `/api/gmail/messages/${messageId}`

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
    })

    const result = await response.json()
    if (result.success) {
      console.log('✅ Delete result:', result.message)
    } else {
      console.error('❌ Delete error:', result.error)
      alert(`Errore durante l'eliminazione: ${result.error}`)
    }

    loadMessages(currentLabel, searchQuery, showUnreadOnly)

    // Update counters after deletion with delay for permanent deletions
    if (permanent) {
      setTimeout(() => {
        loadLabels()
      }, 1000) // Wait 1 second for Gmail to process permanent deletion
    } else {
      loadLabels() // Immediate update for moves to trash
    }

    setSelectedMessage(null)
  }

  // Helper functions
  const getHeader = (message: GmailMessage, headerName: string) => {
    return message.payload.headers.find(h => h.name.toLowerCase() === headerName.toLowerCase())?.value || ''
  }

  const isUnread = (message: GmailMessage) => {
    return message.labelIds.includes('UNREAD')
  }

  const isStarred = (message: GmailMessage) => {
    return message.labelIds.includes('STARRED')
  }

  const formatDate = (internalDate: string) => {
    const date = new Date(parseInt(internalDate))
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    if (messageDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    } else if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString('it-IT', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
    }
  }

  const getSystemLabels = () => {
    return labels
      .filter(label => ALLOWED_LABELS.includes(label.id))
      .sort((a, b) => ALLOWED_LABELS.indexOf(a.id) - ALLOWED_LABELS.indexOf(b.id))
  }

  // Load column widths from localStorage
  useEffect(() => {
    const savedSidebar = localStorage.getItem('gmail_sidebar_width')
    const savedMessageList = localStorage.getItem('gmail_messagelist_width')
    if (savedSidebar) setSidebarWidth(parseFloat(savedSidebar))
    if (savedMessageList) setMessageListWidth(parseFloat(savedMessageList))
  }, [])

  // Save column widths to localStorage
  useEffect(() => {
    localStorage.setItem('gmail_sidebar_width', sidebarWidth.toString())
    localStorage.setItem('gmail_messagelist_width', messageListWidth.toString())
  }, [sidebarWidth, messageListWidth])

  // Handle column resizing
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('gmail-main-container')
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const mouseX = e.clientX - containerRect.left
      const percentage = (mouseX / containerRect.width) * 100

      if (isResizing === 'sidebar') {
        // Limit sidebar between 15% and 40%
        const newWidth = Math.max(15, Math.min(40, percentage))
        setSidebarWidth(newWidth)
      } else if (isResizing === 'messageList') {
        // Limit message list between 25% and 60%
        const newWidth = Math.max(25, Math.min(60, percentage - sidebarWidth))
        setMessageListWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, sidebarWidth])

  const getLabelIcon = (labelId: string) => {
    switch (labelId) {
      case 'INBOX': return <Inbox className="w-4 h-4" />
      case 'STARRED': return <Star className="w-4 h-4" />
      case 'SENT': return <Send className="w-4 h-4" />
      case 'SPAM': return <Mail className="w-4 h-4" />
      case 'TRASH': return <Trash2 className="w-4 h-4" />
      default: return <Mail className="w-4 h-4" />
    }
  }

  const getLabelName = (labelId: string) => {
    const labelMap: { [key: string]: string } = {
      'INBOX': 'Posta in arrivo',
      'STARRED': 'Speciali',
      'SENT': 'Posta inviata',
      'SPAM': 'Spam',
      'TRASH': 'Cestino'
    }
    return labelMap[labelId] || labelId
  }

  if (!isOpen) {
    console.log('❌ Gmail not open, returning null')
    return null
  }

  console.log('✅ Gmail is open, rendering interface')

  return (
    <div
      className="bg-white rounded-lg overflow-hidden h-full flex flex-col"
      style={{
        cursor: isResizing ? 'col-resize' : 'auto',
        userSelect: isResizing ? 'none' : 'auto'
      }}
    >
      {/* Header - Evolvi Native */}
      <div className="h-14 flex items-center px-5 gap-5 relative z-10" style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)', boxShadow: '0 2px 8px rgba(13, 148, 136, 0.3)' }}>
        <div className="flex items-center gap-2.5 min-w-[180px]">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}>
            <Mail className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-semibold text-white" style={{ letterSpacing: '-0.3px' }}>Centro Email</span>
        </div>

        {/* Search Bar - Translucent */}
        <div className="flex-1 max-w-xl relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
          </div>
          <input
            type="text"
            placeholder="Cerca nelle email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                loadMessages(currentLabel, searchQuery, showUnreadOnly)
              }
              if (e.key === 'Escape') {
                setSearchQuery('')
              }
            }}
            className="w-full h-9 pl-10 pr-4 border-none rounded-full text-sm outline-none transition-all placeholder:text-white/60"
            style={{ background: 'rgba(255,255,255,0.18)', color: 'white', backdropFilter: 'blur(4px)' }}
            onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; e.currentTarget.style.color = '#1f2937'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(94, 234, 212, 0.4)' }}
            onBlur={(e) => { if (!e.currentTarget.value) { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.boxShadow = 'none' } }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              title="Cancella ricerca"
            >
              <X className="h-4 w-4 text-white/60 hover:text-white" />
            </button>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => loadMessages(currentLabel, searchQuery, showUnreadOnly)}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.12)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            title="Aggiorna"
          >
            <RefreshCw className="w-4 h-4 text-white" />
          </button>
          <button
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.12)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            title="Impostazioni"
          >
            <Settings className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <div id="gmail-main-container" className="flex flex-1 overflow-hidden relative" style={{ background: '#f3f4f6', padding: '6px', gap: '6px' }}>
        {/* Sidebar - Evolvi Native */}
        <div className="flex flex-col gap-2" style={{ width: `${sidebarWidth}%` }}>
          <button
            onClick={() => setView('compose')}
            className="flex items-center justify-center gap-2.5 h-12 rounded-full font-semibold text-sm transition-all w-full"
            style={{ background: 'linear-gradient(135deg, #82D8CF 0%, #5eead4 50%, #2dd4bf 100%)', color: '#134e4a', boxShadow: '0 2px 12px rgba(94, 234, 212, 0.4)', letterSpacing: '-0.2px' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(94, 234, 212, 0.5)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(94, 234, 212, 0.4)' }}
          >
            <Edit3 className="w-4 h-4 flex-shrink-0" />
            <span>Scrivi</span>
          </button>

          <div className="bg-white rounded-xl flex-1 overflow-y-auto p-2" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)' }}>
            {getSystemLabels().map(label => (
              <button
                key={label.id}
                onClick={() => {
                  setCurrentLabel(label.id)
                  setSelectedMessage(null)
                  setSearchQuery('')
                  setShowUnreadOnly(false)
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all relative ${
                  currentLabel === label.id
                    ? 'font-semibold'
                    : 'text-gray-500 font-medium hover:bg-gray-50 hover:text-gray-800'
                }`}
                style={currentLabel === label.id ? {
                  background: 'linear-gradient(135deg, rgba(130, 216, 207, 0.15), rgba(94, 234, 212, 0.12))',
                  color: '#0f766e'
                } : {}}
              >
                {currentLabel === label.id && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-sm" style={{ background: 'linear-gradient(180deg, #82D8CF, #5eead4)' }} />
                )}
                {getLabelIcon(label.id)}
                <span className="flex-1 text-left">{getLabelName(label.id)}</span>
                {(() => {
                  if (label.id === 'INBOX' && label.messagesUnread && label.messagesUnread > 0) {
                    return (
                      <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full min-w-[22px] text-center" style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6)' }}>
                        {label.messagesUnread}
                      </span>
                    )
                  }
                  if (['SENT', 'TRASH'].includes(label.id) && label.messagesTotal && label.messagesTotal > 0) {
                    return (
                      <span className="text-xs font-medium text-gray-400 px-1.5">
                        {label.messagesTotal}
                      </span>
                    )
                  }
                  return null
                })()}
              </button>
            ))}
          </div>
        </div>

        {/* Resizer for Sidebar */}
        <div
          className="w-1 hover:bg-teal-400 cursor-col-resize transition-colors relative group rounded"
          onMouseDown={() => setIsResizing('sidebar')}
          style={{ cursor: isResizing === 'sidebar' ? 'col-resize' : 'auto' }}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Main Content */}
        <div className="flex overflow-hidden" style={{ width: `${100 - sidebarWidth}%`, gap: '6px' }}>
          {view === 'compose' ? (
            /* Compose View */
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="max-w-4xl">
                <div className="bg-white rounded-lg shadow-lg">
                  <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="text-sm font-medium">Nuovo messaggio</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setView('inbox')
                          setComposeData({ to: '', cc: '', bcc: '', subject: '', body: '', replyTo: null, attachments: [] })
                          setShowCc(false)
                          setShowBcc(false)
                        }}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors font-medium"
                        title="Chiudi compositore"
                      >
                        Chiudi
                      </button>
                      <button
                        onClick={() => {
                          setView('inbox')
                          setComposeData({ to: '', cc: '', bcc: '', subject: '', body: '', replyTo: null, attachments: [] })
                          setShowCc(false)
                          setShowBcc(false)
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                        title="Chiudi compositore"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-1">
                    <div className="flex items-center">
                      <div className="w-8 text-xs text-gray-500 mr-3">A</div>
                      <div className="flex-1 relative">
                        <input
                          type="email"
                          placeholder="Destinatari"
                          value={composeData.to}
                          onChange={(e) => {
                            const value = e.target.value
                            setComposeData({...composeData, to: value})
                            filterEmails(value, 'to')
                          }}
                          onFocus={() => setShowToSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowToSuggestions(false), 200)}
                          className="w-full p-2 border-b border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                        />
                        {showToSuggestions && filteredEmails.length > 0 && (
                          <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
                            {filteredEmails.map((email, index) => (
                              <div
                                key={index}
                                onClick={() => selectEmail(email, 'to')}
                                className="px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm text-gray-700 border-b border-gray-100 last:border-b-0"
                              >
                                {email}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="ml-2 flex items-center gap-2">
                        {!showCc && (
                          <button
                            onClick={() => setShowCc(true)}
                            className="text-xs text-teal-600 hover:underline"
                          >
                            Cc
                          </button>
                        )}
                        {!showBcc && (
                          <button
                            onClick={() => setShowBcc(true)}
                            className="text-xs text-teal-600 hover:underline"
                          >
                            Ccn
                          </button>
                        )}
                      </div>
                    </div>

                    {showCc && (
                      <div className="flex items-center">
                        <div className="w-8 text-xs text-gray-500 mr-3">Cc</div>
                        <div className="flex-1 relative">
                          <input
                            type="email"
                            placeholder="Destinatari in copia"
                            value={composeData.cc}
                            onChange={(e) => {
                              const value = e.target.value
                              setComposeData({...composeData, cc: value})
                              filterEmails(value, 'cc')
                            }}
                            onFocus={() => setShowCcSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowCcSuggestions(false), 200)}
                            className="w-full p-2 border-b border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                          />
                          {showCcSuggestions && filteredCcEmails.length > 0 && (
                            <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
                              {filteredCcEmails.map((email, index) => (
                                <div
                                  key={index}
                                  onClick={() => selectEmail(email, 'cc')}
                                  className="px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm text-gray-700 border-b border-gray-100 last:border-b-0"
                                >
                                  {email}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setShowCc(false)
                            setComposeData({...composeData, cc: ''})
                          }}
                          className="ml-2 p-1 hover:bg-gray-100 rounded"
                        >
                          <X className="w-3 h-3 text-gray-500" />
                        </button>
                      </div>
                    )}

                    {showBcc && (
                      <div className="flex items-center">
                        <div className="w-8 text-xs text-gray-500 mr-3">Ccn</div>
                        <div className="flex-1 relative">
                          <input
                            type="email"
                            placeholder="Destinatari in copia nascosta"
                            value={composeData.bcc}
                            onChange={(e) => {
                              const value = e.target.value
                              setComposeData({...composeData, bcc: value})
                              filterEmails(value, 'bcc')
                            }}
                            onFocus={() => setShowBccSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowBccSuggestions(false), 200)}
                            className="w-full p-2 border-b border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                          />
                          {showBccSuggestions && filteredBccEmails.length > 0 && (
                            <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
                              {filteredBccEmails.map((email, index) => (
                                <div
                                  key={index}
                                  onClick={() => selectEmail(email, 'bcc')}
                                  className="px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm text-gray-700 border-b border-gray-100 last:border-b-0"
                                >
                                  {email}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setShowBcc(false)
                            setComposeData({...composeData, bcc: ''})
                          }}
                          className="ml-2 p-1 hover:bg-gray-100 rounded"
                        >
                          <X className="w-3 h-3 text-gray-500" />
                        </button>
                      </div>
                    )}

                    <div className="pt-2">
                      <input
                        type="text"
                        placeholder="Oggetto"
                        value={composeData.subject}
                        onChange={(e) => setComposeData({...composeData, subject: e.target.value})}
                        className="w-full p-2 border-b border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                      />
                    </div>

                    <div>
                      <textarea
                        placeholder="Scrivi il messaggio..."
                        value={composeData.body}
                        onChange={(e) => setComposeData({...composeData, body: e.target.value})}
                        rows={15}
                        className="w-full p-2 resize-none outline-none text-gray-900 bg-white"
                      />

                      {/* Attachments Display */}
                      {composeData.attachments.length > 0 && (
                        <div className="border-t border-gray-200 p-4">
                          <div className="mb-1">
                            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                              <Paperclip className="w-4 h-4" />
                              {composeData.attachments.length} allegat{composeData.attachments.length === 1 ? 'o' : 'i'}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {composeData.attachments.map((file, index) => (
                              <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                <div className="w-4 h-4 bg-teal-100 rounded flex items-center justify-center">
                                  <Paperclip className="w-3 h-3 text-teal-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">
                                    {file.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {(file.size / 1024).toFixed(1)} KB • {file.type || 'File'}
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeAttachment(index)}
                                  className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-red-500"
                                  title="Rimuovi allegato"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={sendEmail}
                          disabled={loading || !composeData.to || !composeData.subject}
                          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-medium"
                          style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6)', boxShadow: '0 1px 4px rgba(94, 234, 212, 0.3)' }}
                        >
                          <Send className="w-4 h-4" />
                          {loading ? 'Invio...' : 'Invia'}
                        </button>
                        <button
                          className="p-2 hover:bg-gray-100 rounded relative"
                          onClick={() => document.getElementById('file-input')?.click()}
                          title="Allega file"
                        >
                          <Paperclip className="w-5 h-5 text-gray-600" />
                          {composeData.attachments.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-teal-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              {composeData.attachments.length}
                            </span>
                          )}
                        </button>
                        <input
                          id="file-input"
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleFileAttachment}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Message List - Evolvi Native */}
              <div className="overflow-hidden flex flex-col bg-white rounded-xl" style={{ width: `${messageListWidth}%`, boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)' }}>
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{getLabelName(currentLabel)}</span>
                    <span className="text-xs text-gray-400">
                      {messages.length} messagg{messages.length === 1 ? 'io' : 'i'}
                      {(() => {
                        const unreadCount = messages.filter(m => isUnread(m)).length
                        return unreadCount > 0 ? `, ${unreadCount} non lett${unreadCount === 1 ? 'o' : 'i'}` : ''
                      })()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {selectedMessages.size > 0 ? (
                      <>
                        <span className="text-xs text-gray-500 mr-1">{selectedMessages.size}</span>
                        <button className="p-1.5 hover:bg-gray-100 rounded-md" title="Archivia">
                          <Archive className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={async () => {
                            const messageIds = Array.from(selectedMessages)
                            await Promise.all(messageIds.map(id => deleteMessage(id)))
                            setSelectedMessages(new Set())
                            loadMessages(currentLabel, searchQuery, showUnreadOnly)
                            loadLabels()
                          }}
                          className="p-1.5 hover:bg-gray-100 rounded-md"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4 text-gray-400" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-100 rounded-md" title="Altri">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </>
                    ) : (
                      <>
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 mr-1"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMessages(new Set(messages.map(m => m.id)))
                            } else {
                              setSelectedMessages(new Set())
                            }
                          }}
                          title="Seleziona tutti"
                        />
                        <button
                          onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                          className={`px-2 py-1 text-[11px] font-medium rounded-full transition-all ${
                            showUnreadOnly
                              ? 'bg-teal-100 text-teal-700 border border-teal-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                          title={showUnreadOnly ? "Mostra tutti" : "Solo non letti"}
                        >
                          <div className="flex items-center gap-1">
                            {showUnreadOnly ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            {showUnreadOnly ? 'Non letti' : 'Tutti'}
                          </div>
                        </button>
                        <button className="p-1.5 hover:bg-gray-100 rounded-md" title="Altri">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Messages - Evolvi Native layout */}
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-center text-gray-500">
                      <div>
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'linear-gradient(135deg, rgba(130, 216, 207, 0.15), rgba(94, 234, 212, 0.1))' }}>
                          <Inbox className="w-8 h-8 text-teal-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-400 mb-1">Nessun messaggio</p>
                        <p className="text-xs text-gray-400">La tua posta in arrivo è vuota</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {messages.map(message => {
                        const senderName = currentLabel === 'SENT'
                          ? getHeader(message, 'to').replace(/".*?"\s*<(.+?)>/, '$1').replace(/<(.+?)>/, '$1')
                          : getHeader(message, 'from').replace(/".*?"\s*<(.+?)>/, '$1').replace(/<(.+?)>/, '$1')
                        const initials = senderName.replace(/^A:\s*/, '').trim().split(/\s+/).map(w => w.charAt(0).toUpperCase()).slice(0, 2).join('')
                        // Deterministic avatar color from sender name
                        const avatarColors = [
                          { bg: '#dbeafe', fg: '#1e40af' },
                          { bg: '#fce7f3', fg: '#9d174d' },
                          { bg: '#d1fae5', fg: '#065f46' },
                          { bg: '#fef3c7', fg: '#92400e' },
                          { bg: '#e0e7ff', fg: '#3730a3' },
                          { bg: '#fae8ff', fg: '#86198f' },
                          { bg: '#ccfbf1', fg: '#0f766e' },
                          { bg: '#fee2e2', fg: '#991b1b' },
                        ]
                        const colorIdx = senderName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % avatarColors.length
                        const avatarColor = avatarColors[colorIdx]

                        return (
                          <div
                            key={message.id}
                            onClick={() => loadMessageDetail(message.id)}
                            className={`relative flex items-start gap-3 px-4 py-3.5 cursor-pointer group transition-all duration-150 border-b border-gray-50 ${
                              selectedMessage?.id === message.id
                                ? 'border-l-[3px]'
                                : 'hover:bg-gray-50'
                            }`}
                            style={selectedMessage?.id === message.id ? {
                              background: 'linear-gradient(135deg, rgba(130, 216, 207, 0.08), rgba(94, 234, 212, 0.06))',
                              borderLeftColor: '#2dd4bf',
                              paddingLeft: '13px'
                            } : {}}
                          >
                            {/* Unread Indicator - left side */}
                            {isUnread(message) && (
                              <div className="absolute left-1.5 top-1/2 -translate-y-1/2">
                                <div className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                              </div>
                            )}

                            {/* Checkbox */}
                            <div className="flex items-center pt-1">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                checked={selectedMessages.has(message.id)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedMessages)
                                  if (e.target.checked) {
                                    newSelected.add(message.id)
                                  } else {
                                    newSelected.delete(message.id)
                                  }
                                  setSelectedMessages(newSelected)
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>

                            {/* Avatar */}
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5"
                              style={{ background: avatarColor.bg, color: avatarColor.fg }}
                            >
                              {initials || '?'}
                            </div>

                            {/* Content: sender / subject / snippet stacked */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-[13px] truncate ${
                                  isUnread(message) ? 'font-bold text-gray-900' : 'font-medium text-gray-700'
                                }`}>
                                  {currentLabel === 'SENT' ? `A: ${senderName}` : senderName}
                                </span>
                                <span className="text-[11.5px] text-gray-400 flex-shrink-0">
                                  {formatDate(message.internalDate)}
                                </span>
                              </div>
                              <div className={`text-[13px] truncate mt-0.5 ${
                                isUnread(message) ? 'font-semibold text-gray-800' : 'font-medium text-gray-600'
                              }`}>
                                {getHeader(message, 'subject') || '(Nessun oggetto)'}
                              </div>
                              <div className="text-[12.5px] text-gray-400 truncate mt-0.5 leading-snug">
                                {message.snippet}
                              </div>
                            </div>

                            {/* Star */}
                            <div className="flex-shrink-0 pt-0.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  starMessage(message.id)
                                }}
                                className="p-1 hover:bg-gray-100 rounded"
                                title={isStarred(message) ? 'Rimuovi stella' : 'Aggiungi stella'}
                              >
                                {isStarred(message) ? (
                                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                ) : (
                                  <StarOff className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Resizer for Message List */}
              <div
                className="w-1 hover:bg-teal-400 cursor-col-resize transition-colors relative group rounded"
                onMouseDown={() => setIsResizing('messageList')}
                style={{ cursor: isResizing === 'messageList' ? 'col-resize' : 'auto' }}
              >
                <div className="absolute inset-y-0 -left-1 -right-1" />
              </div>

              {/* Message Detail - Evolvi Native */}
              <div className="overflow-hidden flex flex-col bg-white rounded-xl flex-1 min-w-0" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)' }}>
                {selectedMessage ? (
                  <>
                    {/* Message Toolbar */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            const messageIndex = messages.findIndex(m => m.id === selectedMessage.id)
                            if (messageIndex > 0) {
                              loadMessageDetail(messages[messageIndex - 1].id)
                            }
                          }}
                          className="p-2 hover:bg-gray-100 rounded-full"
                          title="Messaggio precedente"
                        >
                          <ChevronLeft className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => {
                            const messageIndex = messages.findIndex(m => m.id === selectedMessage.id)
                            if (messageIndex < messages.length - 1) {
                              loadMessageDetail(messages[messageIndex + 1].id)
                            }
                          }}
                          className="p-2 hover:bg-gray-100 rounded-full"
                          title="Messaggio successivo"
                        >
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteMessage(selectedMessage.id)}
                          className="p-2 hover:bg-gray-100 rounded-full"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4 text-gray-600" />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-full" title="Altri">
                          <MoreVertical className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>

                    {/* Message Header */}
                    <div className="px-4 pt-3 pb-4">
                      <h1 className="text-sm font-normal text-gray-900 mb-4 leading-tight">
                        {getHeader(selectedMessage, 'subject') || '(Nessun oggetto)'}
                      </h1>

                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {/* Avatar placeholder */}
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm" style={{ background: 'linear-gradient(135deg, #82D8CF, #5eead4)', color: '#134e4a' }}>
                            {getHeader(selectedMessage, 'from').charAt(0).toUpperCase()}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900 text-sm">
                                {getHeader(selectedMessage, 'from').replace(/".*?"\s*<(.+?)>/, '$1').replace(/<(.+?)>/, '$1')}
                              </span>
                              <div className="text-xs text-gray-500 flex items-center gap-2">
                                <span>{new Date(parseInt(selectedMessage.internalDate)).toLocaleString('it-IT')}</span>
                                {isUnread(selectedMessage) && (
                                  <div className="w-2 h-2 bg-teal-500 rounded-full" />
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-gray-600">
                              a {getHeader(selectedMessage, 'to')}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setComposeData({
                                ...composeData,
                                to: getHeader(selectedMessage, 'from'),
                                subject: `Re: ${getHeader(selectedMessage, 'subject')}`,
                                replyTo: selectedMessage
                              })
                              setView('compose')
                            }}
                            className="p-2 hover:bg-gray-100 rounded-full"
                            title="Rispondi"
                          >
                            <Reply className="w-4 h-4 text-gray-600" />
                          </button>
                          <button className="p-2 hover:bg-gray-100 rounded-full" title="Rispondi a tutti">
                            <ReplyAll className="w-4 h-4 text-gray-600" />
                          </button>
                          <button className="p-2 hover:bg-gray-100 rounded-full" title="Inoltra">
                            <Forward className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => starMessage(selectedMessage.id)}
                            className="p-2 hover:bg-gray-100 rounded-full"
                            title={isStarred(selectedMessage) ? 'Rimuovi stella' : 'Aggiungi stella'}
                          >
                            {isStarred(selectedMessage) ? (
                              <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            ) : (
                              <StarOff className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Message Body - Gmail styling */}
                    <div className="flex-1 overflow-y-auto px-4">
                      <div className="py-4">
                        {/* Body Content */}
                        <div className="mb-6">
                          {selectedMessage.bodyHtml ? (
                            <div
                              className="gmail-body-content text-sm"
                              dangerouslySetInnerHTML={{ __html: selectedMessage.bodyHtml }}
                              style={{
                                fontFamily: 'Roboto, RobotoDraft, Helvetica, Arial, sans-serif',
                                fontSize: '14px',
                                lineHeight: '1.43',
                                color: '#202124',
                                wordWrap: 'break-word'
                              }}
                            />
                          ) : selectedMessage.bodyText ? (
                            <div className="text-sm text-gray-900 whitespace-pre-wrap leading-normal" style={{ fontFamily: 'Roboto, RobotoDraft, Helvetica, Arial, sans-serif' }}>
                              {selectedMessage.bodyText}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-700 leading-normal" style={{ fontFamily: 'Roboto, RobotoDraft, Helvetica, Arial, sans-serif' }}>
                              {selectedMessage.snippet}
                            </div>
                          )}
                        </div>

                        {/* Attachments - Gmail style */}
                        {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                          <div className="border-t border-gray-200 pt-3">
                            <div className="mb-4">
                              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Paperclip className="w-4 h-4" />
                                {selectedMessage.attachments.length} allegat{selectedMessage.attachments.length === 1 ? 'o' : 'i'}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {selectedMessage.attachments.map((attachment, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                  <div className="w-8 h-8 bg-teal-50 rounded flex items-center justify-center">
                                    <Paperclip className="w-4 h-4 text-teal-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                      {attachment.filename}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {(attachment.size / 1024).toFixed(1)} KB • {attachment.mimeType}
                                    </div>
                                  </div>
                                  <button className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors">
                                    Scarica
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Reply Section */}
                        <div className="border-t border-gray-200 pt-3 mt-8">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setComposeData({
                                  ...composeData,
                                  to: getHeader(selectedMessage, 'from'),
                                  subject: `Re: ${getHeader(selectedMessage, 'subject')}`,
                                  replyTo: selectedMessage
                                })
                                setView('compose')
                              }}
                              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all"
                              style={{ background: 'linear-gradient(135deg, #82D8CF, #5eead4)', color: '#134e4a', boxShadow: '0 1px 4px rgba(94, 234, 212, 0.3)' }}
                            >
                              <Reply className="w-4 h-4" />
                              Rispondi
                            </button>
                            <button className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors text-sm font-medium">
                              <ReplyAll className="w-4 h-4" />
                              Rispondi a tutti
                            </button>
                            <button className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors text-sm font-medium">
                              <Forward className="w-4 h-4" />
                              Inoltra
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, rgba(130, 216, 207, 0.15), rgba(94, 234, 212, 0.1))' }}>
                        <Mail className="w-12 h-12 text-teal-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Seleziona una conversazione</p>
                      <p className="text-xs text-gray-400">per leggere i messaggi</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}