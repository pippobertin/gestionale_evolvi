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
  const getPageTitle = () => {
    switch (activeItem) {
      case 'dashboard': return 'Dashboard'
      case 'scadenze': return 'Scadenzario'
      case 'clienti': return 'Clienti'
      case 'bandi': return 'Bandi'
      case 'progetti': return 'Progetti'
      case 'consulenti': return 'Consulenti'
      case 'reports': return 'Reports'
      case 'settings': return 'Impostazioni'
      default: return 'Dashboard'
    }
  }

  const getBreadcrumb = () => {
    switch (activeItem) {
      case 'dashboard': return ['Home', 'Dashboard']
      case 'scadenze': return ['Home', 'Scadenzario']
      case 'clienti': return ['Home', 'Gestione', 'Clienti']
      case 'bandi': return ['Home', 'Gestione', 'Bandi']
      case 'progetti': return ['Home', 'Gestione', 'Progetti']
      case 'consulenti': return ['Home', 'Gestione', 'Consulenti']
      case 'reports': return ['Home', 'Analytics', 'Reports']
      case 'settings': return ['Home', 'Sistema', 'Impostazioni']
      default: return ['Home', 'Dashboard']
    }
  }

  const renderContent = () => {
    switch (activeItem) {
      case 'dashboard':
        return <DashboardContent onNavigate={onNavigate} />
      case 'scadenze':
        return <ScadenzeContent />
      case 'clienti':
        return <ClientiContent onNavigate={onNavigate} />
      case 'bandi':
        return <BandiContent initialFilter={navigationParams?.filter} />
      case 'progetti':
        return <ProgettiContent initialFilter={navigationParams?.clienteFilter} onNavigate={onNavigate} />
      case 'consulenti':
        return (
          <div className="bg-white rounded-lg card-shadow p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Gestione Consulenti</h2>
            <p className="text-gray-600">Sezione in sviluppo - Team e consulenti</p>
          </div>
        )
      case 'reports':
        return (
          <div className="bg-white rounded-lg card-shadow p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Reports & Analytics</h2>
            <p className="text-gray-600">Sezione in sviluppo - Reportistica avanzata</p>
          </div>
        )
      case 'settings':
        return <SettingsContent />
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
        className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          sidebarExpanded ? 'ml-72' : 'ml-16'
        }`}
      >
        {/* Top Bar */}
        <TopBar title={getPageTitle()} breadcrumb={getBreadcrumb()} />

        {/* Page Content */}
        <main className="flex-1 p-6">
          {renderContent()}
        </main>
      </div>
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