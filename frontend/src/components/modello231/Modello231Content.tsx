'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, BadgeCheck, UserCheck, Scale, KeyRound, ClipboardList, Handshake, FileWarning, FileText, ListTodo } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import DaFare, { type DatiDaFare } from './DaFare'
import Qualifiche from './Qualifiche'
import Dichiarazioni from './Dichiarazioni'
import Conflitti from './Conflitti'
import Deleghe from './Deleghe'
import Personale from './Personale'
import Segnalatori from './Segnalatori'
import Deroghe from './Deroghe'
import ReportOdv from './ReportOdv'

/**
 * Registri del Modello 231. Per tutti la prima scheda è "Da fare". Gli
 * amministratori vedono tutti i registri; i collaboratori solo quelli in cui
 * hanno qualcosa da fare (il report all'OdV solo quando c'è una sezione da
 * confermare). L'OdV vede i registri in sola lettura, senza "Da fare".
 */

const SCHEDE = [
  { id: 'dafare', etichetta: 'Da fare', icona: ListTodo },
  { id: 'qualifiche', etichetta: 'Qualifica delle controparti', icona: BadgeCheck },
  { id: 'dichiarazioni', etichetta: 'Dichiarazioni degli interessi', icona: UserCheck },
  { id: 'conflitti', etichetta: 'Registro dei conflitti', icona: Scale },
  { id: 'deleghe', etichetta: 'Deleghe dei clienti', icona: KeyRound },
  { id: 'personale', etichetta: 'Ingressi e uscite', icona: ClipboardList },
  { id: 'segnalatori', etichetta: 'Segnalatori e compensi', icona: Handshake },
  { id: 'deroghe', etichetta: 'Registro delle deroghe', icona: FileWarning },
  { id: 'report', etichetta: 'Report semestrale all\'OdV', icona: FileText }
] as const
type IdScheda = (typeof SCHEDE)[number]['id']

// Etichette più vicine a chi non amministra
const ETICHETTE_COLLABORATORE: Partial<Record<IdScheda, string>> = {
  dichiarazioni: 'La mia dichiarazione degli interessi',
  conflitti: 'Conflitti di interesse',
  personale: 'La mia checklist',
  deroghe: 'Le mie deroghe'
}

export default function Modello231Content({ solaLettura = false }: { solaLettura?: boolean }) {
  const { user } = useAuth()
  const admin = user?.livello_permessi === 'admin'
  const [scheda, setScheda] = useState<IdScheda>(solaLettura ? 'qualifiche' : 'dafare')
  const [daFare, setDaFare] = useState<DatiDaFare | null>(null)
  const [errore, setErrore] = useState('')

  const caricaDaFare = useCallback(async () => {
    if (solaLettura) return
    try {
      const r = await fetch('/api/231/da-fare')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Elenco non disponibile')
      setDaFare(d); setErrore('')
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore')
    }
  }, [solaLettura])
  useEffect(() => { caricaDaFare() }, [caricaDaFare])

  const apri = (id: IdScheda) => {
    setScheda(id)
    // Tornando a "Da fare" l'elenco si aggiorna con quello che è stato fatto
    if (id === 'dafare') caricaDaFare()
  }

  // Deleghe, segnalatori e report compaiono al collaboratore solo se c'è qualcosa da fare lì
  const daFareIn = (id: IdScheda) => !!daFare?.voci.some(v => v.scheda === id)
  const visibili = SCHEDE.filter(s => {
    if (solaLettura) return s.id !== 'dafare'
    if (admin) return true
    if (s.id === 'deleghe' || s.id === 'segnalatori' || s.id === 'report') return daFareIn(s.id) || scheda === s.id
    return true
  })
  const conteggio = daFare?.voci.length || 0

  return (
    <div className="space-y-3">
      {!solaLettura && (
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-slate-600" />
          <h1 className="text-lg font-semibold text-gray-900">Modello 231</h1>
        </div>
      )}
      {!solaLettura && (
        <p className="text-xs text-gray-500">I registri previsti dal Modello 231. OdV è l&apos;Organismo di Vigilanza; le decisioni spettano all&apos;amministratrice unica.</p>
      )}
      <nav className="flex flex-wrap gap-1 border-b border-gray-200">
        {visibili.map(s => {
          const Icona = s.icona
          const etichetta = !admin && !solaLettura ? ETICHETTE_COLLABORATORE[s.id] || s.etichetta : s.etichetta
          return (
            <button key={s.id} type="button" onClick={() => apri(s.id)}
              className={`px-3 py-2 text-sm inline-flex items-center gap-1.5 border-b-2 -mb-px ${scheda === s.id ? 'border-slate-700 text-slate-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              <Icona className="w-4 h-4" /> {etichetta}
              {s.id === 'dafare' && conteggio > 0 && (
                <span className="ml-0.5 px-1.5 rounded-full bg-red-600 text-white text-xs">{conteggio}</span>
              )}
            </button>
          )
        })}
      </nav>
      {scheda === 'dafare' && <DaFare dati={daFare} errore={errore} apri={id => apri(id as IdScheda)} />}
      {scheda === 'qualifiche' && <Qualifiche solaLettura={solaLettura} />}
      {scheda === 'dichiarazioni' && <Dichiarazioni solaLettura={solaLettura} />}
      {scheda === 'conflitti' && <Conflitti solaLettura={solaLettura} />}
      {scheda === 'deleghe' && <Deleghe solaLettura={solaLettura} />}
      {scheda === 'personale' && <Personale solaLettura={solaLettura} />}
      {scheda === 'segnalatori' && <Segnalatori solaLettura={solaLettura} />}
      {scheda === 'deroghe' && <Deroghe solaLettura={solaLettura} />}
      {scheda === 'report' && <ReportOdv solaLettura={solaLettura} />}
    </div>
  )
}
