'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import '../styles/gmail.css'
import {
  Mail, Search, Settings, Archive, Delete, Star, StarOff, Reply, ReplyAll,
  Forward, MoreVertical, Paperclip, Send, X, ChevronLeft, ChevronRight,
  Inbox, Sent, Drafts, Plus, Tag, Check, RefreshCw, Edit3, Trash2, Eye, EyeOff
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
  const [hiddenLabels, setHiddenLabels] = useState<Set<string>>(new Set())
  const [showLabelManager, setShowLabelManager] = useState(false)
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
    return labels.filter(label => label.type === 'system' && !hiddenLabels.has(label.id)).sort((a, b) => {
      const order = ['INBOX', 'STARRED', 'SENT', 'DRAFTS', 'SPAM', 'TRASH']
      return order.indexOf(a.id) - order.indexOf(b.id)
    })
  }

  const getUserLabels = () => {
    return labels.filter(label => label.type === 'user' && !hiddenLabels.has(label.id))
  }

  const getHiddenLabels = () => {
    return labels.filter(label => hiddenLabels.has(label.id))
  }

  const toggleLabelVisibility = (labelId: string) => {
    const newHiddenLabels = new Set(hiddenLabels)
    if (hiddenLabels.has(labelId)) {
      newHiddenLabels.delete(labelId)
    } else {
      newHiddenLabels.add(labelId)
    }
    setHiddenLabels(newHiddenLabels)

    // Save to localStorage
    localStorage.setItem('gmail_hidden_labels', JSON.stringify(Array.from(newHiddenLabels)))
  }

  // Load hidden labels from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gmail_hidden_labels')
    if (saved) {
      try {
        setHiddenLabels(new Set(JSON.parse(saved)))
      } catch (error) {
        console.error('Error loading hidden labels:', error)
      }
    }
  }, [])

  const getLabelIcon = (labelId: string) => {
    switch (labelId) {
      case 'INBOX': return <Inbox className="w-4 h-4" />
      case 'STARRED': return <Star className="w-4 h-4" />
      case 'SENT': return <Send className="w-4 h-4" />
      case 'DRAFTS': return <Edit3 className="w-4 h-4" />
      default: return <Tag className="w-4 h-4" />
    }
  }

  const getLabelName = (labelId: string) => {
    const labelMap: { [key: string]: string } = {
      'INBOX': 'Posta in arrivo',
      'STARRED': 'Speciali',
      'SENT': 'Posta inviata',
      'DRAFTS': 'Bozze',
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
    <div className="bg-white rounded-lg overflow-hidden h-full flex flex-col">
      {/* Gmail Header - Exact replica */}
      <div className="h-16 bg-white flex items-center px-6 border-b border-gray-200">
        <div className="flex items-center gap-6 flex-1">
          {/* Gmail Logo */}
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" className="text-red-500 fill-current">
              <path d="M20 18h2v-8a1 1 0 0 0-1-1h-9v2h8zm-2-8V8l-8 5-8-5v2h16zm2-2a1 1 0 0 1 1 1v8h-2V9h-8V7h9zM2 12h2v-2h14v2H4v6h16v2H2z"/>
            </svg>
            <span className="text-xl text-gray-700">Gmail</span>
          </div>

          {/* Search Bar - Gmail style */}
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Cerca nella posta"
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
                className="w-full pl-10 pr-4 py-3 bg-gray-100 hover:bg-gray-200 focus:bg-white focus:shadow-md focus:outline-none rounded-full transition-all text-sm text-gray-900 placeholder-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  title="Cancella ricerca"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => loadMessages(currentLabel, searchQuery, showUnreadOnly)}
            className="p-3 hover:bg-gray-100 rounded-full"
            title="Aggiorna"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-3 hover:bg-gray-100 rounded-full" title="Impostazioni">
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden bg-white">
        {/* Sidebar - Exact Gmail replica */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="pt-6 pb-4 px-6">
            <button
              onClick={() => setView('compose')}
              className="flex items-center gap-4 pl-6 pr-8 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 hover:shadow-lg transition-all font-medium text-sm min-w-0"
            >
              <Edit3 className="w-5 h-5 flex-shrink-0" />
              <span>Scrivi</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {getSystemLabels().map(label => (
              <button
                key={label.id}
                onClick={() => {
                  setCurrentLabel(label.id)
                  setSelectedMessage(null)
                  setSearchQuery('') // Reset search when changing folder
                  setShowUnreadOnly(false) // Reset filter when changing folder
                }}
                className={`w-full flex items-center justify-between px-6 py-2 text-sm transition-colors hover:bg-gray-100 ${
                  currentLabel === label.id
                    ? 'bg-red-100 text-red-700 font-medium border-r-4 border-red-500'
                    : 'text-gray-700'
                }`}
              >
                <div className="flex items-center gap-4">
                  {getLabelIcon(label.id)}
                  <span>{getLabelName(label.id)}</span>
                </div>
                {(() => {
                  console.log(`🏷️ Label ${label.id}:`, {
                    unread: label.messagesUnread,
                    total: label.messagesTotal,
                    shouldShowUnread: label.id === 'INBOX' && label.messagesUnread && label.messagesUnread > 0,
                    shouldShowTotal: ['SENT', 'DRAFTS', 'TRASH'].includes(label.id) && label.messagesTotal && label.messagesTotal > 0,
                    willDisplay: label.id === 'INBOX' ? `unread: ${label.messagesUnread}` :
                                ['SENT', 'DRAFTS', 'TRASH'].includes(label.id) ? `total: ${label.messagesTotal}` : 'none'
                  })

                  // Show unread count for INBOX only
                  if (label.id === 'INBOX' && label.messagesUnread && label.messagesUnread > 0) {
                    return (
                      <span className="text-xs font-bold bg-gray-800 text-white px-2 py-1 rounded-full min-w-[20px] text-center">
                        {label.messagesUnread}
                      </span>
                    )
                  }
                  // Show total count for SENT, DRAFTS, TRASH (but only if > 0)
                  if (['SENT', 'DRAFTS', 'TRASH'].includes(label.id) && label.messagesTotal && label.messagesTotal > 0) {
                    return (
                      <span className="text-xs font-bold bg-gray-800 text-white px-2 py-1 rounded-full min-w-[20px] text-center">
                        {label.messagesTotal}
                      </span>
                    )
                  }
                  // Hide counter for other labels or when count is 0
                  return null
                })()}
              </button>
            ))}

            {getUserLabels().length > 0 && (
              <>
                <div className="h-px bg-gray-200 my-3 mx-6" />
                <div className="px-6 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Etichette</div>
                {getUserLabels().map(label => (
                  <button
                    key={label.id}
                    onClick={() => setCurrentLabel(label.id)}
                    className={`w-full flex items-center gap-4 px-6 py-2 text-sm transition-colors hover:bg-gray-100 ${
                      currentLabel === label.id
                        ? 'bg-red-100 text-red-700 border-r-4 border-red-500'
                        : 'text-gray-700'
                    }`}
                  >
                    <Tag className="w-4 h-4" />
                    <span>{label.name}</span>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Label Management */}
          <div className="border-t border-gray-200 p-4">
            <button
              onClick={() => setShowLabelManager(!showLabelManager)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Gestisci etichette</span>
            </button>

            {showLabelManager && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <h4 className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wider">Etichette nascoste</h4>
                {getHiddenLabels().length === 0 ? (
                  <p className="text-xs text-gray-500">Nessuna etichetta nascosta</p>
                ) : (
                  <div className="space-y-1">
                    {getHiddenLabels().map(label => (
                      <div key={label.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          {getLabelIcon(label.id)}
                          <span>{getLabelName(label.id)}</span>
                        </div>
                        <button
                          onClick={() => toggleLabelVisibility(label.id)}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Mostra"
                        >
                          <Eye className="w-3 h-3 text-gray-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <h4 className="text-xs font-medium text-gray-700 mt-3 mb-2 uppercase tracking-wider">Etichette visibili</h4>
                <div className="space-y-1">
                  {[...getSystemLabels(), ...getUserLabels()].map(label => (
                    <div key={label.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        {getLabelIcon(label.id)}
                        <span>{getLabelName(label.id)}</span>
                      </div>
                      {label.id !== 'INBOX' && (
                        <button
                          onClick={() => toggleLabelVisibility(label.id)}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Nascondi"
                        >
                          <EyeOff className="w-3 h-3 text-gray-500" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {view === 'compose' ? (
            /* Compose View */
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-4xl">
                <div className="bg-white rounded-lg shadow-lg">
                  <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="text-lg font-medium">Nuovo messaggio</h3>
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
                          className="w-full p-2 border-b border-gray-200 focus:border-blue-500 outline-none text-gray-900 bg-white"
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
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Cc
                          </button>
                        )}
                        {!showBcc && (
                          <button
                            onClick={() => setShowBcc(true)}
                            className="text-xs text-blue-600 hover:underline"
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
                            className="w-full p-2 border-b border-gray-200 focus:border-blue-500 outline-none text-gray-900 bg-white"
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
                            className="w-full p-2 border-b border-gray-200 focus:border-blue-500 outline-none text-gray-900 bg-white"
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
                        className="w-full p-2 border-b border-gray-200 focus:border-blue-500 outline-none text-gray-900 bg-white"
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
                          <div className="mb-2">
                            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                              <Paperclip className="w-4 h-4" />
                              {composeData.attachments.length} allegat{composeData.attachments.length === 1 ? 'o' : 'i'}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {composeData.attachments.map((file, index) => (
                              <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                                  <Paperclip className="w-3 h-3 text-blue-600" />
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
                          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
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
                            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
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
              {/* Message List - Gmail exact layout */}
              <div className="flex-1 border-r border-gray-200 overflow-hidden flex flex-col bg-white">
                {/* Toolbar - Gmail exact replica */}
                <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 bg-white">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMessages(new Set(messages.map(m => m.id)))
                      } else {
                        setSelectedMessages(new Set())
                      }
                    }}
                  />
                  <button
                    onClick={() => loadMessages(currentLabel)}
                    className="p-2 hover:bg-gray-100 rounded-full"
                    title="Aggiorna"
                  >
                    <RefreshCw className="w-4 h-4 text-gray-600" />
                  </button>

                  {selectedMessages.size > 0 ? (
                    <div className="flex items-center gap-1">
                      <button className="p-2 hover:bg-gray-100 rounded-full" title="Archivia">
                        <Archive className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={async () => {
                          const messageIds = Array.from(selectedMessages)
                          await Promise.all(messageIds.map(id => deleteMessage(id)))
                          setSelectedMessages(new Set())
                          loadMessages(currentLabel, searchQuery, showUnreadOnly)
                          loadLabels() // Update counters after bulk deletion
                        }}
                        className="p-2 hover:bg-gray-100 rounded-full"
                        title="Elimina"
                      >
                        <Trash2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-2 hover:bg-gray-100 rounded-full" title="Altri">
                        <MoreVertical className="w-4 h-4 text-gray-600" />
                      </button>
                      <div className="text-sm text-gray-600 ml-2">
                        {selectedMessages.size} selezionat{selectedMessages.size === 1 ? 'o' : 'i'}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span>{messages.length} messaggio{messages.length === 1 ? '' : 'i'}</span>

                      {/* Filter Toggle */}
                      <button
                        onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                        className={`px-2 py-1 text-xs font-medium rounded-full transition-all ${
                          showUnreadOnly
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={showUnreadOnly ? "Mostra tutti i messaggi" : "Mostra solo non letti"}
                      >
                        <div className="flex items-center gap-1">
                          {showUnreadOnly ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {showUnreadOnly ? 'Non letti' : 'Tutti'}
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Messages - Gmail exact styling */}
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-center text-gray-500">
                      <div>
                        <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-lg font-medium text-gray-400 mb-1">Nessun messaggio</p>
                        <p className="text-sm text-gray-400">La tua posta in arrivo è vuota</p>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {messages.map(message => (
                        <div
                          key={message.id}
                          onClick={() => loadMessageDetail(message.id)}
                          className={`relative flex items-center px-4 py-3 cursor-pointer group transition-all duration-200 ${
                            selectedMessage?.id === message.id
                              ? 'bg-blue-100 border-l-8 border-blue-600 shadow-xl ring-2 ring-blue-300 ring-opacity-50 transform scale-[1.01] z-10'
                              : 'hover:bg-gray-50 hover:shadow-sm hover:border-l-2 hover:border-gray-300'
                          } ${
                            isUnread(message) ? 'bg-white' : 'bg-white'
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <div className="flex items-center pr-3">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
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

                          {/* Star Button */}
                          <div className="pr-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                starMessage(message.id)
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                              title={isStarred(message) ? 'Rimuovi stella' : 'Aggiungi stella'}
                            >
                              {isStarred(message) ? (
                                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                              ) : (
                                <StarOff className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </button>
                          </div>

                          {/* Important Badge (if applicable) */}
                          {message.labelIds.includes('IMPORTANT') && (
                            <div className="pr-2">
                              <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                            </div>
                          )}

                          {/* Sender/Recipient */}
                          <div className="min-w-0 w-52 pr-4">
                            <div className={`text-sm truncate ${
                              isUnread(message)
                                ? 'font-semibold text-gray-900'
                                : 'font-normal text-gray-700'
                            }`}>
                              {currentLabel === 'SENT'
                                ? `A: ${getHeader(message, 'to').replace(/".*?"\s*<(.+?)>/, '$1').replace(/<(.+?)>/, '$1')}`
                                : getHeader(message, 'from').replace(/".*?"\s*<(.+?)>/, '$1').replace(/<(.+?)>/, '$1')
                              }
                            </div>
                          </div>

                          {/* Subject and Snippet */}
                          <div className="flex-1 min-w-0 pr-4">
                            <div className={`text-sm truncate ${
                              isUnread(message)
                                ? 'font-medium text-gray-900'
                                : 'font-normal text-gray-600'
                            }`}>
                              <span className="mr-2">
                                {getHeader(message, 'subject') || '(Nessun oggetto)'}
                              </span>
                              {!isUnread(message) && (
                                <span className="text-gray-500 font-normal">
                                  - {message.snippet}
                                </span>
                              )}
                            </div>
                            {isUnread(message) && (
                              <div className="text-xs text-gray-500 mt-0.5 truncate">
                                {message.snippet}
                              </div>
                            )}
                          </div>

                          {/* Attachment Indicator */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="pr-2">
                              <Paperclip className="w-4 h-4 text-gray-400" />
                            </div>
                          )}

                          {/* Date */}
                          <div className="text-xs text-gray-500 w-16 text-right">
                            {formatDate(message.internalDate)}
                          </div>

                          {/* Unread Indicator */}
                          {isUnread(message) && (
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                              <div className="w-2 h-2 bg-blue-600 rounded-full" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Message Detail - Gmail exact styling */}
              <div className="flex-1 overflow-hidden flex flex-col bg-white">
                {selectedMessage ? (
                  <>
                    {/* Message Toolbar */}
                    <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
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
                    <div className="px-6 pt-6 pb-4">
                      <h1 className="text-xl font-normal text-gray-900 mb-4 leading-tight">
                        {getHeader(selectedMessage, 'subject') || '(Nessun oggetto)'}
                      </h1>

                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {/* Avatar placeholder */}
                          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white font-medium text-sm">
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
                                  <div className="w-2 h-2 bg-blue-600 rounded-full" />
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
                    <div className="flex-1 overflow-y-auto px-6">
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
                          <div className="border-t border-gray-200 pt-6">
                            <div className="mb-4">
                              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Paperclip className="w-4 h-4" />
                                {selectedMessage.attachments.length} allegat{selectedMessage.attachments.length === 1 ? 'o' : 'i'}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {selectedMessage.attachments.map((attachment, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                  <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                    <Paperclip className="w-4 h-4 text-blue-600" />
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
                        <div className="border-t border-gray-200 pt-6 mt-8">
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
                              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 transition-colors text-sm"
                            >
                              <Reply className="w-4 h-4" />
                              Rispondi
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 transition-colors text-sm">
                              <ReplyAll className="w-4 h-4" />
                              Rispondi a tutti
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 transition-colors text-sm">
                              <Forward className="w-4 h-4" />
                              Inoltra
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center bg-white">
                    <div className="text-center">
                      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Mail className="w-12 h-12 text-gray-400" />
                      </div>
                      <p className="text-lg font-normal text-gray-500 mb-2">Seleziona una conversazione</p>
                      <p className="text-sm text-gray-400">per leggere i messaggi</p>
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