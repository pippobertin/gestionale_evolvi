'use client'

import { useCallback, useEffect, useState } from 'react'
import { HardDrive, RefreshCw } from 'lucide-react'

/**
 * Spostamento su Google Drive dei documenti dei clienti salvati nell'archivio
 * interno (solo amministratori): a lotti, con verifica, e poi eliminazione
 * delle copie interne quando su Drive è tutto a posto.
 */
type Stato = { totale: number; suDrive: number; daSpostare: number; copie: number }

export default function DocumentiSuDrive() {
  const [stato, setStato] = useState<Stato | null>(null)
  const [inCorso, setInCorso] = useState<'' | 'sposta' | 'elimina'>('')
  const [errori, setErrori] = useState<{ id: string; nome: string; errore: string }[]>([])
  const [messaggio, setMessaggio] = useState('')

  const carica = useCallback(async () => {
    const r = await fetch('/api/admin/documenti-drive')
    if (r.ok) setStato(await r.json())
  }, [])
  useEffect(() => { carica() }, [carica])

  const chiama = async (azione: string, salta: string[]) => {
    const r = await fetch('/api/admin/documenti-drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione, salta }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.error || `Errore ${r.status}`)
    return d
  }

  const sposta = async () => {
    setInCorso('sposta'); setMessaggio(''); setErrori([])
    const falliti: { id: string; nome: string; errore: string }[] = []
    let totale = 0
    try {
      // Lotto dopo lotto finché restano file da spostare; i file non riusciti si saltano e si elencano
      for (let giro = 0; giro < 200; giro++) {
        const d = await chiama('sposta', falliti.map(f => f.id))
        totale += d.spostati
        falliti.push(...d.errori)
        setStato({ totale: d.totale, suDrive: d.suDrive, daSpostare: d.daSpostare, copie: d.copie })
        setErrori([...falliti])
        if (d.spostati === 0 || d.daSpostare <= falliti.length) break
      }
      setMessaggio(`Spostati su Drive ${totale} documenti${falliti.length ? `; ${falliti.length} non riusciti, elencati sotto` : ''}.`)
    } catch (e) {
      setMessaggio(`Interrotto: ${e instanceof Error ? e.message : 'errore'}. Si può riprendere: i file già spostati non si ripetono.`)
    } finally {
      setInCorso('')
      carica()
    }
  }

  const eliminaCopie = async () => {
    if (!confirm('Eliminare le copie interne dei documenti già salvati su Drive? Prima conviene controllare su Drive alcune cartelle dei clienti.')) return
    setInCorso('elimina'); setMessaggio('')
    let totale = 0
    try {
      for (let giro = 0; giro < 20; giro++) {
        const d = await chiama('elimina_copie', [])
        totale += d.spostati
        if (d.spostati === 0 || d.copie === 0) break
      }
      setMessaggio(`Eliminate ${totale} copie interne: i documenti restano su Drive, collegati alla scheda del cliente.`)
    } catch (e) {
      setMessaggio(`Interrotto: ${e instanceof Error ? e.message : 'errore'}`)
    } finally {
      setInCorso('')
      carica()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive className="w-5 h-5 text-slate-600" />
        <h3 className="text-sm font-semibold text-gray-900">Documenti dei clienti su Google Drive</h3>
        <button type="button" onClick={carica} className="ml-auto p-1 text-gray-400 hover:text-gray-700" title="Aggiorna"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <p className="text-sm text-gray-600">
        I documenti caricati nella scheda del cliente vanno nel Drive condiviso, cartella CLIENTI/&lt;cliente&gt;/DOCUMENTI/&lt;categoria&gt;,
        coperta dal backup di Google Workspace. Quelli caricati prima erano nell&apos;archivio interno del gestionale, escluso dai backup:
        qui si spostano su Drive. Le copie interne restano finché non decidete di eliminarle.
      </p>
      {stato && (
        <div className="text-sm text-gray-800">
          Su Drive <strong>{stato.suDrive}</strong> documenti su {stato.totale}; da spostare <strong>{stato.daSpostare}</strong>; copie interne ancora presenti <strong>{stato.copie}</strong>.
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!inCorso || !stato?.daSpostare} onClick={sposta}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-40">
          {inCorso === 'sposta' ? 'Spostamento in corso… (non chiudere la pagina)' : 'Sposta i documenti su Drive'}
        </button>
        <button type="button" disabled={!!inCorso || !stato?.copie} onClick={eliminaCopie}
          className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded disabled:opacity-40">
          {inCorso === 'elimina' ? 'Eliminazione in corso…' : 'Elimina le copie interne'}
        </button>
      </div>
      {messaggio && <div className="p-2 bg-gray-50 border rounded text-sm text-gray-800">{messaggio}</div>}
      {errori.length > 0 && (
        <div className="text-xs text-red-700 space-y-0.5">
          {errori.map(e => <div key={e.id}>{e.nome}: {e.errore}</div>)}
        </div>
      )}
    </div>
  )
}
