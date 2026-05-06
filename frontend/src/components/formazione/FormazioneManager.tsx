'use client'

import { useState, useEffect } from 'react'
import {
  BarChart3, Award, BookOpen, GraduationCap,
  ShieldCheck, FileText, ClipboardList
} from 'lucide-react'
import SecondaryTabsBar from '../shared/SecondaryTabsBar'
import FormazionePanoramica from './FormazionePanoramica'
import AdesioneFpiManager from './AdesioneFpiManager'
import PianiFormativiManager from './PianiFormativiManager'
import CorsiFormativiManager from './CorsiFormativiManager'
import CertificazioniObbligatorieManager from './CertificazioniObbligatorieManager'
import DocumentiFormazioneManager from './DocumentiFormazioneManager'
import RilevazioneFabbisognoManager from './RilevazioneFabbisognoManager'
import { supabase } from '@/lib/supabase'

interface FormazioneManagerProps {
  clienteId: string
}

const subTabs = [
  { id: 'panoramica', label: 'Panoramica', icon: BarChart3 },
  { id: 'adesione_fpi', label: 'Adesione FPI', icon: Award },
  { id: 'piani', label: 'Piani Formativi', icon: BookOpen },
  { id: 'corsi', label: 'Corsi ed Edizioni', icon: GraduationCap },
  { id: 'certificazioni', label: 'Certificazioni Obbligatorie', icon: ShieldCheck },
  { id: 'documenti', label: 'Documenti Formazione', icon: FileText },
  { id: 'fabbisogno', label: 'Rilevazione Fabbisogno', icon: ClipboardList },
]

export default function FormazioneManager({ clienteId }: FormazioneManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState('panoramica')
  const [hasAdesione, setHasAdesione] = useState<boolean | null>(null)

  useEffect(() => {
    checkAdesione()
  }, [clienteId])

  const checkAdesione = async () => {
    const { count } = await supabase
      .from('scadenze_bandi_clienti_adesioni_fpi')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .eq('stato', 'ATTIVA')

    setHasAdesione((count ?? 0) > 0)
  }

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'panoramica':
        return <FormazionePanoramica clienteId={clienteId} />
      case 'adesione_fpi':
        return <AdesioneFpiManager clienteId={clienteId} onAdesioneChange={checkAdesione} />
      case 'piani':
        return (
          <>
            {hasAdesione === false && <FpiInfoBox />}
            <PianiFormativiManager clienteId={clienteId} hasAdesioneFpi={hasAdesione ?? false} />
          </>
        )
      case 'corsi':
        return <CorsiFormativiManager clienteId={clienteId} />
      case 'certificazioni':
        return <CertificazioniObbligatorieManager clienteId={clienteId} />
      case 'documenti':
        return <DocumentiFormazioneManager clienteId={clienteId} />
      case 'fabbisogno':
        return <RilevazioneFabbisognoManager clienteId={clienteId} />
      default:
        return null
    }
  }

  return (
    <div className="space-y-2">
      <SecondaryTabsBar
        tabs={subTabs}
        activeTab={activeSubTab}
        onTabChange={setActiveSubTab}
      />
      {renderSubTabContent()}
    </div>
  )
}

function FpiInfoBox() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
      <div className="flex items-start space-x-2">
        <Award className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Nessuna adesione al fondo registrata</p>
          <p className="mt-1">Si possono comunque registrare piani di formazione privata o corsi obbligatori.
            Le funzionalità specifiche FPI saranno disponibili dopo aver registrato un'adesione.</p>
        </div>
      </div>
    </div>
  )
}
