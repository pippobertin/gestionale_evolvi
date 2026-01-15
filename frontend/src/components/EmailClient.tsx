'use client'

import React, { useState, useEffect } from 'react'
import {
  Mail, Plus, Settings, Search, Star, Trash2, Send, Paperclip, X, ArrowLeft, ArrowRight,
  RefreshCw, Reply, Forward, Link, Download, Edit3, Inbox, Clock, Flag, Users, Edit, Trash,
  MoreVertical, ChevronDown
} from 'lucide-react'
import EmailAccountSetup from './EmailAccountSetup'
import { useScrollLock } from '@/hooks/useScrollLock'

interface EmailAccount {
  id: string
  name: string
  email_address: string
  provider_type: string
  is_active: boolean
  last_sync?: string
  sync_status: string
}

interface EmailFolder {
  id: string
  name: string
  full_path: string
  folder_type: string
  unread_messages: number
  total_messages: number
}

interface EmailMessage {
  id: string
  subject?: string
  from_address: string
  from_name?: string
  to_addresses: string[]
  body_preview?: string
  date_sent: string
  is_read: boolean
  is_flagged: boolean
  has_attachments: boolean
}

interface EmailAttachment {
  name: string
  size: number
  type: string
  part?: string
}

interface EmailMessageDetail extends EmailMessage {
  message_id: string
  cc_addresses?: string[]
  body_text?: string
  body_html?: string
  date_received: string
  size_bytes?: number
  attachments?: EmailAttachment[]
}

interface EmailClientProps {
  isOpen: boolean
  onClose: () => void
}

export default function EmailClient({ isOpen, onClose }: EmailClientProps) {
  const [view, setView] = useState<'inbox' | 'setup' | 'accounts' | 'compose'>('inbox')
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [folders, setFolders] = useState<EmailFolder[]>([])
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null)
  const [selectedFolder, setSelectedFolder] = useState<EmailFolder | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null)
  const [selectedMessageDetail, setSelectedMessageDetail] = useState<EmailMessageDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [composeData, setComposeData] = useState({
    to: '',
    cc: '',
    subject: '',
    body: '',
    replyTo: null as EmailMessageDetail | null
  })
  const [attachments, setAttachments] = useState<File[]>([])

  // Stati per la gestione degli account
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [accountFormData, setAccountFormData] = useState({
    name: '',
    email_address: '',
    username: '',
    encrypted_password: '',
    provider_type: 'aruba',
    imap_server: 'imaps.aruba.it',
    imap_port: 993,
    imap_secure: true,
    smtp_server: 'smtps.aruba.it',
    smtp_port: 465,
    smtp_secure: true
  })

  // Blocca scroll del body quando modal è aperto
  useScrollLock(isOpen)

  // Carica account all'apertura
  useEffect(() => {
    if (isOpen) {
      loadAccounts()
    }
  }, [isOpen])

  // Gestione click fuori dal dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showAccountDropdown) {
        const target = event.target as Element
        if (!target.closest('.account-dropdown')) {
          setShowAccountDropdown(false)
        }
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showAccountDropdown])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/email/accounts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      const result = await response.json()
      if (result.success) {
        setAccounts(result.data)
        // Seleziona primo account attivo
        const activeAccount = result.data.find((acc: EmailAccount) => acc.is_active)
        if (activeAccount) {
          setSelectedAccount(activeAccount)
          loadFolders(activeAccount.id)
        }
      }
    } catch (error) {
      console.error('Errore caricamento accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadFolders = async (accountId: string) => {
    try {
      const response = await fetch(`/api/email/folders/${accountId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      const result = await response.json()
      if (result.success) {
        setFolders(result.data)
        // Seleziona INBOX di default
        const inboxFolder = result.data.find((f: EmailFolder) =>
          f.folder_type === 'INBOX' || f.name.toLowerCase() === 'inbox'
        )
        if (inboxFolder) {
          setSelectedFolder(inboxFolder)
          loadMessages(inboxFolder.id)
        }
      }
    } catch (error) {
      console.error('Errore caricamento folders:', error)
    }
  }

  const loadMessages = async (folderId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/email/messages/${folderId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      const result = await response.json()
      if (result.success) {
        setMessages(result.data)
      }
    } catch (error) {
      console.error('Errore caricamento messaggi:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMessageDetail = async (messageId: string) => {
    try {
      setLoadingDetail(true)
      const response = await fetch(`/api/email/message/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      const result = await response.json()
      if (result.success) {
        setSelectedMessageDetail(result.data)
      }
    } catch (error) {
      console.error('Errore caricamento dettaglio:', error)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleSync = async () => {
    if (!selectedAccount) return

    try {
      setSyncing(true)
      const response = await fetch(`/api/email/sync/${selectedAccount.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      const result = await response.json()
      if (result.success) {
        // Ricarica folders e messaggi
        await loadFolders(selectedAccount.id)
        if (selectedFolder) {
          await loadMessages(selectedFolder.id)
        }
      }
    } catch (error) {
      console.error('Errore sincronizzazione:', error)
    } finally {
      setSyncing(false)
    }
  }

  const handleReply = (message: EmailMessageDetail, replyAll = false) => {
    const recipients = replyAll
      ? [message.from_address, ...(message.cc_addresses || []), ...message.to_addresses].filter(addr => addr !== selectedAccount?.email_address)
      : [message.from_address]

    setComposeData({
      to: recipients.join(', '),
      cc: '',
      subject: `Re: ${message.subject?.replace(/^Re:\s*/i, '') || ''}`,
      body: `\n\n--- Messaggio originale ---\nDa: ${message.from_name || message.from_address}\nData: ${new Date(message.date_sent).toLocaleString()}\nOggetto: ${message.subject}\n\n${message.body_text || ''}`,
      replyTo: message
    })
    setView('compose')
  }

  const handleForward = (message: EmailMessageDetail) => {
    setComposeData({
      to: '',
      cc: '',
      subject: `Fwd: ${message.subject || ''}`,
      body: `\n\n--- Messaggio inoltrato ---\nDa: ${message.from_name || message.from_address}\nData: ${new Date(message.date_sent).toLocaleString()}\nA: ${message.to_addresses.join(', ')}\nOggetto: ${message.subject}\n\n${message.body_text || ''}`,
      replyTo: null
    })
    setView('compose')
  }

  const handleCompose = () => {
    setComposeData({
      to: '',
      cc: '',
      subject: '',
      body: '',
      replyTo: null
    })
    setView('compose')
  }

  const handleSendEmail = async () => {
    if (!selectedAccount || !composeData.to || !composeData.subject) return

    try {
      setLoading(true)

      // Usa FormData per supportare gli allegati
      const formData = new FormData()
      formData.append('account_id', selectedAccount.id)
      formData.append('to', JSON.stringify(composeData.to.split(',').map(email => email.trim())))
      formData.append('cc', JSON.stringify(composeData.cc ? composeData.cc.split(',').map(email => email.trim()) : []))
      formData.append('subject', composeData.subject)
      formData.append('body', composeData.body)
      if (composeData.replyTo?.message_id) {
        formData.append('reply_to_message_id', composeData.replyTo.message_id)
      }

      // Aggiungi allegati
      attachments.forEach((file, index) => {
        formData.append(`attachments`, file)
      })

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          // Nota: NON impostare Content-Type con FormData
        },
        body: formData
      })

      const result = await response.json()
      if (result.success) {
        setView('inbox')
        setComposeData({ to: '', cc: '', subject: '', body: '', replyTo: null })
        setAttachments([])
        // Ricarica messaggi
        if (selectedFolder) {
          await loadMessages(selectedFolder.id)
        }
      } else {
        alert('Errore invio email: ' + result.message)
      }
    } catch (error) {
      console.error('Errore invio email:', error)
      alert('Errore invio email')
    } finally {
      setLoading(false)
    }
  }

  // Funzioni per la gestione degli allegati
  const handleAddAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const newFiles = Array.from(files)
      setAttachments(prev => [...prev, ...newFiles])
    }
    // Reset dell'input per permettere di selezionare lo stesso file di nuovo
    event.target.value = ''
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const downloadAttachment = async (messageId: string, part: string, filename: string) => {
    try {
      const response = await fetch(`/api/email/attachment/${messageId}/${part}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Errore download allegato:', error)
    }
  }

  // Funzioni per la gestione degli account
  const handleEditAccount = (account: EmailAccount) => {
    setEditingAccount(account)
    setAccountFormData({
      name: account.name,
      email_address: account.email_address,
      username: account.username || account.email_address,
      encrypted_password: '', // Non mostriamo la password esistente
      provider_type: account.provider_type,
      imap_server: account.imap_server || 'imaps.aruba.it',
      imap_port: account.imap_port || 993,
      imap_secure: account.imap_secure !== false,
      smtp_server: account.smtp_server || 'smtps.aruba.it',
      smtp_port: account.smtp_port || 465,
      smtp_secure: account.smtp_secure !== false
    })
    setShowAccountModal(true)
  }

  const handleUpdateAccount = async () => {
    if (!editingAccount) return

    try {
      setLoading(true)

      // Prepara i dati da inviare (solo i campi modificati)
      const updateData: any = {}

      if (accountFormData.name !== editingAccount.name) updateData.name = accountFormData.name
      if (accountFormData.email_address !== editingAccount.email_address) updateData.email_address = accountFormData.email_address
      if (accountFormData.username !== (editingAccount.username || editingAccount.email_address)) updateData.username = accountFormData.username
      if (accountFormData.encrypted_password) updateData.encrypted_password = accountFormData.encrypted_password
      if (accountFormData.provider_type !== editingAccount.provider_type) updateData.provider_type = accountFormData.provider_type
      if (accountFormData.imap_server !== (editingAccount.imap_server || 'imaps.aruba.it')) updateData.imap_server = accountFormData.imap_server
      if (accountFormData.imap_port !== (editingAccount.imap_port || 993)) updateData.imap_port = accountFormData.imap_port
      if (accountFormData.imap_secure !== (editingAccount.imap_secure !== false)) updateData.imap_secure = accountFormData.imap_secure
      if (accountFormData.smtp_server !== (editingAccount.smtp_server || 'smtps.aruba.it')) updateData.smtp_server = accountFormData.smtp_server
      if (accountFormData.smtp_port !== (editingAccount.smtp_port || 465)) updateData.smtp_port = accountFormData.smtp_port
      if (accountFormData.smtp_secure !== (editingAccount.smtp_secure !== false)) updateData.smtp_secure = accountFormData.smtp_secure

      if (Object.keys(updateData).length === 0) {
        alert('Nessuna modifica rilevata')
        setShowAccountModal(false)
        setEditingAccount(null)
        return
      }

      const response = await fetch(`/api/email/accounts/${editingAccount.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(updateData)
      })

      const result = await response.json()

      if (result.success) {
        alert('Account aggiornato con successo!')
        await loadAccounts() // Ricarica gli account
        setShowAccountModal(false)
        setEditingAccount(null)
      } else {
        alert(`Errore aggiornamento account: ${result.message}`)
      }
    } catch (error) {
      console.error('Errore aggiornamento account:', error)
      alert('Errore aggiornamento account')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async (account: EmailAccount) => {
    const confirmed = confirm(`Sei sicuro di voler eliminare l'account ${account.email_address}? Questa azione eliminerà tutte le email e cartelle associate.`)

    if (!confirmed) return

    try {
      setLoading(true)

      const response = await fetch(`/api/email/accounts/${account.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      const result = await response.json()

      if (result.success) {
        alert('Account eliminato con successo!')
        await loadAccounts() // Ricarica gli account

        // Se era l'account selezionato, resetta la selezione
        if (selectedAccount?.id === account.id) {
          setSelectedAccount(null)
          setFolders([])
          setMessages([])
          setSelectedFolder(null)
          setSelectedMessage(null)
        }
      } else {
        alert(`Errore eliminazione account: ${result.message}`)
      }
    } catch (error) {
      console.error('Errore eliminazione account:', error)
      alert('Errore eliminazione account')
    } finally {
      setLoading(false)
    }
  }

  // Funzione per eliminare un messaggio
  const handleDeleteMessage = async (message: EmailMessage) => {
    const confirmed = confirm(`Sei sicuro di voler eliminare il messaggio "${message.subject}"?`)

    if (!confirmed) return

    try {
      setLoading(true)

      const response = await fetch(`/api/email/message/${message.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      const result = await response.json()

      if (result.success) {
        // Rimuovi il messaggio dalla lista
        setMessages(prev => prev.filter(msg => msg.id !== message.id))

        // Se era il messaggio selezionato, deselezionalo
        if (selectedMessage?.id === message.id) {
          setSelectedMessage(null)
          setSelectedMessageDetail(null)
        }

        alert('Messaggio eliminato con successo!')
      } else {
        alert(`Errore eliminazione messaggio: ${result.message}`)
      }
    } catch (error) {
      console.error('Errore eliminazione messaggio:', error)
      alert('Errore eliminazione messaggio')
    } finally {
      setLoading(false)
    }
  }

  const filteredMessages = messages.filter(msg =>
    searchQuery === '' ||
    msg.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.from_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.from_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2">
      <div className="bg-white rounded-lg shadow-2xl w-[98vw] h-[96vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b bg-gray-50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Mail className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Email Client</h2>
            {selectedAccount && (
              <span className="text-sm text-gray-600">
                {selectedAccount.name} ({selectedAccount.email_address})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing || !selectedAccount}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizzazione...' : 'Sincronizza'}
            </button>
            <button
              onClick={handleCompose}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              <Edit3 className="w-4 h-4" />
              Scrivi
            </button>
            <button
              onClick={() => setView('setup')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {view === 'setup' && (
            <div className="flex-1 p-6">
              <button
                onClick={() => setView('inbox')}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Torna alla Inbox
              </button>
              <EmailAccountSetup onAccountAdded={() => {
                setView('inbox')
                loadAccounts()
              }} />
            </div>
          )}

          {view === 'compose' && (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {composeData.replyTo ? 'Rispondi' : 'Nuovo Messaggio'}
                  </h3>
                  <button
                    onClick={() => setView('inbox')}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Torna alla Inbox
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      A:
                    </label>
                    <input
                      type="email"
                      value={composeData.to}
                      onChange={(e) => setComposeData(prev => ({ ...prev, to: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
                      placeholder="destinatario@esempio.com"
                      multiple
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CC:
                    </label>
                    <input
                      type="email"
                      value={composeData.cc}
                      onChange={(e) => setComposeData(prev => ({ ...prev, cc: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
                      placeholder="cc@esempio.com"
                      multiple
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Oggetto:
                    </label>
                    <input
                      type="text"
                      value={composeData.subject}
                      onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
                      placeholder="Oggetto del messaggio"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Messaggio:
                    </label>
                    <textarea
                      value={composeData.body}
                      onChange={(e) => setComposeData(prev => ({ ...prev, body: e.target.value }))}
                      rows={15}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
                      placeholder="Scrivi il tuo messaggio..."
                    />
                  </div>

                  {/* Sezione Allegati */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Allegati:
                    </label>

                    {/* Pulsante per aggiungere allegati */}
                    <div className="mb-3">
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-200 transition-colors">
                        <Paperclip className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-700">Aggiungi Allegati</span>
                        <input
                          type="file"
                          multiple
                          onChange={handleAddAttachment}
                          className="hidden"
                          accept="*/*"
                        />
                      </label>
                    </div>

                    {/* Lista allegati */}
                    {attachments.length > 0 && (
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {attachments.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Paperclip className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                                <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveAttachment(index)}
                              className="flex-shrink-0 ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                              title="Rimuovi allegato"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <button
                      onClick={handleSendEmail}
                      disabled={loading || !composeData.to || !composeData.subject}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      {loading ? 'Invio...' : 'Invia'}
                    </button>
                    <button
                      onClick={() => {
                        setView('inbox')
                        setComposeData({ to: '', cc: '', subject: '', body: '', replyTo: null })
                        setAttachments([])
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'inbox' && (
            <>
              {/* Sidebar */}
              <div className="w-64 bg-gray-50 border-r overflow-y-auto">
                {/* Account management */}
                <div className="p-4 border-b">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Account Email</h3>

                  {/* Account selector per account multipli */}
                  {accounts.length > 1 && (
                    <div className="mb-3">
                      <select
                        value={selectedAccount?.id || ''}
                        onChange={(e) => {
                          const account = accounts.find(acc => acc.id === e.target.value)
                          if (account) {
                            setSelectedAccount(account)
                            loadFolders(account.id)
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      >
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Account attuale con dropdown azioni */}
                  {selectedAccount && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600 flex-1">
                          <div className="font-medium">{selectedAccount.name}</div>
                          <div className="text-xs">{selectedAccount.email_address}</div>
                          <div className="text-xs text-gray-500 capitalize">{selectedAccount.provider_type}</div>
                        </div>
                        <div className="relative account-dropdown">
                          <button
                            onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                            title="Gestisci account"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          {showAccountDropdown && (
                            <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                              <button
                                onClick={() => {
                                  handleEditAccount(selectedAccount)
                                  setShowAccountDropdown(false)
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Edit className="w-3 h-3" />
                                Modifica
                              </button>
                              <button
                                onClick={() => {
                                  handleDeleteAccount(selectedAccount)
                                  setShowAccountDropdown(false)
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash className="w-3 h-3" />
                                Elimina
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Folders */}
                <div className="p-2">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 px-2">Cartelle</h3>
                  <div className="space-y-1">
                    {folders.map(folder => (
                      <button
                        key={folder.id}
                        onClick={() => {
                          setSelectedFolder(folder)
                          setSelectedMessage(null)
                          setSelectedMessageDetail(null)
                          loadMessages(folder.id)
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between hover:bg-gray-200 ${
                          selectedFolder?.id === folder.id ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Inbox className="w-4 h-4" />
                          {folder.name}
                        </div>
                        {folder.unread_messages > 0 && (
                          <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                            {folder.unread_messages}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Message list */}
              <div className="w-80 border-r overflow-hidden flex flex-col">
                {/* Search */}
                <div className="p-4 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cerca email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
                    />
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-center text-gray-500">
                      <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                      Caricamento...
                    </div>
                  ) : filteredMessages.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      {searchQuery ? 'Nessuna email trovata' : 'Nessuna email in questa cartella'}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredMessages.map(message => (
                        <div
                          key={message.id}
                          onClick={() => {
                            setSelectedMessage(message)
                            loadMessageDetail(message.id)
                          }}
                          className={`p-3 cursor-pointer hover:bg-gray-50 border-l-4 transition-all ${
                            selectedMessage?.id === message.id
                              ? 'bg-blue-50 border-l-blue-500 shadow-sm'
                              : 'border-l-transparent'
                          } ${!message.is_read ? 'font-semibold bg-blue-25' : ''}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-sm truncate ${
                                  !message.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'
                                }`}>
                                  {message.from_name || message.from_address}
                                </span>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {message.has_attachments && (
                                    <Paperclip className="w-3 h-3 text-blue-500" title="Ha allegati" />
                                  )}
                                  {message.is_flagged && (
                                    <Flag className="w-3 h-3 text-orange-500" title="Importante" />
                                  )}
                                  {!message.is_read && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full" title="Non letto" />
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 flex-shrink-0 ml-2">
                              <div>{new Date(message.date_sent).toLocaleDateString()}</div>
                              <div className="text-right">{new Date(message.date_sent).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </div>
                          <div className={`text-sm mb-2 truncate ${
                            !message.is_read ? 'font-semibold text-gray-900' : 'text-gray-800'
                          }`}>
                            {message.subject || '(Nessun oggetto)'}
                          </div>
                          <div className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                            {message.body_preview || 'Anteprima non disponibile'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Message detail */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {selectedMessage && selectedMessageDetail ? (
                  <>
                    {/* Message header */}
                    <div className="border-b bg-gray-50 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 pr-4">
                          {selectedMessageDetail.subject || '(Nessun oggetto)'}
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleReply(selectedMessageDetail)}
                            className="p-2 text-gray-600 hover:bg-gray-200 rounded"
                            title="Rispondi"
                          >
                            <Reply className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReply(selectedMessageDetail, true)}
                            className="p-2 text-gray-600 hover:bg-gray-200 rounded"
                            title="Rispondi a tutti"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleForward(selectedMessageDetail)}
                            className="p-2 text-gray-600 hover:bg-gray-200 rounded"
                            title="Inoltra"
                          >
                            <Forward className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(selectedMessage)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded"
                            title="Elimina messaggio"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 text-gray-600 hover:bg-gray-200 rounded"
                            title="Collega a cliente/bando"
                          >
                            <Link className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <span className="font-medium">Da:</span> {selectedMessageDetail.from_name || selectedMessageDetail.from_address}
                        </div>
                        <div>
                          <span className="font-medium">A:</span> {selectedMessageDetail.to_addresses.join(', ')}
                        </div>
                        {selectedMessageDetail.cc_addresses && selectedMessageDetail.cc_addresses.length > 0 && (
                          <div>
                            <span className="font-medium">CC:</span> {selectedMessageDetail.cc_addresses.join(', ')}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Data:</span> {new Date(selectedMessageDetail.date_sent).toLocaleString()}
                        </div>
                      </div>

                      {/* Attachments */}
                      {selectedMessageDetail.attachments && selectedMessageDetail.attachments.length > 0 && (
                        <div className="mt-4 pt-4 border-t bg-blue-50 -mx-4 px-4 -mb-4 pb-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-blue-800 mb-3">
                            <Paperclip className="w-4 h-4" />
                            <span>Allegati ({selectedMessageDetail.attachments.length})</span>
                          </div>
                          <div className="space-y-2">
                            {selectedMessageDetail.attachments.map((attachment, index) => {
                              // Determina l'icona in base al tipo di file
                              const getFileIcon = (fileName: string, fileType: string) => {
                                const ext = fileName.split('.').pop()?.toLowerCase()
                                if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext || '')) {
                                  return '🖼️'
                                }
                                if (['pdf'].includes(ext || '')) {
                                  return '📄'
                                }
                                if (['doc', 'docx'].includes(ext || '')) {
                                  return '📝'
                                }
                                if (['xls', 'xlsx'].includes(ext || '')) {
                                  return '📊'
                                }
                                if (['zip', 'rar', '7z'].includes(ext || '')) {
                                  return '🗜️'
                                }
                                return '📎'
                              }

                              return (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200 hover:border-blue-300 transition-colors"
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <span className="text-lg flex-shrink-0">
                                      {getFileIcon(attachment.name, attachment.type)}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium text-gray-900 truncate">
                                        {attachment.name}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {attachment.type} • {formatFileSize(attachment.size)}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => attachment.part && downloadAttachment(
                                      selectedMessageDetail.id,
                                      attachment.part,
                                      attachment.name
                                    )}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex-shrink-0 ml-3"
                                    title={`Scarica ${attachment.name}`}
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Scarica</span>
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Message content */}
                    <div className="flex-1 overflow-y-auto">
                      {loadingDetail ? (
                        <div className="text-center text-gray-500 p-8">
                          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                          Caricamento contenuto...
                        </div>
                      ) : (
                        <div className="h-full">
                          {selectedMessageDetail.body_html ? (
                            <div className="w-full h-full bg-white">
                              <iframe
                                srcDoc={`
                                  <!DOCTYPE html>
                                  <html>
                                  <head>
                                    <meta charset="utf-8">
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                    <style>
                                      /* Minimal CSS to ensure readability without overriding email design */
                                      body {
                                        margin: 0;
                                        padding: 8px;
                                        background: transparent;
                                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                                        font-size: 14px;
                                        line-height: 1.4;
                                        color: #000;
                                      }
                                      img {
                                        max-width: 100%;
                                        height: auto;
                                      }
                                      /* Override Times New Roman specifically */
                                      * {
                                        font-family: inherit !important;
                                      }
                                      /* Ensure tables look good */
                                      table {
                                        border-collapse: collapse;
                                        width: 100%;
                                      }
                                      td, th {
                                        padding: 4px 8px;
                                        text-align: left;
                                      }
                                    </style>
                                  </head>
                                  <body>
                                    ${selectedMessageDetail.body_html}
                                  </body>
                                  </html>
                                `}
                                className="w-full h-full border-0"
                                sandbox="allow-same-origin"
                                style={{ minHeight: '400px', border: 'none' }}
                              />
                            </div>
                          ) : selectedMessageDetail.body_text ? (
                            <div className="p-4 bg-white h-full">
                              <div className="whitespace-pre-wrap text-gray-900 text-sm leading-relaxed font-sans bg-gray-50 p-4 rounded border min-h-[400px]">
                                {selectedMessageDetail.body_text}
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-white h-full">
                              <div className="flex items-center justify-center h-full">
                                <div className="text-center text-gray-500">
                                  <div className="text-lg mb-2">📧</div>
                                  <div className="text-sm mb-4">
                                    Contenuto email non disponibile per la visualizzazione
                                    {selectedMessageDetail.attachments && selectedMessageDetail.attachments.length > 0 && (
                                      <div className="text-xs mt-2 text-blue-600">
                                        Questa email potrebbe contenere solo allegati
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : selectedMessage ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                      Caricamento messaggio...
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p>Seleziona una email per visualizzarla</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal di modifica account */}
        {showAccountModal && editingAccount && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Modifica Account Email</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                    <input
                      type="text"
                      value={accountFormData.name}
                      onChange={(e) => setAccountFormData({...accountFormData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={accountFormData.email_address}
                      onChange={(e) => setAccountFormData({...accountFormData, email_address: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input
                      type="text"
                      value={accountFormData.username}
                      onChange={(e) => setAccountFormData({...accountFormData, username: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password <span className="text-sm text-gray-500">(lascia vuoto per non modificare)</span>
                    </label>
                    <input
                      type="password"
                      value={accountFormData.encrypted_password}
                      onChange={(e) => setAccountFormData({...accountFormData, encrypted_password: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="Nuova password..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                    <select
                      value={accountFormData.provider_type}
                      onChange={(e) => setAccountFormData({...accountFormData, provider_type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="aruba">Aruba</option>
                      <option value="gmail">Gmail</option>
                      <option value="outlook">Outlook</option>
                      <option value="generic">Personalizzato</option>
                    </select>
                  </div>

                  {accountFormData.provider_type === 'generic' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Server IMAP</label>
                          <input
                            type="text"
                            value={accountFormData.imap_server}
                            onChange={(e) => setAccountFormData({...accountFormData, imap_server: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Porta IMAP</label>
                          <input
                            type="number"
                            value={accountFormData.imap_port}
                            onChange={(e) => setAccountFormData({...accountFormData, imap_port: parseInt(e.target.value) || 993})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Server SMTP</label>
                          <input
                            type="text"
                            value={accountFormData.smtp_server}
                            onChange={(e) => setAccountFormData({...accountFormData, smtp_server: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Porta SMTP</label>
                          <input
                            type="number"
                            value={accountFormData.smtp_port}
                            onChange={(e) => setAccountFormData({...accountFormData, smtp_port: parseInt(e.target.value) || 465})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={accountFormData.imap_secure}
                        onChange={(e) => setAccountFormData({...accountFormData, imap_secure: e.target.checked})}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">IMAP SSL/TLS</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={accountFormData.smtp_secure}
                        onChange={(e) => setAccountFormData({...accountFormData, smtp_secure: e.target.checked})}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">SMTP SSL/TLS</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <button
                    onClick={() => {
                      setShowAccountModal(false)
                      setEditingAccount(null)
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                    disabled={loading}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleUpdateAccount}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Aggiornamento...' : 'Salva Modifiche'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}