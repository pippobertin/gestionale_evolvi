'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import ReportsContent from './ReportsContent'
import InterrogazioniContent from './InterrogazioniContent'

/**
 * Analisi: un solo posto per i numeri dello studio. Cruscotto con i grafici
 * (gli ex Report) ed Elenchi e ricerche (le ex Interrogazioni, con
 * esportazione in Excel). Le ricerche non si mostrano ai collaboratori limitati.
 */
export default function AnalisiContent({ scheda: iniziale = 'cruscotto' }: { scheda?: 'cruscotto' | 'ricerche' }) {
  const { user } = useAuth()
  const puoCercare = user?.livello_permessi !== 'collaboratore_limitato'
  const [scheda, setScheda] = useState<'cruscotto' | 'ricerche'>(iniziale)
  useEffect(() => { setScheda(iniziale) }, [iniziale])

  return (
    <div className="space-y-3">
      <nav className="flex gap-1 border-b border-gray-200">
        <button type="button" onClick={() => setScheda('cruscotto')}
          className={`px-3 py-2 text-sm inline-flex items-center gap-1.5 border-b-2 -mb-px ${scheda === 'cruscotto' ? 'border-slate-700 text-slate-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
          <BarChart3 className="w-4 h-4" /> Cruscotto
        </button>
        {puoCercare && (
          <button type="button" onClick={() => setScheda('ricerche')}
            className={`px-3 py-2 text-sm inline-flex items-center gap-1.5 border-b-2 -mb-px ${scheda === 'ricerche' ? 'border-slate-700 text-slate-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <Search className="w-4 h-4" /> Elenchi e ricerche
          </button>
        )}
      </nav>
      {scheda === 'ricerche' && puoCercare ? <InterrogazioniContent /> : <ReportsContent />}
    </div>
  )
}
