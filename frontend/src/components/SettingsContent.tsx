'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import UserManagement from './UserManagement'
import GroupsManagement from './GroupsManagement'
import GmailSetupNew from './GmailSetupNew'
import UserGmailConnection from './UserGmailConnection'
import EmailSignatureEditor from './EmailSignatureEditor'
import ChangeOwnPassword from './ChangeOwnPassword'
import BackupGestionale from './BackupGestionale'
import DocumentiSuDrive from './DocumentiSuDrive'
import RegistroAttivita from './RegistroAttivita'
import RuoliPermessi from './RuoliPermessi'
import { ETICHETTE_RUOLO } from '@/lib/ruoli'
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
  UserPlus,
  ScrollText,
  KeySquare
} from 'lucide-react'

export default function SettingsContent() {
  const { user, isAdmin } = useAuth()
  const [activeSection, setActiveSection] = useState('my-gmail')

  // Due gruppi: ciò che riguarda ciascuno e, per gli amministratori, la gestione dello studio
  const sections = [
    { id: 'my-gmail', gruppo: 'Il mio profilo', label: 'Il mio account Google', icon: Mail, description: 'Posta, calendario e firma delle email', adminOnly: false },
    { id: 'my-password', gruppo: 'Il mio profilo', label: 'La mia password', icon: KeySquare, description: 'Cambia la password di accesso', adminOnly: false },
    { id: 'users', gruppo: 'Amministrazione', label: 'Utenti', icon: Users, description: 'Aggiungi, disattiva, reimposta la password', adminOnly: true },
    { id: 'permessi', gruppo: 'Amministrazione', label: 'Ruoli e permessi', icon: Key, description: 'Che cosa può fare ciascun ruolo', adminOnly: true },
    { id: 'groups', gruppo: 'Amministrazione', label: 'Gruppi di lavoro', icon: UserPlus, description: 'Gruppi da indicare come responsabili', adminOnly: true },
    { id: 'registro', gruppo: 'Amministrazione', label: 'Registro attività', icon: ScrollText, description: 'Chi ha fatto che cosa e quando', adminOnly: true },
    { id: 'database', gruppo: 'Amministrazione', label: 'Backup e documenti', icon: Database, description: 'Esportazioni mensili, prove di ripristino, documenti su Drive', adminOnly: true },
    { id: 'gmail', gruppo: 'Amministrazione', label: 'Account Google dello studio', icon: Globe, description: 'Drive per documenti e cartelle', adminOnly: true }
  ]

  const availableSections = sections.filter(section => !section.adminOnly || isAdmin())

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'users':
        return <UserManagement />

      case 'registro':
        return <RegistroAttivita />

      case 'permessi':
        return <RuoliPermessi />

      case 'groups':
        return (
          <div className="space-y-3">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-4 h-4 bg-teal-100 rounded-lg flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-gray-900">Gruppi di lavoro</h1>
                <p className="text-gray-600">Organizza utenti in gruppi di lavoro per gestire le responsabilità</p>
              </div>
            </div>

            <GroupsManagement />
          </div>
        )

      case 'my-password':
        return <ChangeOwnPassword />

      case 'my-gmail':
        return (
          <div className="space-y-3">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-4 h-4 bg-red-100 rounded-lg flex items-center justify-center">
                <Mail className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-gray-900">Il mio account Google</h1>
                <p className="text-gray-600">Collegalo per usare la posta nel gestionale, inviare email e contratti a tuo nome e ricevere gli eventi in calendario</p>
              </div>
            </div>

            <UserGmailConnection />
            <EmailSignatureEditor />
          </div>
        )

      case 'gmail':
        return (
          <div className="space-y-3">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-4 h-4 bg-red-100 rounded-lg flex items-center justify-center">
                <Mail className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-gray-900">Account Google dello studio</h1>
                <p className="text-gray-600">Il gestionale lo usa per salvare documenti e cartelle su Google Drive: non va scollegato. Non invia email: le email partono sempre dalla casella di chi le scrive, e i promemoria delle scadenze arrivano dal calendario Google.</p>
              </div>
            </div>

            <GmailSetupNew />
          </div>
        )

      case 'database':
        return (
          <div className="space-y-4">
            <BackupGestionale />
            <DocumentiSuDrive />
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
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Impostazioni</h2>
          <p className="text-sm text-gray-600">Il tuo profilo{isAdmin() ? ' e la gestione dello studio' : ''}</p>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {availableSections.map((section, indice) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              const nuovoGruppo = section.gruppo !== availableSections[indice - 1]?.gruppo

              return (
                <li key={section.id}>
                  {nuovoGruppo && <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-3 mb-1 px-1">{section.gruppo}</p>}
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-center space-x-3 group ${
                      isActive
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
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
            <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center">
              <span className="text-teal-600 font-semibold text-sm">
                {user?.nome?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {user?.nome_completo}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {user?.livello_permessi ? ETICHETTE_RUOLO[user.livello_permessi] : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 bg-gray-50">
        <div className="p-4">
          {renderSectionContent()}
        </div>
      </div>
    </div>
  )
}