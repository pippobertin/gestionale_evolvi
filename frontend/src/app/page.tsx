'use client'

import { useState } from 'react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import AuthForm from '@/components/AuthForm'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import DashboardContent from '@/components/DashboardContent'
import ClientiContent from '@/components/ClientiContent'
import ScadenzeContent from '@/components/ScadenzeContent'
import BandiContent from '@/components/BandiContent'
import ProgettiContent from '@/components/ProgettiContent'
import SettingsContent from '@/components/SettingsContent'
import GmailClient from '@/components/GmailClient'
import ReportsContent from '@/components/ReportsContent'
import ProspectContent from '@/components/ProspectContent'
import FaqContent from '@/components/FaqContent'
import ConsulentiContent from '@/components/ConsulentiContent'
import ChatbotWidget from '@/components/ChatbotWidget'
import NoteInboxContent from '@/components/NoteInboxContent'
import { LoadingSpinner } from '@/components/shared'

function AppContent() {
  const { user, loading } = useAuth()
  const [activeItem, setActiveItem] = useState('dashboard')
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [navigationParams, setNavigationParams] = useState<any>(null)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="large" text="Caricamento..." />
      </div>
    )
  }

  if (!user) {
    return <AuthForm />
  }

  const handleNavigation = (page: string, params?: any) => {
    setActiveItem(page)
    setNavigationParams(params)
  }

  return <MainApp activeItem={activeItem} setActiveItem={setActiveItem} navigationParams={navigationParams} onNavigate={handleNavigation} sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />
}

function MainApp({ activeItem, setActiveItem, navigationParams, onNavigate, sidebarExpanded, setSidebarExpanded }: {
  activeItem: string
  setActiveItem: (item: string) => void
  navigationParams: any
  onNavigate: (page: string, params?: any) => void
  sidebarExpanded: boolean
  setSidebarExpanded: (expanded: boolean) => void
}) {
  const { isAdmin } = useAuth()
  const getPageTitle = () => {
    switch (activeItem) {
      case 'dashboard': return 'Dashboard'
      case 'scadenze': return 'Scadenzario'
      case 'prospect': return 'Prospect'
      case 'clienti': return 'Clienti'
      case 'bandi': return 'Bandi'
      case 'progetti': return 'Progetti'
      case 'email': return 'Centro Email'
      case 'note-inbox': return 'Inbox Note'
      case 'consulenti': return 'Consulenti'
      case 'reports': return 'Reports'
      case 'settings': return 'Impostazioni'
      case 'faq': return 'FAQ'
      default: return 'Dashboard'
    }
  }

  const getBreadcrumb = () => {
    switch (activeItem) {
      case 'dashboard': return ['Home', 'Dashboard']
      case 'scadenze': return ['Home', 'Scadenzario']
      case 'prospect': return ['Home', 'Gestione', 'Prospect']
      case 'clienti': return ['Home', 'Gestione', 'Clienti']
      case 'bandi': return ['Home', 'Gestione', 'Bandi']
      case 'progetti': return ['Home', 'Gestione', 'Progetti']
      case 'email': return ['Home', 'Comunicazione', 'Email']
      case 'note-inbox': return ['Home', 'Comunicazione', 'Inbox Note']
      case 'consulenti': return ['Home', 'Gestione', 'Consulenti']
      case 'reports': return ['Home', 'Analytics', 'Reports']
      case 'settings': return ['Home', 'Sistema', 'Impostazioni']
      case 'faq': return ['Home', 'Aiuto', 'FAQ']
      default: return ['Home', 'Dashboard']
    }
  }

  const renderContent = () => {
    switch (activeItem) {
      case 'dashboard':
        return <DashboardContent onNavigate={onNavigate} />
      case 'scadenze':
        return <ScadenzeContent navigationParams={navigationParams} />
      case 'prospect':
        return <ProspectContent onNavigate={onNavigate} navigationParams={navigationParams} />
      case 'clienti':
        return <ClientiContent onNavigate={onNavigate} navigationParams={navigationParams} />
      case 'bandi':
        return <BandiContent initialFilter={navigationParams?.filter} />
      case 'progetti':
        return <ProgettiContent initialFilter={navigationParams?.clienteFilter} onNavigate={onNavigate} />
      case 'email':
        return (
          <div className="overflow-hidden -m-4 h-[calc(100%+2rem)] w-[calc(100%+2rem)]">
            <GmailClient isOpen={true} onClose={() => setActiveItem('dashboard')} />
          </div>
        )
      case 'note-inbox':
        return <NoteInboxContent />
      case 'consulenti':
        return <ConsulentiContent onNavigate={onNavigate} />
      case 'reports':
        return <ReportsContent />
      case 'settings':
        return <SettingsContent />
      case 'faq':
        return <FaqContent />
      default:
        return <DashboardContent onNavigate={setActiveItem} />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        onSidebarStateChange={setSidebarExpanded}
      />

      {/* Main Content - with dynamic left margin based on sidebar state */}
      <div
        className={`flex flex-col h-screen overflow-hidden transition-all duration-300 ease-in-out ${
          sidebarExpanded ? 'ml-56' : 'ml-16'
        }`}
      >
        {/* Top Bar */}
        <TopBar title={getPageTitle()} breadcrumb={getBreadcrumb()} onNavigate={onNavigate} />

        {/* Page Content */}
        <main className="flex-1 min-h-0 p-4 overflow-auto">
          {renderContent()}
        </main>
      </div>

      <ChatbotWidget />
    </div>
  )
}

export default function HomePage() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}