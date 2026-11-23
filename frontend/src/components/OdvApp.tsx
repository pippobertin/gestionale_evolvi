'use client'

import { useState } from 'react'
import { ScrollText, Database, Key, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import RegistroAttivita from './RegistroAttivita'
import BackupGestionale from './BackupGestionale'
import ChangeOwnPassword from './ChangeOwnPassword'
import Modello231Content from './modello231/Modello231Content'

/**
 * Area dell'Organismo di Vigilanza (fase 4C): consultazione in sola lettura dei
 * registri previsti dal Modello 231. Nessun accesso a clienti, pratiche o
 * impostazioni; il database stesso non concede altro al ruolo OdV.
 */

type Scheda = 'registro' | 'registri231' | 'backup' | 'password'

const SCHEDE: { id: Scheda; etichetta: string; icona: typeof ScrollText }[] = [
  { id: 'registro', etichetta: 'Registro attività', icona: ScrollText },
  { id: 'registri231', etichetta: 'Registri del Modello 231', icona: ShieldCheck },
  { id: 'backup', etichetta: 'Backup e prove di ripristino', icona: Database },
  { id: 'password', etichetta: 'La mia password', icona: Key }
]

export default function OdvApp() {
  const { user, logout } = useAuth()
  const [scheda, setScheda] = useState<Scheda>('registro')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-slate-600" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">Gestionale Evolvi · Area dell&apos;Organismo di Vigilanza</div>
            <div className="text-xs text-gray-500">
              Consultazione in sola lettura dei registri del Modello 231 · {user?.nome_completo}
            </div>
          </div>
          <button onClick={() => logout()}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1">
            <LogOut className="w-4 h-4" /> Esci
          </button>
        </div>
        <nav className="max-w-7xl mx-auto px-4 flex gap-1">
          {SCHEDE.map(s => {
            const Icona = s.icona
            return (
              <button key={s.id} onClick={() => setScheda(s.id)}
                className={`px-3 py-2 text-sm flex items-center gap-1.5 border-b-2 ${scheda === s.id ? 'border-slate-700 text-slate-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                <Icona className="w-4 h-4" /> {s.etichetta}
              </button>
            )
          })}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {scheda === 'registro' && <RegistroAttivita modalita="odv" />}
        {scheda === 'registri231' && <Modello231Content solaLettura />}
        {scheda === 'backup' && <BackupGestionale solaLettura />}
        {scheda === 'password' && <ChangeOwnPassword />}
      </main>
    </div>
  )
}
