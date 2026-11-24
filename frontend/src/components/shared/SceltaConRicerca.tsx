'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

/**
 * Menu a tendina con ricerca: si scrive una parte del nome (o della partita
 * IVA, del codice) e l'elenco si restringe. Frecce e Invio per scegliere, Esc
 * per chiudere. Sostituisce i menu a tendina lunghi (clienti, bandi, progetti).
 */
export type OpzioneRicerca = { id: string; etichetta: string; dettaglio?: string | null }

type Props = {
  valore: string
  onChange: (id: string) => void
  opzioni: OpzioneRicerca[]
  segnaposto?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

const normalizza = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const MASSIMO = 50

export default function SceltaConRicerca({ valore, onChange, opzioni, segnaposto = 'Cerca…', disabled, required, className }: Props) {
  const [aperto, setAperto] = useState(false)
  const [testo, setTesto] = useState('')
  const [evidenziata, setEvidenziata] = useState(0)
  const contenitore = useRef<HTMLDivElement>(null)
  const scelta = opzioni.find(o => o.id === valore)

  // Clic fuori: si chiude senza cambiare la scelta
  useEffect(() => {
    if (!aperto) return
    const chiudi = (e: MouseEvent) => { if (contenitore.current && !contenitore.current.contains(e.target as Node)) { setAperto(false); setTesto('') } }
    document.addEventListener('mousedown', chiudi)
    return () => document.removeEventListener('mousedown', chiudi)
  }, [aperto])

  const filtrate = useMemo(() => {
    const parole = normalizza(testo).split(/\s+/).filter(Boolean)
    const tutte = parole.length === 0 ? opzioni : opzioni.filter(o => {
      const dove = normalizza(`${o.etichetta} ${o.dettaglio || ''}`)
      return parole.every(p => dove.includes(p))
    })
    return tutte.slice(0, MASSIMO)
  }, [opzioni, testo])
  const totaleTrovate = useMemo(() => (testo ? null : opzioni.length), [opzioni.length, testo])

  const scegli = (id: string) => { onChange(id); setAperto(false); setTesto('') }

  const tasti = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAperto(true); setEvidenziata(i => Math.min(i + 1, filtrate.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setEvidenziata(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { if (aperto && filtrate[evidenziata]) { e.preventDefault(); scegli(filtrate[evidenziata].id) } }
    else if (e.key === 'Escape') { setAperto(false); setTesto('') }
  }

  return (
    <div ref={contenitore} className="relative">
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          value={aperto ? testo : scelta ? `${scelta.etichetta}${scelta.dettaglio ? ` · ${scelta.dettaglio}` : ''}` : ''}
          placeholder={scelta && aperto ? scelta.etichetta : segnaposto}
          onFocus={() => { setAperto(true); setEvidenziata(0) }}
          onChange={e => { setTesto(e.target.value); setAperto(true); setEvidenziata(0) }}
          onKeyDown={tasti}
          className={className || 'w-full p-3 pr-16 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100'}
          autoComplete="off"
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1 text-gray-400">
          {scelta && !disabled && (
            <button type="button" tabIndex={-1} title="Togli la scelta" onClick={() => onChange('')} className="p-0.5 hover:text-gray-700"><X className="w-4 h-4" /></button>
          )}
          <ChevronDown className="w-4 h-4 pointer-events-none" />
        </div>
      </div>
      {/* Campo nascosto per l'avviso del browser quando la scelta è obbligatoria */}
      {required && <input tabIndex={-1} aria-hidden className="absolute opacity-0 pointer-events-none w-px h-px bottom-0 left-4" value={valore} onChange={() => {}} required />}
      {aperto && !disabled && (
        <ul className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg text-sm">
          {filtrate.length === 0 && <li className="px-3 py-2 text-gray-500">Nessun risultato per «{testo}»</li>}
          {filtrate.map((o, i) => (
            <li key={o.id}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => scegli(o.id)}
                onMouseEnter={() => setEvidenziata(i)}
                className={`w-full text-left px-3 py-2 ${i === evidenziata ? 'bg-blue-50' : ''} ${o.id === valore ? 'font-medium' : ''}`}
              >
                <span className="text-gray-900">{o.etichetta}</span>
                {o.dettaglio && <span className="text-gray-500"> · {o.dettaglio}</span>}
              </button>
            </li>
          ))}
          {totaleTrovate !== null && totaleTrovate > MASSIMO && (
            <li className="px-3 py-2 text-xs text-gray-500 border-t">Scrivi per cercare tra tutti i {totaleTrovate} elementi</li>
          )}
          {testo && filtrate.length === MASSIMO && (
            <li className="px-3 py-2 text-xs text-gray-500 border-t">Mostrati i primi {MASSIMO}: scrivi qualcosa in più per restringere</li>
          )}
        </ul>
      )}
    </div>
  )
}
