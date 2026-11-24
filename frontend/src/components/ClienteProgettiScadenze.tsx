'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Target, Calendar, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProgettoForm from './ProgettoForm'

/**
 * Prima scheda del cliente: che cosa succede con lui. Progetti con la loro fase
 * e scadenze aperte, più il pulsante per creare un progetto già intestato al
 * cliente. Un clic su un progetto lo apre sopra la scheda del cliente, così
 * chiudendolo si torna al cliente.
 */
type Props = {
  cliente: { id: string; denominazione: string; partita_iva?: string; codice_fiscale?: string }
  onNavigate?: (page: string, params?: any) => void
}

const FASI: Record<string, string> = {
  incarico: 'Incarico', progettazione: 'Progettazione', controllo_preinvio: 'Controllo prima dell\'invio', invio: 'Conferma e invio', inviata: 'Inviata'
}
const STATI: Record<string, string> = {
  DECRETO_ATTESO: 'In attesa del decreto', DECRETO_RICEVUTO: 'Decreto ricevuto', ACCETTATO: 'Accettato', IN_CORSO: 'In corso',
  COMPLETATO: 'Chiuso', SCADUTO: 'Scaduto', ANNULLATO: 'Annullato'
}

const dataIt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('it-IT') : '')

export default function ClienteProgettiScadenze({ cliente, onNavigate }: Props) {
  const [progetti, setProgetti] = useState<any[]>([])
  const [scadenze, setScadenze] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [nuovo, setNuovo] = useState(false)
  // Progetto aperto qui, sopra la scheda del cliente: alla chiusura si torna al cliente
  const [aperto, setAperto] = useState<any | null>(null)

  const carica = useCallback(async () => {
    setLoading(true)
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('scadenze_bandi_progetti_view')
        .select('id, titolo_progetto, codice_progetto, bando_nome, fase, stato, stato_calcolato, created_at')
        .eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
      supabase.from('scadenze_bandi_scadenze')
        .select('id, titolo, data_scadenza, stato, responsabile_email, progetto_id')
        .eq('cliente_id', cliente.id).neq('stato', 'completata').order('data_scadenza', { ascending: true }).limit(50)
    ])
    setProgetti(p || [])
    setScadenze(s || [])
    setLoading(false)
  }, [cliente.id])
  useEffect(() => { carica() }, [carica])

  const statoProgetto = (p: any) => p.fase && p.fase !== 'inviata' ? FASI[p.fase] || p.fase : STATI[p.stato_calcolato || p.stato] || (p.stato_calcolato || p.stato || '')
  const prossima = (progettoId: string) => scadenze.find(s => s.progetto_id === progettoId)
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
  const giorni = (d: string) => Math.round((new Date(d).getTime() - oggi.getTime()) / 86400000)
  const apriProgetto = async (id: string) => {
    const { data } = await supabase.from('scadenze_bandi_progetti_view').select('*').eq('id', id).single()
    if (data) setAperto(data)
    else onNavigate?.('progetti', { openProgettoId: id })
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Caricamento…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Target className="w-4 h-4 text-gray-500" /> Progetti ({progetti.length})</h3>
        <button type="button" onClick={() => setNuovo(true)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg inline-flex items-center gap-1">
          <Plus className="w-4 h-4" /> Nuovo progetto per questo cliente
        </button>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg divide-y">
        {progetti.length === 0 && <div className="p-4 text-sm text-gray-500">Nessun progetto per questo cliente.</div>}
        {progetti.map(p => {
          const s = prossima(p.id)
          return (
            <button key={p.id} type="button" onClick={() => apriProgetto(p.id)} className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{p.titolo_progetto}</div>
                <div className="text-xs text-gray-500 truncate">{[p.bando_nome, p.codice_progetto].filter(Boolean).join(' · ')}</div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 whitespace-nowrap">{statoProgetto(p)}</span>
              <span className="text-xs text-gray-500 whitespace-nowrap w-48 text-right">
                {s ? <>{s.titolo.slice(0, 28)}{s.titolo.length > 28 ? '…' : ''} · {dataIt(s.data_scadenza)}</> : 'nessuna scadenza aperta'}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          )
        })}
      </div>

      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-500" /> Scadenze aperte ({scadenze.length})</h3>
      <div className="bg-white border border-gray-200 rounded-lg divide-y">
        {scadenze.length === 0 && <div className="p-4 text-sm text-gray-500">Nessuna scadenza aperta.</div>}
        {scadenze.map(s => {
          const g = giorni(s.data_scadenza)
          return (
            <div key={s.id} className="px-3 py-2 flex items-center gap-3 text-sm">
              <span className="flex-1 truncate text-gray-900">{s.titolo}</span>
              <span className="text-xs text-gray-500 truncate max-w-[12rem]">{s.responsabile_email}</span>
              <span className={`text-xs whitespace-nowrap ${g < 0 ? 'text-red-700 font-medium' : g <= 7 ? 'text-amber-700' : 'text-gray-600'}`}>
                {dataIt(s.data_scadenza)} · {g < 0 ? `scaduta da ${-g} gg` : g === 0 ? 'oggi' : `tra ${g} gg`}
              </span>
            </div>
          )
        })}
      </div>

      {nuovo && (
        <ProgettoForm
          cliente={{ id: cliente.id, denominazione: cliente.denominazione, partita_iva: cliente.partita_iva || '', codice_fiscale: cliente.codice_fiscale || '' }}
          onClose={() => setNuovo(false)}
          onProgettoCreated={(id) => { setNuovo(false); carica(); if (id) apriProgetto(id) }}
        />
      )}

      {aperto && (
        <ProgettoForm
          progetto={aperto}
          onClose={() => { setAperto(null); carica() }}
          onProgettoCreated={() => { setAperto(null); carica() }}
        />
      )}
    </div>
  )
}
