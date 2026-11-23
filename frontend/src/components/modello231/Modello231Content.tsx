'use client'

import { useState } from 'react'
import { ShieldCheck, BadgeCheck, UserCheck, Scale, KeyRound, ClipboardList } from 'lucide-react'
import Qualifiche from './Qualifiche'
import Dichiarazioni from './Dichiarazioni'
import Conflitti from './Conflitti'
import Deleghe from './Deleghe'
import Personale from './Personale'

/** Registri del Modello 231: qualifiche, interessi, conflitti, deleghe dei clienti, ingressi e uscite. */

const SCHEDE = [
  { id: 'qualifiche', etichetta: 'Qualifica delle controparti', icona: BadgeCheck },
  { id: 'dichiarazioni', etichetta: 'Dichiarazioni degli interessi', icona: UserCheck },
  { id: 'conflitti', etichetta: 'Registro dei conflitti', icona: Scale },
  { id: 'deleghe', etichetta: 'Deleghe dei clienti', icona: KeyRound },
  { id: 'personale', etichetta: 'Ingressi e uscite', icona: ClipboardList }
] as const

export default function Modello231Content({ solaLettura = false }: { solaLettura?: boolean }) {
  const [scheda, setScheda] = useState<(typeof SCHEDE)[number]['id']>('qualifiche')
  return (
    <div className="space-y-3">
      {!solaLettura && (
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-slate-600" />
          <h1 className="text-lg font-semibold text-gray-900">Modello 231</h1>
        </div>
      )}
      <nav className="flex flex-wrap gap-1 border-b border-gray-200">
        {SCHEDE.map(s => {
          const Icona = s.icona
          return (
            <button key={s.id} type="button" onClick={() => setScheda(s.id)}
              className={`px-3 py-2 text-sm inline-flex items-center gap-1.5 border-b-2 -mb-px ${scheda === s.id ? 'border-slate-700 text-slate-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              <Icona className="w-4 h-4" /> {s.etichetta}
            </button>
          )
        })}
      </nav>
      {scheda === 'qualifiche' && <Qualifiche solaLettura={solaLettura} />}
      {scheda === 'dichiarazioni' && <Dichiarazioni solaLettura={solaLettura} />}
      {scheda === 'conflitti' && <Conflitti solaLettura={solaLettura} />}
      {scheda === 'deleghe' && <Deleghe solaLettura={solaLettura} />}
      {scheda === 'personale' && <Personale solaLettura={solaLettura} />}
    </div>
  )
}
