'use client'

import { useEffect, useState } from 'react'
import { FileText, Landmark } from 'lucide-react'
import BandiContent from './BandiContent'
import BandiEsterniManager from './BandiEsterniManager'

/**
 * Bandi in una sola pagina: "Su cui lavoriamo" (i bandi dello studio, con
 * progetti e scadenze) e "Catalogo" (i bandi segnalati da Agevolando). Dal
 * catalogo "Lavoriamo su questo bando" crea il bando dello studio già compilato.
 */
type Scheda = 'nostri' | 'catalogo'

export default function BandiPagina({ schedaIniziale = 'nostri', initialFilter, onNavigate }: {
  schedaIniziale?: Scheda
  initialFilter?: string
  onNavigate?: (page: string, params?: any) => void
}) {
  const [scheda, setScheda] = useState<Scheda>(schedaIniziale)
  const [cerca, setCerca] = useState(initialFilter || '')
  // Arrivando da un'altra pagina con un bando da cercare
  useEffect(() => { if (initialFilter) { setCerca(initialFilter); setScheda('nostri') } }, [initialFilter])

  // Dal catalogo al bando dello studio (appena creato o già presente)
  const apriNostro = (nome: string) => { setCerca(nome); setScheda('nostri') }

  const SCHEDE = [
    { id: 'nostri' as const, etichetta: 'Su cui lavoriamo', icona: FileText },
    { id: 'catalogo' as const, etichetta: 'Catalogo', icona: Landmark }
  ]

  return (
    <div className="space-y-3">
      <nav className="flex gap-1 border-b border-gray-200">
        {SCHEDE.map(s => {
          const Icona = s.icona
          return (
            <button key={s.id} type="button" onClick={() => { setScheda(s.id); if (s.id === 'nostri') setCerca('') }}
              className={`px-3 py-2 text-sm inline-flex items-center gap-1.5 border-b-2 -mb-px ${scheda === s.id ? 'border-slate-700 text-slate-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              <Icona className="w-4 h-4" /> {s.etichetta}
            </button>
          )
        })}
      </nav>
      {scheda === 'nostri' && <BandiContent key={cerca} initialFilter={cerca} onNavigate={onNavigate} />}
      {scheda === 'catalogo' && <BandiEsterniManager onApriNostro={apriNostro} />}
    </div>
  )
}
