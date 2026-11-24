'use client'

import { useState, useEffect, useRef } from 'react'
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
import ProspectContent from '@/components/ProspectContent'
import FaqContent from '@/components/FaqContent'
import ConsulentiContent from '@/components/ConsulentiContent'
import ChatbotWidget from '@/components/ChatbotWidget'
import NoteInboxContent from '@/components/NoteInboxContent'
import AnalisiContent from '@/components/AnalisiContent'
import BandiEsterniManager from '@/components/BandiEsterniManager'
import { LoadingSpinner } from '@/components/shared'
import OdvApp from '@/components/OdvApp'
import { titoloPagina } from '@/lib/navigazione'
import Modello231Content from '@/components/modello231/Modello231Content'

// True solo quando la pagina è stata ricaricata (F5 / reload), non alla prima apertura.
function isPageReload(): boolean {
  if (typeof window === 'undefined') return false
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return nav?.type === 'reload'
}

function AppContent() {
  const { user, loading } = useAuth()
  const [activeItem, setActiveItem] = useState(() =>
    isPageReload() ? (sessionStorage.getItem('evolvi_active_item') || 'dashboard') : 'dashboard'
  )
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [navigationParams, setNavigationParams] = useState<any>(null)

  // Memorizza la sezione corrente per ripristinarla in caso di refresh.
  useEffect(() => {
    sessionStorage.setItem('evolvi_active_item', activeItem)
  }, [activeItem])

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

  // Organismo di Vigilanza: solo i registri, in sola lettura (fase 4C)
  if (user.livello_permessi === 'odv') {
    return <OdvApp />
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
  const mainScrollRef = useRef<HTMLElement>(null)

  // Salva la posizione di scorrimento del contenuto, per sezione.
  const handleMainScroll = () => {
    const el = mainScrollRef.current
    if (el) sessionStorage.setItem(`evolvi_scroll_${activeItem}`, String(el.scrollTop))
  }

  // Dopo un refresh, ripristina lo scorrimento della sezione una volta che
  // il contenuto (caricato in modo asincrono) ha raggiunto un'altezza sufficiente.
  useEffect(() => {
    if (!isPageReload()) return
    const el = mainScrollRef.current
    if (!el) return
    const saved = parseInt(sessionStorage.getItem(`evolvi_scroll_${activeItem}`) || '0', 10)
    if (!saved) return

    let rafId = 0
    const start = Date.now()
    const tick = () => {
      if (el.scrollHeight - el.clientHeight >= saved) {
        el.scrollTop = saved
        return
      }
      if (Date.now() - start < 5000) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        return <BandiContent initialFilter={navigationParams?.filter} onNavigate={onNavigate} />
      case 'bandi-esterni':
        return <BandiEsterniManager />
      case 'progetti':
        return <ProgettiContent initialFilter={navigationParams?.clienteFilter} openProgettoId={navigationParams?.openProgettoId} onNavigate={onNavigate} />
      case 'email':
        return (
          <div className="overflow-hidden -m-4 h-[calc(100%+2rem)] w-[calc(100%+2rem)]">
            <GmailClient isOpen={true} onClose={() => setActiveItem('dashboard')} />
          </div>
        )
      case 'note-inbox':
        return <NoteInboxContent />
      case 'interrogazioni':
        return <AnalisiContent scheda="ricerche" />
      case 'consulenti':
        return <ConsulentiContent onNavigate={onNavigate} />
      case 'reports':
        return <AnalisiContent scheda="cruscotto" />
      case 'modello231':
        return <Modello231Content />
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
        <TopBar title={titoloPagina(activeItem)} onNavigate={onNavigate} />

        {/* Page Content */}
        <main ref={mainScrollRef} onScroll={handleMainScroll} className="flex-1 min-h-0 p-4 overflow-auto">
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