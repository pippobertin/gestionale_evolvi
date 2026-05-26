'use client'

import {
  Search,
  Bell,
  Settings,
  User,
  ChevronDown,
  HelpCircle,
  Moon,
  LogOut,
  Mail,
  Cloud,
  CloudOff,
  Users,
  FileText,
  Target,
  UserPlus,
  Calendar,
  Shield,
  Receipt,
  Loader2
} from 'lucide-react'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useGoogleDriveStatus } from '@/hooks/useGoogleDriveStatus'
import { useUnreadEmailCount } from '@/hooks/useUnreadEmailCount'
import { useNotifications } from '@/hooks/useNotifications'
import { useGlobalSearch, type GlobalSearchResults } from '@/hooks/useGlobalSearch'

interface TopBarProps {
  title: string
  breadcrumb?: string[]
  onNavigate?: (page: string, params?: any) => void
}

function highlightMatch(text: string, query: string): ReactNode {
  if (!query || query.length < 2) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

const SEARCH_CATEGORIES: Array<{
  key: keyof GlobalSearchResults
  label: string
  icon: typeof Users
  color: string
  getTitle: (item: any) => string
  getSubtitle: (item: any) => string
  navigate: (item: any, onNavigate: (page: string, params?: any) => void) => void
}> = [
  {
    key: 'clienti',
    label: 'Clienti',
    icon: Users,
    color: 'text-blue-600',
    getTitle: (item) => item.denominazione,
    getSubtitle: (item) => [item.partita_iva, item.email].filter(Boolean).join(' - ') || '',
    navigate: (item, onNavigate) => onNavigate('clienti', { openClientId: item.id }),
  },
  {
    key: 'bandi',
    label: 'Bandi',
    icon: FileText,
    color: 'text-amber-600',
    getTitle: (item) => item.nome,
    getSubtitle: (item) => [item.codice_bando, item.ente_erogatore].filter(Boolean).join(' - ') || '',
    navigate: (item, onNavigate) => onNavigate('bandi', { filter: item.nome }),
  },
  {
    key: 'progetti',
    label: 'Progetti',
    icon: Target,
    color: 'text-green-600',
    getTitle: (item) => item.titolo_progetto,
    getSubtitle: (item) => [item.codice_progetto, item.cliente_denominazione].filter(Boolean).join(' - ') || '',
    navigate: (item, onNavigate) => onNavigate('progetti', { clienteFilter: item.codice_progetto }),
  },
  {
    key: 'prospect',
    label: 'Prospect',
    icon: UserPlus,
    color: 'text-purple-600',
    getTitle: (item) => item.denominazione,
    getSubtitle: (item) => {
      const parts = []
      if (item.stato) parts.push(item.stato)
      if (item.motivo_congelamento) parts.push(item.motivo_congelamento)
      else if (item.email) parts.push(item.email)
      return parts.join(' - ')
    },
    navigate: (item, onNavigate) => onNavigate('prospect', { openProspectId: item.id }),
  },
  {
    key: 'scadenze',
    label: 'Scadenze',
    icon: Calendar,
    color: 'text-red-600',
    getTitle: (item) => item.titolo,
    getSubtitle: (item) => {
      const parts = []
      if (item.data_scadenza) parts.push(new Date(item.data_scadenza).toLocaleDateString('it-IT'))
      if (item.progetto_titolo) parts.push(item.progetto_titolo)
      return parts.join(' - ')
    },
    navigate: (_item, onNavigate) => onNavigate('scadenze'),
  },
  {
    key: 'contratti',
    label: 'Contratti',
    icon: Shield,
    color: 'text-teal-600',
    getTitle: (item) => item.numero_contratto,
    getSubtitle: (item) => [item.cliente_denominazione, item.stato].filter(Boolean).join(' - ') || '',
    navigate: (item, onNavigate) => {
      if (item.cliente_id) onNavigate('clienti', { openClientId: item.cliente_id })
      else onNavigate('clienti')
    },
  },
  {
    key: 'fatture',
    label: 'Fatture',
    icon: Receipt,
    color: 'text-indigo-600',
    getTitle: (item) => item.numero_fattura,
    getSubtitle: (item) => [item.cliente_denominazione, item.stato_pagamento].filter(Boolean).join(' - ') || '',
    navigate: (item, onNavigate) => {
      if (item.cliente_id) onNavigate('clienti', { openClientId: item.cliente_id })
      else onNavigate('clienti')
    },
  },
]

export default function TopBar({ title, breadcrumb = [], onNavigate }: TopBarProps) {
  const { user, logout, isAdmin } = useAuth()
  const { isConnected: isGoogleDriveConnected, loading: googleDriveLoading } = useGoogleDriveStatus()
  const { count: unreadEmailCount, loading: emailLoading } = useUnreadEmailCount()
  const { notifications, unreadCount, loading: notificationsLoading, markAsRead, markAllAsRead } = useNotifications()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showAllNotifications, setShowAllNotifications] = useState(false)

  // Global search state
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const { results, loading: searchLoading, totalCount } = useGlobalSearch(searchQuery)

  // Click-outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Click-outside to close notifications dropdown
  useEffect(() => {
    if (!showNotifications) return
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
        setShowAllNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifications])

  // Escape to close search dropdown and notifications
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearchDropdown(false)
        setShowNotifications(false)
        setShowAllNotifications(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setShowSearchDropdown(value.trim().length >= 2)
  }

  const handleResultClick = (category: typeof SEARCH_CATEGORIES[number], item: any) => {
    if (onNavigate) {
      category.navigate(item, onNavigate)
    }
    setSearchQuery('')
    setShowSearchDropdown(false)
  }

  const handleLogout = async () => {
    await logout()
    setShowUserMenu(false)
  }

  // Filter categories that have results
  const categoriesWithResults = SEARCH_CATEGORIES.filter(cat => {
    const items = results[cat.key]
    return items && items.length > 0
  })

  return (
    <div className="gradient-primary text-white shadow-hard relative z-50">
      <div className="px-4 py-2.5 flex items-center justify-between">
        {/* Left side - Title and Breadcrumb */}
        <div className="flex-1">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-sm font-bold text-white drop-shadow-sm">{title}</h1>
              {breadcrumb.length > 0 && (
                <div className="flex items-center space-x-2 text-white/90 text-sm font-medium mt-1 drop-shadow-sm">
                  {breadcrumb.map((item, index) => (
                    <span key={index}>
                      {item}
                      {index < breadcrumb.length - 1 && (
                        <span className="mx-2 text-white/75">/</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center - Search Bar */}
        <div className="flex-1 flex justify-center max-w-2xl mx-8" ref={searchRef}>
          <div className="relative w-full max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {searchLoading ? (
                <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
              ) : (
                <Search className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <input
              type="text"
              placeholder="Cerca clienti, bandi, progetti, prospect..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => { if (searchQuery.trim().length >= 2) setShowSearchDropdown(true) }}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg placeholder-gray-400 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 shadow-sm"
            />

            {/* Search Results Dropdown */}
            {showSearchDropdown && searchQuery.trim().length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-hard border border-gray-200 overflow-hidden z-[100] max-h-[28rem] overflow-y-auto">
                {searchLoading && totalCount === 0 ? (
                  <div className="p-6 text-center">
                    <Loader2 className="w-6 h-6 text-primary-500 animate-spin mx-auto" />
                    <p className="text-gray-500 text-sm mt-2">Ricerca in corso...</p>
                  </div>
                ) : totalCount === 0 && !searchLoading ? (
                  <div className="p-6 text-center">
                    <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">
                      Nessun risultato per &quot;{searchQuery}&quot;
                    </p>
                  </div>
                ) : (
                  categoriesWithResults.map((category) => {
                    const items = results[category.key] as any[]
                    const Icon = category.icon
                    return (
                      <div key={category.key}>
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${category.color}`} />
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {category.label}
                          </span>
                          <span className="text-xs text-gray-400">({items.length})</span>
                        </div>
                        {items.map((item: any) => (
                          <div
                            key={item.id}
                            onClick={() => handleResultClick(category, item)}
                            className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-50 transition-colors"
                          >
                            <div className="text-sm font-medium text-gray-900">
                              {highlightMatch(category.getTitle(item), searchQuery)}
                            </div>
                            {category.getSubtitle(item) && (
                              <div className="text-xs text-gray-500 mt-0.5 truncate">
                                {highlightMatch(category.getSubtitle(item), searchQuery)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-4">
          {/* Google Drive Status */}
          <div className="flex items-center space-x-2">
            {googleDriveLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <>
                {isGoogleDriveConnected ? (
                  <div className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 rounded-lg border border-emerald-400">
                    <Cloud className="w-4 h-4 text-emerald-200 drop-shadow" />
                    <span className="text-xs font-bold text-white drop-shadow-sm">Drive connesso</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 bg-red-600 px-3 py-1.5 rounded-lg border border-red-500">
                    <CloudOff className="w-4 h-4 text-white" />
                    <span className="text-xs font-bold text-white drop-shadow-sm">Drive disconnesso</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Help */}
            <button className="p-2.5 hover:bg-white/20 rounded-lg transition-colors duration-200 group">
              <HelpCircle className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
            </button>

            {/* Theme Toggle */}
            <button className="p-2.5 hover:bg-white/20 rounded-lg transition-colors duration-200 group">
              <Moon className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
            </button>

            {/* Email */}
            <button
              onClick={() => {
                console.log('📧 Email button clicked, navigating to email page')
                onNavigate?.('email')
              }}
              className="p-2.5 hover:bg-white/20 rounded-lg transition-colors duration-200 group relative"
              title="Centro Email"
            >
              <Mail className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
              {!emailLoading && unreadEmailCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold border-2 border-white shadow-lg">
                  {unreadEmailCount > 99 ? '99+' : unreadEmailCount}
                </span>
              )}
            </button>

            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications)
                  if (showNotifications) setShowAllNotifications(false)
                }}
                className="p-2.5 hover:bg-white/20 rounded-lg transition-colors duration-200 group relative"
              >
                <Bell className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold border-2 border-white shadow-lg">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-hard border border-gray-200 overflow-hidden z-[100]">
                  <div className="p-3 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-gray-900 font-semibold">
                        {showAllNotifications ? 'Tutte le notifiche' : 'Notifiche'}
                      </h3>
                      {!showAllNotifications && unreadCount > 0 && (
                        <button
                          onClick={() => markAllAsRead()}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          Segna tutte come lette
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notificationsLoading ? (
                      <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                        <p className="text-gray-500 text-sm mt-2">Caricamento...</p>
                      </div>
                    ) : (() => {
                      const visibleNotifications = showAllNotifications
                        ? notifications
                        : notifications.filter(n => n.unread)
                      return visibleNotifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">
                            {showAllNotifications ? 'Nessuna notifica' : 'Nessuna notifica non letta'}
                          </p>
                        </div>
                      ) : (
                        visibleNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${notification.unread ? 'bg-blue-50/50' : ''}`}
                            onClick={() => {
                              if (notification.unread) {
                                markAsRead(notification.id)
                              }
                              if (notification.link) {
                                console.log('Navigate to:', notification.link)
                              }
                            }}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                notification.type === 'warning' ? 'bg-yellow-400' :
                                notification.type === 'success' ? 'bg-green-400' : 'bg-blue-400'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <h4 className="text-gray-900 font-medium text-sm">{notification.title}</h4>
                                <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                                <p className="text-gray-400 text-xs mt-2">{notification.time}</p>
                              </div>
                              {notification.unread && (
                                <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0"></div>
                              )}
                            </div>
                          </div>
                        ))
                      )
                    })()}
                  </div>
                  <div className="p-3 bg-gray-50 border-t border-gray-100">
                    <button
                      onClick={() => setShowAllNotifications(!showAllNotifications)}
                      className="text-primary-600 text-sm font-medium hover:text-primary-700 transition-colors"
                    >
                      {showAllNotifications ? 'Mostra solo non lette' : 'Vedi tutte le notifiche'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-3 p-2 hover:bg-white/20 rounded-lg transition-colors duration-200 group"
              >
                <div className="w-8 h-8 bg-white/30 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <span className="text-sm font-black text-white drop-shadow">
                    {user?.nome?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden md:block text-left">
                  <p className="font-bold text-sm text-white drop-shadow-sm">{user?.nome_completo}</p>
                  <p className="text-white text-xs font-bold drop-shadow-sm">
                    {user?.livello_permessi === 'admin' ? 'Amministratore' : 'Collaboratore'}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-white/75 group-hover:text-white transition-colors" />
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-hard border border-gray-200 overflow-hidden">
                  <div className="p-3 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                        <span className="text-teal-600 font-semibold">
                          {user?.nome?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium">{user?.nome_completo}</p>
                        <p className="text-gray-600 text-sm">{user?.email}</p>
                        <p className="text-gray-500 text-xs">
                          {user?.livello_permessi === 'admin' ? 'Amministratore' : 'Collaboratore'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="py-2">
                    <button className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-50 w-full text-left transition-colors">
                      <User className="w-4 h-4" />
                      <span>Profilo Utente</span>
                    </button>
                    {isAdmin() && (
                      <button
                        onClick={() => {
                          onNavigate?.('settings')
                          setShowUserMenu(false)
                        }}
                        className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-50 w-full text-left transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        <span>Impostazioni</span>
                      </button>
                    )}
                    <hr className="my-2" />
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 w-full text-left transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
