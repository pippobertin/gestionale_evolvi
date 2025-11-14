'use client'

import React, { useState } from 'react'
import {
  Home,
  Calendar,
  Users,
  FileText,
  Settings,
  BarChart3,
  Clock,
  Building,
  Target,
  ChevronLeft,
  ChevronRight,
  Pin,
  PinOff
} from 'lucide-react'

interface SidebarProps {
  activeItem: string
  setActiveItem: (item: string) => void
  onSidebarStateChange?: (isExpanded: boolean) => void
}

export default function Sidebar({ activeItem, setActiveItem, onSidebarStateChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isPinned, setIsPinned] = useState(true)
  const [isHovered, setIsHovered] = useState(false)

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'scadenze', label: 'Scadenzario', icon: Calendar },
    { id: 'clienti', label: 'Clienti', icon: Users },
    { id: 'bandi', label: 'Bandi', icon: FileText },
    { id: 'progetti', label: 'Progetti', icon: Target },
    { id: 'consulenti', label: 'Consulenti', icon: Building },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Impostazioni', icon: Settings }
  ]

  const shouldShowExpanded = isPinned || isHovered
  const effectiveWidth = shouldShowExpanded ? 'w-72' : 'w-16'

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
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-medium">
              <Clock className="w-6 h-6 text-white" />
            </div>
            {shouldShowExpanded && (
              <div>
                <h1 className="text-xl font-bold text-white">ScadenzePro</h1>
                <p className="text-xs text-gray-400">Gestione Bandi</p>
              </div>
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
      <nav className="flex-1 py-6 overflow-y-auto">
        <div className="px-3">
          {shouldShowExpanded && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
              Menu Principale
            </p>
          )}
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveItem(item.id)}
                    className={`sidebar-item w-full text-left group relative ${
                      activeItem === item.id ? 'active' : ''
                    } ${!shouldShowExpanded ? 'justify-center px-3' : ''}`}
                    title={!shouldShowExpanded ? item.label : undefined}
                  >
                    <Icon className="sidebar-item-icon group-hover:scale-110 transition-transform duration-200 flex-shrink-0" />
                    {shouldShowExpanded && (
                      <>
                        <span className="font-medium">{item.label}</span>
                        {activeItem === item.id && (
                          <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </>
                    )}
                    {!shouldShowExpanded && activeItem === item.id && (
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