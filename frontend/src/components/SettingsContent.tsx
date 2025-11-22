'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import UserManagement from './UserManagement'
import GroupsManagement from './GroupsManagement'
import NotificationSettings from './NotificationSettings'
import SchedulerManager from './SchedulerManager'
import GmailSetup from './GmailSetup'
import {
  Settings,
  Users,
  Shield,
  Bell,
  Palette,
  Database,
  Key,
  Globe,
  ChevronRight,
  Clock,
  Mail,
  UserPlus
} from 'lucide-react'

export default function SettingsContent() {
  const { user, isAdmin } = useAuth()
  const [activeSection, setActiveSection] = useState('general')

  const sections = [
    {
      id: 'general',
      label: 'Generali',
      icon: Settings,
      description: 'Configurazioni di base del sistema'
    },
    {
      id: 'users',
      label: 'Gestione Utenti',
      icon: Users,
      description: 'Gestisci utenti, ruoli e permessi',
      adminOnly: true
    },
    {
      id: 'groups',
      label: 'Gruppi Utenti',
      icon: UserPlus,
      description: 'Organizza utenti in gruppi di lavoro',
      adminOnly: true
    },
    {
      id: 'security',
      label: 'Sicurezza',
      icon: Shield,
      description: 'Impostazioni di sicurezza e autenticazione',
      adminOnly: true
    },
    {
      id: 'notifications',
      label: 'Notifiche',
      icon: Bell,
      description: 'Configurazione notifiche email e sistema'
    },
    {
      id: 'scheduler',
      label: 'Scheduler',
      icon: Clock,
      description: 'Gestione scheduler notifiche automatiche',
      adminOnly: true
    },
    {
      id: 'gmail',
      label: 'Google API',
      icon: Mail,
      description: 'Configurazione Gmail e Google Drive API',
      adminOnly: true
    },
    {
      id: 'appearance',
      label: 'Aspetto',
      icon: Palette,
      description: 'Tema, colori e personalizzazione'
    },
    {
      id: 'database',
      label: 'Database',
      icon: Database,
      description: 'Backup, ripristino e manutenzione',
      adminOnly: true
    }
  ]

  const availableSections = sections.filter(section =>
    !section.adminOnly || isAdmin()
  )

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'users':
        return <UserManagement />

      case 'groups':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gruppi Utenti</h1>
                <p className="text-gray-600">Organizza utenti in gruppi di lavoro per gestire le responsabilità</p>
              </div>
            </div>

            <GroupsManagement />
          </div>
        )

      case 'general':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Settings className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Impostazioni Generali</h1>
                <p className="text-gray-600">Configurazioni di base del sistema</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informazioni Sistema</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Applicazione</label>
                  <input
                    type="text"
                    value="Gestionale Evolvi"
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Versione</label>
                  <input
                    type="text"
                    value="1.0.0"
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case 'security':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sicurezza</h1>
                <p className="text-gray-600">Gestisci impostazioni di sicurezza</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Autenticazione</h3>
              <p className="text-gray-600">Sezione in sviluppo - Configurazione JWT e politiche password</p>
            </div>
          </div>
        )

      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Bell className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Notifiche</h1>
                <p className="text-gray-600">Configura notifiche email e Google Calendar</p>
              </div>
            </div>

            <NotificationSettings />
          </div>
        )

      case 'scheduler':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Scheduler Notifiche</h1>
                <p className="text-gray-600">Gestisci scheduler automatici per notifiche</p>
              </div>
            </div>

            <SchedulerManager />
          </div>
        )

      case 'gmail':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Mail className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gmail API</h1>
                <p className="text-gray-600">Configurazione invio email tramite Gmail</p>
              </div>
            </div>

            <GmailSetup />
          </div>
        )

      case 'appearance':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Palette className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Aspetto</h1>
                <p className="text-gray-600">Personalizza l'interfaccia</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tema</h3>
              <p className="text-gray-600">Sezione in sviluppo - Selezione tema chiaro/scuro</p>
            </div>
          </div>
        )

      case 'database':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Database className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Database</h1>
                <p className="text-gray-600">Gestisci backup e manutenzione</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Backup</h3>
              <p className="text-gray-600">Sezione in sviluppo - Backup automatici e ripristino</p>
            </div>
          </div>
        )

      default:
        return <div>Sezione non trovata</div>
    }
  }

  return (
    <div className="flex h-full">
      {/* Settings Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Impostazioni</h2>
          <p className="text-sm text-gray-600">Gestisci configurazioni sistema</p>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {availableSections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id

              return (
                <li key={section.id}>
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-center space-x-3 group ${
                      isActive
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isActive
                        ? 'bg-teal-100'
                        : 'bg-gray-100 group-hover:bg-gray-200'
                    }`}>
                      <Icon className={`w-4 h-4 ${
                        isActive ? 'text-teal-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{section.label}</div>
                      <div className="text-xs text-gray-500 truncate">{section.description}</div>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-teal-600" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
              <span className="text-teal-600 font-semibold text-sm">
                {user?.nome?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {user?.nome_completo}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {user?.livello_permessi === 'admin' ? 'Amministratore' : 'Collaboratore'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 bg-gray-50">
        <div className="p-6">
          {renderSectionContent()}
        </div>
      </div>
    </div>
  )
}