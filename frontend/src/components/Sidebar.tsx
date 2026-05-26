'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import {
  Home,
  Calendar,
  Users,
  UserPlus,
  FileText,
  Settings,
  BarChart3,
  Building,
  Target,
  ChevronLeft,
  ChevronRight,
  Pin,
  PinOff,
  Mail,
  HelpCircle,
  Inbox
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface SidebarProps {
  activeItem: string
  setActiveItem: (item: string) => void
  onSidebarStateChange?: (isExpanded: boolean) => void
}

export default function Sidebar({ activeItem, setActiveItem, onSidebarStateChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isPinned, setIsPinned] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const [inboxNoteCount, setInboxNoteCount] = useState(0)
  const { isAdmin } = useAuth()

  useEffect(() => {
    let cancelled = false

    async function fetchInboxCount() {
      const { count, error } = await supabase
        .from('scadenze_bandi_clienti_note')
        .select('id', { count: 'exact', head: true })
        .eq('stato', 'in_inbox')

      if (!cancelled && !error && count !== null) {
        setInboxNoteCount(count)
      }
    }

    fetchInboxCount()
    const interval = window.setInterval(fetchInboxCount, 30000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [activeItem])

  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, adminOnly: false, badge: 0 },
    { id: 'scadenze', label: 'Scadenzario', icon: Calendar, adminOnly: false, badge: 0 },
    { id: 'prospect', label: 'Prospect', icon: UserPlus, adminOnly: false, badge: 0 },
    { id: 'clienti', label: 'Clienti', icon: Users, adminOnly: false, badge: 0 },
    { id: 'bandi', label: 'Bandi', icon: FileText, adminOnly: false, badge: 0 },
    { id: 'progetti', label: 'Progetti', icon: Target, adminOnly: false, badge: 0 },
    { id: 'email', label: 'Email', icon: Mail, adminOnly: false, badge: 0 },
    { id: 'note-inbox', label: 'Inbox Note', icon: Inbox, adminOnly: false, badge: inboxNoteCount },
    { id: 'consulenti', label: 'Consulenti', icon: Building, adminOnly: false, badge: 0 },
    { id: 'reports', label: 'Reports', icon: BarChart3, adminOnly: false, badge: 0 },
    { id: 'settings', label: 'Impostazioni', icon: Settings, adminOnly: false, badge: 0 },
    { id: 'faq', label: 'FAQ', icon: HelpCircle, adminOnly: false, badge: 0 }
  ]

  const menuItems = allMenuItems.filter(item => !item.adminOnly || isAdmin())

  const shouldShowExpanded = isPinned || isHovered
  const effectiveWidth = shouldShowExpanded ? 'w-56' : 'w-16'

  // Notifica il parent quando lo stato cambia
  React.useEffect(() => {
    onSidebarStateChange?.(shouldShowExpanded)
  }, [shouldShowExpanded, onSidebarStateChange])

  return (
    <div
      className={`bg-gray-900 text-white ${effectiveWidth} h-screen flex flex-col shadow-hard fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out`}
      onMouseEnter={() => !isPinned && setIsHovered(true)}
      onMouseLeave={() => !isPinned && setIsHovered(false)}
    >
      {/* Header with Logo and Controls */}
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden">
              <Image src="/logo blm blu 2.png" alt="Evolvi" width={32} height={32} className="w-8 h-8 object-contain brightness-0 invert" />
            </div>
            {shouldShowExpanded && (
              <h1 className="text-sm font-bold text-white">Gestionale Evolvi</h1>
            )}
          </div>

          {shouldShowExpanded && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsPinned(!isPinned)}
                className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                title={isPinned ? "Sblocca sidebar" : "Blocca sidebar"}
              >
                {isPinned ? (
                  <Pin className="w-4 h-4 text-gray-400" />
                ) : (
                  <PinOff className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <button
                onClick={() => {
                  setIsPinned(false)
                  setIsHovered(false)
                }}
                className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                title="Comprimi sidebar"
              >
                <ChevronLeft className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-2">
          {shouldShowExpanded && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
              Menu Principale
            </p>
          )}
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              const hasBadge = item.badge > 0
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveItem(item.id)}
                    className={`sidebar-item w-full text-left group relative ${
                      activeItem === item.id ? 'active' : ''
                    } ${!shouldShowExpanded ? 'justify-center px-3' : ''}`}
                    title={!shouldShowExpanded ? `${item.label}${hasBadge ? ` (${item.badge})` : ''}` : undefined}
                  >
                    <div className="relative flex-shrink-0">
                      <Icon className="sidebar-item-icon group-hover:scale-110 transition-transform duration-200" />
                      {hasBadge && !shouldShowExpanded && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </div>
                    {shouldShowExpanded && (
                      <>
                        <span className="font-medium">{item.label}</span>
                        <div className="ml-auto flex items-center gap-2">
                          {hasBadge && (
                            <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center leading-none">
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                          {activeItem === item.id && (
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          )}
                        </div>
                      </>
                    )}
                    {!shouldShowExpanded && activeItem === item.id && !hasBadge && (
                      <div className="absolute right-1 w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>


      {/* Expand button when collapsed */}
      {!isPinned && !isHovered && (
        <button
          onClick={() => setIsPinned(true)}
          className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-gray-900 border border-gray-700 rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors"
          title="Espandi sidebar"
        >
          <ChevronRight className="w-3 h-3 text-gray-400" />
        </button>
      )}
    </div>
  )
}