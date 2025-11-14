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
  MessageSquare
} from 'lucide-react'
import { useState } from 'react'

interface TopBarProps {
  title: string
  breadcrumb?: string[]
}

export default function TopBar({ title, breadcrumb = [] }: TopBarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  const notifications = [
    {
      id: 1,
      title: 'Scadenza imminente',
      message: 'BANDO TURISMO - CASALE THE GELS scade tra 2 giorni',
      time: '2 ore fa',
      type: 'warning',
      unread: true
    },
    {
      id: 2,
      title: 'Nuovo progetto creato',
      message: 'Progetto INNOVATION MANAGER avviato',
      time: '4 ore fa',
      type: 'success',
      unread: true
    },
    {
      id: 3,
      title: 'Documento caricato',
      message: 'Allegato per IMPRESE CULTURALI - TOTIP',
      time: '1 giorno fa',
      type: 'info',
      unread: false
    }
  ]

  const unreadCount = notifications.filter(n => n.unread).length

  return (
    <div className="gradient-primary text-white shadow-hard relative z-50">
      <div className="px-6 py-4 flex items-center justify-between">
        {/* Left side - Title and Breadcrumb */}
        <div className="flex-1">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-2xl font-black text-white drop-shadow-sm">{title}</h1>
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

        {/* Right side - Search and Actions */}
        <div className="flex items-center space-x-4">
          {/* Global Search */}
          <div className="relative hidden md:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Cerca scadenze, clienti, bandi..."
              className="w-96 pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg placeholder-gray-400 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 shadow-sm"
            />
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

            {/* Messages */}
            <button className="p-2.5 hover:bg-white/20 rounded-lg transition-colors duration-200 group relative">
              <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
              <span className="absolute -top-1 -right-1 bg-green-400 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                3
              </span>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 hover:bg-white/20 rounded-lg transition-colors duration-200 group relative"
              >
                <Bell className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-400 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-hard border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-gray-900 font-semibold">Notifiche</h3>
                      <span className="text-xs text-gray-500">{unreadCount} non lette</span>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((notification) => (
                      <div key={notification.id} className={`p-4 border-b border-gray-50 hover:bg-gray-25 transition-colors ${notification.unread ? 'bg-blue-25' : ''}`}>
                        <div className="flex items-start space-x-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            notification.type === 'warning' ? 'bg-yellow-400' :
                            notification.type === 'success' ? 'bg-green-400' : 'bg-blue-400'
                          }`} />
                          <div className="flex-1">
                            <h4 className="text-gray-900 font-medium text-sm">{notification.title}</h4>
                            <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                            <p className="text-gray-400 text-xs mt-2">{notification.time}</p>
                          </div>
                          {notification.unread && (
                            <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-gray-50 border-t border-gray-100">
                    <button className="text-primary-600 text-sm font-medium hover:text-primary-700 transition-colors">
                      Vedi tutte le notifiche
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
                  <span className="text-sm font-black text-white drop-shadow">A</span>
                </div>
                <div className="hidden md:block text-left">
                  <p className="font-bold text-sm text-white drop-shadow-sm">Administrator</p>
                  <p className="text-white text-xs font-bold drop-shadow-sm">Super Admin</p>
                </div>
                <ChevronDown className="w-4 h-4 text-white/75 group-hover:text-white transition-colors" />
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-hard border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 font-semibold">A</span>
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium">Administrator</p>
                        <p className="text-gray-600 text-sm">admin@blm.it</p>
                      </div>
                    </div>
                  </div>
                  <div className="py-2">
                    <button className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-50 w-full text-left transition-colors">
                      <User className="w-4 h-4" />
                      <span>Profilo Utente</span>
                    </button>
                    <button className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-50 w-full text-left transition-colors">
                      <Settings className="w-4 h-4" />
                      <span>Impostazioni</span>
                    </button>
                    <hr className="my-2" />
                    <button className="flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 w-full text-left transition-colors">
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