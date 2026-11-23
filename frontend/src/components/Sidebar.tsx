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
  Inbox,
  Search,
  Landmark,
  ShieldCheck
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { vociVisibili } from '@/lib/navigazione'

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
  const { user } = useAuth()

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
    // Ogni 3 minuti (prima ogni 30 secondi, e di nuovo a ogni cambio di pagina)
    const interval = window.setInterval(fetchInboxCount, 180000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const ICONE: Record<string, typeof Home> = {
    dashboard: Home, scadenze: Calendar, email: Mail, 'note-inbox': Inbox, prospect: UserPlus, clienti: Users,
    consulenti: Building, bandi: FileText, 'bandi-esterni': Landmark, progetti: Target, interrogazioni: Search,
    reports: BarChart3, modello231: ShieldCheck, settings: Settings, faq: HelpCircle
  }
  const menuItems = vociVisibili(user?.livello_permessi).map(v => ({
    ...v, icon: ICONE[v.id] || FileText, badge: v.id === 'note-inbox' ? inboxNoteCount : 0
  }))

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
          <ul className="space-y-1">
            {menuItems.map((item, indice) => {
              const Icon = item.icon
              const hasBadge = item.badge > 0
              const nuovoGruppo = item.gruppo && item.gruppo !== menuItems[indice - 1]?.gruppo
              return (
                <li key={item.id}>
                  {nuovoGruppo && (shouldShowExpanded
                    ? <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-1 px-3">{item.gruppo}</p>
                    : <div className="border-t border-gray-800 my-2 mx-2" />)}
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