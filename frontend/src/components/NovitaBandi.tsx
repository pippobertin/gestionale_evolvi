'use client'

import { useCallback, useEffect, useState } from 'react'
import { Radar, AlertTriangle, FileText, ExternalLink } from 'lucide-react'

/**
 * Cruscotto, "Novità sui bandi": collegamenti nuovi trovati dal controllo
 * automatico delle pagine dei bandi. "È la graduatoria" la registra e apre i
 * progetti del bando; "Non interessa" la toglie. Si vede solo se c'è qualcosa.
 */
type Novita = { id: string; bando_id: string; bando_nome: string; url: string; testo: string | null; tipo: string; parole: string[]; trovata_il: string }

export default function NovitaBandi({ onNavigate }: { onNavigate?: (page: string, params?: any) => void }) {
  const [novita, setNovita] = useState<Novita[]>([])
  const carica = useCallback(async () => {
    const r = await fetch('/api/bandi/novita')
    if (r.ok) setNovita((await r.json()).novita || [])
  }, [])
  useEffect(() => { carica() }, [carica])

  const decidi = async (n: Novita, stato: 'graduatoria' | 'non_interessa') => {
    const r = await fetch('/api/bandi/novita', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id, stato }) })
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || 'Operazione non riuscita'); return }
    setNovita(prev => prev.filter(x => x.id !== n.id))
    if (stato === 'graduatoria') onNavigate?.('progetti', { clienteFilter: n.bando_nome })
  }

  if (novita.length === 0) return null
  return (
    <div className="bg-white border border-amber-300 rounded-xl p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-1"><Radar className="w-4 h-4 text-amber-600" /> Novità sui bandi ({novita.length})</h2>
      <p className="text-xs text-gray-500 mb-2">Collegamenti nuovi comparsi sulle pagine dei bandi con progetti in attesa del decreto. Apri il collegamento, poi indica se è la graduatoria.</p>
      <div className="divide-y">
        {novita.map(n => (
          <div key={n.id} className="py-2 flex flex-wrap items-start gap-2 text-sm">
            {n.tipo === 'graduatoria' ? <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" /> : <FileText className="w-4 h-4 text-gray-400 mt-0.5" />}
            <div className="flex-1 min-w-[14rem]">
              <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-1 break-words">
                {n.testo || n.url} <ExternalLink className="w-3 h-3" />
              </a>
              <div className="text-xs text-gray-500">
                {n.bando_nome} · {new Date(n.trovata_il).toLocaleDateString('it-IT')} · {n.tipo === 'graduatoria' ? `possibile graduatoria (${n.parole.join(', ')})` : 'nuovo documento'}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => decidi(n, 'graduatoria')} className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded">È la graduatoria</button>
              <button type="button" onClick={() => decidi(n, 'non_interessa')} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Non interessa</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
