'use client'

import { CheckCircle2, ChevronRight, Gavel } from 'lucide-react'
import { LoadingSpinner } from '../shared'
import { Avvisi } from './comune'

/**
 * Da fare nel Modello 231: ciò che tocca a chi è collegato, e per chi decide le
 * decisioni in attesa. Ogni voce porta alla scheda in cui si fa.
 */
export type VoceDaFare = { scheda: string; testo: string; decisione?: boolean }
export type DatiDaFare = { voci: VoceDaFare[]; conteggio: number; admin?: boolean }

function Elenco({ voci, vuoto, apri }: { voci: VoceDaFare[]; vuoto: string; apri: (scheda: string) => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y">
      {voci.length === 0 && <div className="p-3 text-sm text-gray-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> {vuoto}</div>}
      {voci.map((v, i) => (
        <button key={i} type="button" onClick={() => apri(v.scheda)} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
          <span className="flex-1 text-gray-900">{v.testo}</span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      ))}
    </div>
  )
}

export default function DaFare({ dati, errore, apri }: { dati: DatiDaFare | null; errore: string; apri: (scheda: string) => void }) {
  if (!dati && !errore) return <div className="p-6"><LoadingSpinner /></div>
  if (!dati) return <Avvisi errore={errore} messaggio="" />
  const mie = dati.voci.filter(v => !v.decisione)
  const decisioni = dati.voci.filter(v => v.decisione)

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Le cose che il Modello 231 chiede a te. Un clic su una voce apre la scheda in cui si fa.</p>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">I miei adempimenti</h3>
        <Elenco voci={mie} vuoto="Niente da fare per te in questo momento." apri={apri} />
      </div>
      {(decisioni.length > 0 || dati.admin) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-1.5"><Gavel className="w-4 h-4 text-gray-500" /> Decisioni in attesa</h3>
          <Elenco voci={decisioni} vuoto="Nessuna decisione in attesa." apri={apri} />
        </div>
      )}
    </div>
  )
}
