'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Loader2, X, AlertTriangle, AlertCircle } from 'lucide-react'
import { ultimiMesi } from '@/lib/rna/importer'

/**
 * Pulsante "Aggiorna da RNA": uguale in ogni scheda cliente, aggiorna gli aiuti
 * RNA di TUTTI i clienti per il periodo scelto.
 *
 * L'importazione non può partire dal gestionale (rna.gov.it non risponde ai
 * server cloud): il pulsante registra una richiesta che l'agente sul Mac
 * esegue entro qualche minuto. Il pulsante mostra lo stato e, a fine
 * importazione, chiama onCompletato per ricaricare la sezione.
 */

interface Richiesta {
  id: string
  mese_da: string
  mese_a: string
  origine: string
  stato: 'IN_ATTESA' | 'IN_CORSO' | 'OK' | 'ERRORE'
  mesi_totali: number | null
  mesi_completati: number
  mese_corrente: string | null
  nuovi: number | null
  mesi_in_errore: number | null
  errore: string | null
  created_at: string
  completata_at: string | null
}

interface Stato {
  attiva: Richiesta | null
  ultima_completata: Richiesta | null
  agente: { id: string; ultimo_contatto_at: string; stato: string | null } | null
}

const PRIMO_MESE = '2016-10'
const fmtMese = (m: string) => { const [y, mm] = m.split('_'); return `${mm}/${y}` }
const fmtDataOra = (d: string) => new Date(d).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
const toUnderscore = (m: string) => m.replace('-', '_')
const toDash = (m: string) => m.replace('_', '-')

type Preset = '4' | '12' | '36' | 'storico' | 'custom'

export default function AggiornaRnaButton({ onCompletato }: { onCompletato: () => void }) {
  const [stato, setStato] = useState<Stato | null>(null)
  const [aperto, setAperto] = useState(false)
  const [preset, setPreset] = useState<Preset>('4')
  const corrente = ultimiMesi(1)[0]
  const [customDa, setCustomDa] = useState(toDash(ultimiMesi(12)[11]))
  const [customA, setCustomA] = useState(toDash(corrente))
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const ultimaVista = useRef<string | null>(null)
  // La callback del genitore cambia a ogni render: la teniamo in un ref per non
  // ricreare `carica` (e rifare la fetch) a ogni render.
  const onCompletatoRef = useRef(onCompletato)
  onCompletatoRef.current = onCompletato

  const carica = useCallback(async () => {
    try {
      const res = await fetch('/api/rna/richieste')
      const json = await res.json()
      if (!json.success) return
      const s: Stato = json.data
      setStato(s)
      // Fine di un'importazione: ricarica la sezione
      const idFine = s.ultima_completata?.id || null
      if (ultimaVista.current && idFine && idFine !== ultimaVista.current && !s.attiva) onCompletatoRef.current()
      ultimaVista.current = idFine
    } catch { /* silenzioso: il pulsante resta usabile */ }
  }, [])

  useEffect(() => { carica() }, [carica])

  // Mentre c'è una richiesta attiva, controlla ogni 10 secondi
  useEffect(() => {
    if (!stato?.attiva) return
    const t = setInterval(carica, 10000)
    return () => clearInterval(t)
  }, [stato?.attiva, carica])

  const periodo = (): [string, string] => {
    if (preset === 'storico') return ['2020_01', corrente]
    if (preset === 'custom') return [toUnderscore(customDa), toUnderscore(customA)]
    const n = Number(preset)
    return [ultimiMesi(n)[n - 1], corrente]
  }

  const conferma = async () => {
    setErrore(null)
    const [da, a] = periodo()
    if (!da || !a || da > a) { setErrore('Controlla il periodo: il mese iniziale deve precedere quello finale'); return }
    try {
      setInvio(true)
      const res = await fetch('/api/rna/richieste', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mese_da: da, mese_a: a }),
      })
      const json = await res.json()
      if (!json.success) { setErrore(json.error || 'Richiesta non riuscita'); return }
      setStato(json.data)
      ultimaVista.current = json.data.ultima_completata?.id || null
      setAperto(false)
    } catch {
      setErrore('Errore di rete')
    } finally {
      setInvio(false)
    }
  }

  const attiva = stato?.attiva
  const agenteFermo = !stato?.agente ||
    Date.now() - new Date(stato.agente.ultimo_contatto_at).getTime() > 15 * 60000
  const ultima = stato?.ultima_completata

  return (
    <div className="flex flex-col items-end gap-1">
      {attiva ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {attiva.stato === 'IN_ATTESA'
            ? `Aggiornamento ${fmtMese(attiva.mese_da)}–${fmtMese(attiva.mese_a)} in attesa del Mac…`
            : `Aggiornamento in corso: ${attiva.mesi_completati}/${attiva.mesi_totali ?? '?'} mesi${attiva.mese_corrente ? ` (${fmtMese(attiva.mese_corrente)})` : ''}`}
        </div>
      ) : (
        <button
          onClick={() => { setErrore(null); setAperto(true) }}
          className="px-3 py-1.5 text-xs font-medium text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-50 inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Aggiorna da RNA
        </button>
      )}
      {attiva && agenteFermo && (
        <span className="text-[10px] text-amber-700">Il Mac di aggiornamento non risponde: partirà quando sarà acceso.</span>
      )}
      {!attiva && ultima && (
        <span className={`text-[10px] ${ultima.stato === 'ERRORE' || (ultima.mesi_in_errore || 0) > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
          Ultima importazione {fmtMese(ultima.mese_da)}–{fmtMese(ultima.mese_a)}
          {ultima.completata_at ? ` · ${fmtDataOra(ultima.completata_at)}` : ''}
          {ultima.stato === 'ERRORE' ? ' · non riuscita' : (ultima.mesi_in_errore || 0) > 0 ? ` · ${ultima.mesi_in_errore} mesi non letti` : ''}
        </span>
      )}

      {aperto && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => !invio && setAperto(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md text-left" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <h3 className="text-sm font-semibold text-gray-900">Aggiorna gli aiuti da RNA</h3>
              <button onClick={() => setAperto(false)} disabled={invio} className="p-1 text-gray-500 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3 text-xs">
              <p className="text-gray-600">
                L&apos;aggiornamento vale per <strong>tutti i clienti</strong>. Per un cliente appena inserito scegli lo storico completo.
              </p>
              {([
                ['4', 'Ultimi 4 mesi', 'pochi secondi'],
                ['12', 'Ultimi 12 mesi', 'circa 1 minuto'],
                ['36', 'Ultimi 3 anni', 'circa 6 minuti · periodo della capienza de minimis'],
                ['storico', 'Storico completo dal 2020', 'circa 15 minuti · per i clienti nuovi'],
                ['custom', 'Periodo personalizzato', ''],
              ] as Array<[Preset, string, string]>).map(([v, label, nota]) => (
                <label key={v} className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" className="mt-0.5" checked={preset === v} onChange={() => setPreset(v)} />
                  <span>
                    <span className="font-medium text-gray-800">{label}</span>
                    {nota && <span className="text-gray-500"> — {nota}</span>}
                  </span>
                </label>
              ))}
              {preset === 'custom' && (
                <div className="ml-6 flex items-center gap-2">
                  <input type="month" min={PRIMO_MESE} max={toDash(corrente)} value={customDa} onChange={e => setCustomDa(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1" />
                  <span className="text-gray-500">→</span>
                  <input type="month" min={PRIMO_MESE} max={toDash(corrente)} value={customA} onChange={e => setCustomA(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1" />
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-md p-2.5 text-[11px] text-gray-600">
                L&apos;importazione viene eseguita dal Mac di aggiornamento (RNA non risponde ai server del gestionale) e parte entro 5 minuti.
                {stato?.agente && !agenteFermo && <> Il Mac è attivo (ultimo contatto {fmtDataOra(stato.agente.ultimo_contatto_at)}).</>}
              </div>
              {agenteFermo && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 text-[11px] text-amber-800 flex gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  {stato?.agente
                    ? <>Il Mac di aggiornamento non risponde dal {fmtDataOra(stato.agente.ultimo_contatto_at)}: la richiesta resterà in attesa finché non sarà acceso e collegato.</>
                    : <>Nessun Mac di aggiornamento ha ancora contattato il gestionale: la richiesta resterà in attesa.</>}
                </div>
              )}
              {errore && (
                <div className="bg-red-50 border border-red-200 rounded-md p-2 flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-3.5 h-3.5" /> {errore}
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 px-5 py-3 flex justify-end gap-2">
              <button onClick={() => setAperto(false)} disabled={invio} className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Annulla</button>
              <button onClick={conferma} disabled={invio}
                className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 inline-flex items-center gap-1.5 disabled:opacity-60">
                {invio && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Avvia aggiornamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
