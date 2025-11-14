'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import DashboardContent from '@/components/DashboardContent'
import ClientiContent from '@/components/ClientiContent'
import ScadenzeContent from '@/components/ScadenzeContent'
import BandiContent from '@/components/BandiContent'
import ProgettiContent from '@/components/ProgettiContent'

export default function HomePage() {
  const [activeItem, setActiveItem] = useState('dashboard')
  const [sidebarExpanded, setSidebarExpanded] = useState(true)

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
        return <DashboardContent onNavigate={setActiveItem} />
      case 'scadenze':
        return <ScadenzeContent />
      case 'clienti':
        return <ClientiContent />
      case 'bandi':
        return <BandiContent />
      case 'progetti':
        return <ProgettiContent />
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
        return (
          <div className="bg-white rounded-lg card-shadow p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Impostazioni Sistema</h2>
            <p className="text-gray-600">Sezione in sviluppo - Configurazione sistema</p>
          </div>
        )
      default:
        return <DashboardContent />
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