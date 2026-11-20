'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { ScrollText, Download, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { LoadingSpinner } from './shared'
import {
  ETICHETTE_CANALE, ETICHETTE_EVENTO, GRUPPI_EVENTO, areeRegistro, etichettaTabella
} from '@/lib/registroEtichette'

/**
 * Registro delle operazioni (fase 4A, Modello 231): chi ha fatto che cosa e
 * quando, con filtri ed esportazione per il consulente e l'OdV. Sola lettura.
 */

type Riga = {
  id: number
  quando: string
  utente_id: string | null
  utente_nome: string | null
  canale: string
  evento: string
  tabella: string | null
  record_id: string | null
  cliente_id: string | null
  descrizione: string | null
  campi: string[] | null
  prima: Record<string, unknown> | null
  dopo: Record<string, unknown> | null
  esito: string
  dettagli: Record<string, unknown> | null
}

type Filtri = {
  da: string
  a: string
  utente: string
  gruppo: string
  area: string
  cliente: string
  q: string
  esito: string
}

function giorno(offsetGiorni: number) {
  const d = new Date(Date.now() + offsetGiorni * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d)
}

const FILTRI_INIZIALI: Filtri = {
  da: giorno(-30), a: giorno(0), utente: '', gruppo: '', area: '', cliente: '', q: '', esito: ''
}

const COLORI_EVENTO: Record<string, string> = {
  inserimento: 'bg-green-100 text-green-800',
  modifica: 'bg-blue-100 text-blue-800',
  eliminazione: 'bg-red-100 text-red-800',
  accesso: 'bg-gray-100 text-gray-700',
  uscita: 'bg-gray-100 text-gray-500',
  accesso_negato: 'bg-amber-100 text-amber-800',
  cambio_password: 'bg-purple-100 text-purple-800',
  reimpostazione_password: 'bg-purple-100 text-purple-800',
  email_inviata: 'bg-teal-100 text-teal-800',
  esportazione_registro: 'bg-gray-100 text-gray-700'
}

function etichettaCampo(campo: string) {
  return campo.replace(/_/g, ' ')
}

function valoreLeggibile(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'vuoto'
  if (typeof v === 'boolean') return v ? 'sì' : 'no'
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
      return new Date(v).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })
    }
    return v.length > 300 ? v.slice(0, 300) + '…' : v
  }
  const testo = JSON.stringify(v)
  return testo.length > 300 ? testo.slice(0, 300) + '…' : testo
}

function Dettaglio({ riga }: { riga: Riga }) {
  const [tutti, setTutti] = useState(false)

  if (riga.evento === 'modifica' && riga.campi?.length) {
    return (
      <table className="text-xs w-full">
        <thead>
          <tr className="text-gray-500">
            <th className="text-left font-medium pr-3 py-0.5 w-48">Campo</th>
            <th className="text-left font-medium pr-3 py-0.5">Prima</th>
            <th className="text-left font-medium py-0.5">Dopo</th>
          </tr>
        </thead>
        <tbody>
          {riga.campi.map(c => (
            <tr key={c} className="align-top">
              <td className="pr-3 py-0.5 text-gray-600">{etichettaCampo(c)}</td>
              <td className="pr-3 py-0.5 text-red-700 break-all">{valoreLeggibile(riga.prima?.[c])}</td>
              <td className="py-0.5 text-green-700 break-all">{valoreLeggibile(riga.dopo?.[c])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  const dati = riga.evento === 'eliminazione' ? riga.prima : riga.evento === 'inserimento' ? riga.dopo : riga.dettagli
  if (!dati) return <p className="text-xs text-gray-500">Nessun dettaglio</p>

  const voci = Object.entries(dati).filter(([, v]) => tutti || (v !== null && v !== '' && v !== undefined))
  const mostrate = tutti ? voci : voci.slice(0, 14)
  return (
    <div className="text-xs">
      {riga.evento === 'eliminazione' && (
        <p className="text-gray-600 mb-1">Dati al momento dell&apos;eliminazione, conservati per un eventuale ripristino.</p>
      )}
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5">
        {mostrate.map(([k, v]) => (
          <div key={k} className="flex gap-2 min-w-0">
            <dt className="text-gray-500 shrink-0 w-40 truncate">{etichettaCampo(k)}</dt>
            <dd className="text-gray-800 break-all">{valoreLeggibile(v)}</dd>
          </div>
        ))}
      </dl>
      {voci.length > 14 && !tutti && (
        <button onClick={() => setTutti(true)} className="mt-1 text-blue-600 hover:underline">
          Mostra tutti i campi ({voci.length})
        </button>
      )}
    </div>
  )
}

export default function RegistroAttivita() {
  const [filtri, setFiltri] = useState<Filtri>(FILTRI_INIZIALI)
  const [applicati, setApplicati] = useState<Filtri>(FILTRI_INIZIALI)
  const [pagina, setPagina] = useState(0)
  const [righe, setRighe] = useState<Riga[]>([])
  const [totale, setTotale] = useState(0)
  const [perPagina, setPerPagina] = useState(100)
  const [nomiClienti, setNomiClienti] = useState<Record<string, string>>({})
  const [utenti, setUtenti] = useState<{ id: string; nome: string }[]>([])
  const [aperte, setAperte] = useState<Set<number>>(new Set())
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState('')

  const parametri = useCallback((f: Filtri) => {
    const p = new URLSearchParams()
    Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v) })
    return p
  }, [])

  const carica = useCallback(async (f: Filtri, pag: number) => {
    setCaricamento(true)
    setErrore('')
    try {
      const p = parametri(f)
      p.set('pagina', String(pag))
      const r = await fetch(`/api/admin/registro?${p.toString()}`)
      const testo = await r.text()
      let d: any
      try { d = JSON.parse(testo) } catch { throw new Error(`Il server non ha risposto correttamente (errore ${r.status})`) }
      if (!r.ok) throw new Error(d.error || 'Registro non disponibile')
      setRighe(d.righe)
      setTotale(d.totale)
      setPerPagina(d.perPagina)
      setNomiClienti(d.nomiClienti || {})
      setUtenti(d.utenti || [])
      setAperte(new Set())
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore')
    } finally {
      setCaricamento(false)
    }
  }, [parametri])

  useEffect(() => { carica(applicati, pagina) }, [applicati, pagina, carica])

  const applica = () => { setPagina(0); setApplicati({ ...filtri }) }
  const azzera = () => { setFiltri(FILTRI_INIZIALI); setPagina(0); setApplicati(FILTRI_INIZIALI) }
  const esporta = () => {
    const p = parametri(applicati)
    p.set('formato', 'csv')
    window.location.href = `/api/admin/registro?${p.toString()}`
  }
  const apriChiudi = (id: number) => setAperte(prev => {
    const nuovo = new Set(prev)
    if (nuovo.has(id)) nuovo.delete(id); else nuovo.add(id)
    return nuovo
  })

  const campo = 'px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const pagine = Math.max(1, Math.ceil(totale / perPagina))

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-3 mb-2">
        <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
          <ScrollText className="w-4 h-4 text-slate-600" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Registro attività</h1>
          <p className="text-gray-600 text-sm">
            Chi ha fatto che cosa e quando. Il registro non si può modificare né cancellare.
          </p>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 items-end"
          onKeyDown={e => { if (e.key === 'Enter') applica() }}>
          <label className="text-xs text-gray-600">Dal
            <input type="date" value={filtri.da} onChange={e => setFiltri({ ...filtri, da: e.target.value })} className={`${campo} w-full`} />
          </label>
          <label className="text-xs text-gray-600">Al
            <input type="date" value={filtri.a} onChange={e => setFiltri({ ...filtri, a: e.target.value })} className={`${campo} w-full`} />
          </label>
          <label className="text-xs text-gray-600">Persona
            <select value={filtri.utente} onChange={e => setFiltri({ ...filtri, utente: e.target.value })} className={`${campo} w-full`}>
              <option value="">Tutte</option>
              {utenti.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              <option value="nessuno">Automatico o database</option>
            </select>
          </label>
          <label className="text-xs text-gray-600">Tipo
            <select value={filtri.gruppo} onChange={e => setFiltri({ ...filtri, gruppo: e.target.value })} className={`${campo} w-full`}>
              <option value="">Tutti</option>
              {Object.entries(GRUPPI_EVENTO).map(([k, g]) => <option key={k} value={k}>{g.etichetta}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Area
            <select value={filtri.area} onChange={e => setFiltri({ ...filtri, area: e.target.value })} className={`${campo} w-full`}>
              <option value="">Tutte</option>
              {areeRegistro().map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Cliente
            <input type="text" value={filtri.cliente} placeholder="denominazione"
              onChange={e => setFiltri({ ...filtri, cliente: e.target.value })} className={`${campo} w-full`} />
          </label>
          <label className="text-xs text-gray-600">Cerca
            <input type="text" value={filtri.q} placeholder="testo nell'oggetto"
              onChange={e => setFiltri({ ...filtri, q: e.target.value })} className={`${campo} w-full`} />
          </label>
          <label className="text-xs text-gray-600">Esito
            <select value={filtri.esito} onChange={e => setFiltri({ ...filtri, esito: e.target.value })} className={`${campo} w-full`}>
              <option value="">Tutti</option>
              <option value="ok">Riuscito</option>
              <option value="negato">Negato</option>
              <option value="errore">Errore</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={applica} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Applica filtri
          </button>
          <button onClick={azzera} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Azzera
          </button>
          <button onClick={esporta} disabled={totale === 0}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1 disabled:opacity-50 ml-auto"
            title="Scarica le righe filtrate in un file apribile con Excel (fino a 10.000)">
            <Download className="w-3.5 h-3.5" /> Esporta per Excel
          </button>
        </div>
      </div>

      {errore && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errore}</div>}

      {/* Elenco */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-2 border-b border-gray-200 text-sm text-gray-600 flex items-center justify-between">
          <span>{totale.toLocaleString('it-IT')} operazioni</span>
          {pagine > 1 && (
            <span className="flex items-center gap-2">
              <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0 || caricamento}
                className="px-2 py-0.5 border border-gray-300 rounded disabled:opacity-40">Precedenti</button>
              pagina {pagina + 1} di {pagine}
              <button onClick={() => setPagina(p => Math.min(pagine - 1, p + 1))} disabled={pagina >= pagine - 1 || caricamento}
                className="px-2 py-0.5 border border-gray-300 rounded disabled:opacity-40">Successive</button>
            </span>
          )}
        </div>

        {caricamento ? (
          <div className="p-6"><LoadingSpinner /></div>
        ) : righe.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">Nessuna operazione con questi filtri.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="w-6"></th>
                <th className="px-2 py-1.5 text-left">Data e ora</th>
                <th className="px-2 py-1.5 text-left">Persona</th>
                <th className="px-2 py-1.5 text-left">Evento</th>
                <th className="px-2 py-1.5 text-left">Area</th>
                <th className="px-2 py-1.5 text-left">Oggetto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {righe.map(r => {
                const aperta = aperte.has(r.id)
                return (
                  <Fragment key={r.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer align-top" onClick={() => apriChiudi(r.id)}>
                      <td className="pl-2 py-1.5 text-gray-400">
                        {aperta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-gray-700">
                        {new Date(r.quando).toLocaleString('it-IT', {
                          timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {r.utente_nome || <span className="text-gray-400">{ETICHETTE_CANALE[r.canale] || r.canale}</span>}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COLORI_EVENTO[r.evento] || 'bg-gray-100 text-gray-700'}`}>
                          {ETICHETTE_EVENTO[r.evento] || r.evento}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-gray-600">{etichettaTabella(r.tabella)}</td>
                      <td className="px-2 py-1.5">
                        <span className="text-gray-900">{r.descrizione}</span>
                        {r.cliente_id && nomiClienti[r.cliente_id] && r.tabella !== 'scadenze_bandi_clienti' && (
                          <span className="text-gray-500"> · {nomiClienti[r.cliente_id]}</span>
                        )}
                        {r.evento === 'modifica' && r.campi?.length ? (
                          <span className="text-gray-400 text-xs"> · {r.campi.map(etichettaCampo).join(', ')}</span>
                        ) : null}
                      </td>
                    </tr>
                    {aperta && (
                      <tr className="bg-gray-50">
                        <td></td>
                        <td colSpan={5} className="px-2 py-2">
                          <Dettaglio riga={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
