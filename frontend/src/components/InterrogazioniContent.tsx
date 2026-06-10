/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search, Filter, X, Download, FileText, Loader2, ChevronDown, ChevronRight, Database, RotateCcw,
  Mail, Calendar, Send, CheckCircle2, AlertTriangle
} from 'lucide-react'

// ----------------------------------------------------------------
// Tipi (replicati dal registry per non importare server-side in client)
// ----------------------------------------------------------------

type FiltroTipo =
  | 'text' | 'select' | 'multiselect_array' | 'multiselect_scalar'
  | 'number' | 'number_range' | 'date_range'

interface OpzioneFiltro { value: string; label: string }
interface DefinizioneFiltro {
  campo: string
  label: string
  tipo: FiltroTipo
  opzioni?: OpzioneFiltro[]
  placeholder?: string
}
interface SottoAmbito { id: string; label: string; filtri: DefinizioneFiltro[] }
interface DefinizioneColonna {
  campo: string
  label: string
  formato?: string
  enum_labels?: Record<string, string>
}
interface DefinizioneAmbito {
  id: string
  label: string
  descrizione?: string
  tabella: string
  sotto_ambiti: SottoAmbito[]
  colonne_risultati: DefinizioneColonna[]
  azioni_bulk: string[]
  azione_email?: { campo_email: string; campo_email_fallback?: string; campo_nome: string }
  azione_scadenza?: { campo_cliente_id: string; campo_nome: string }
}

type ValoreFiltro =
  | { tipo: 'text'; valore: string }
  | { tipo: 'select'; valore: string }
  | { tipo: 'multiselect_array'; valori: string[] }
  | { tipo: 'multiselect_scalar'; valori: string[] }
  | { tipo: 'number'; valore: number }
  | { tipo: 'number_range'; min?: number; max?: number }
  | { tipo: 'date_range'; da?: string; a?: string }

// ----------------------------------------------------------------
// Lista ambiti caricata dinamicamente dall'API
// ----------------------------------------------------------------

interface AmbitoSommario {
  id: string
  label: string
  descrizione?: string
}

const ICONE_AMBITO: Record<string, string> = {
  clienti: '🏢',
  prospect: '🎯',
  fabbisogni: '📋',
  bandi: '📂',
  progetti: '🚀',
  piani: '🎓',
  corsi: '📚',
  fpi: '💼',
  contratti: '📑',
}

// ----------------------------------------------------------------
// Componente principale
// ----------------------------------------------------------------

export default function InterrogazioniContent() {
  const [ambitiDisponibili, setAmbitiDisponibili] = useState<AmbitoSommario[]>([])
  const [ambitoId, setAmbitoId] = useState<string>('fabbisogni')
  const [definizioneAmbito, setDefinizioneAmbito] = useState<DefinizioneAmbito | null>(null)
  const [filtri, setFiltri] = useState<Record<string, ValoreFiltro>>({})
  const [risultati, setRisultati] = useState<any[]>([])
  const [totale, setTotale] = useState(0)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [sottoAmbitiAperti, setSottoAmbitiAperti] = useState<Set<string>>(new Set())
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showScadenzaModal, setShowScadenzaModal] = useState(false)
  const [esitoAzione, setEsitoAzione] = useState<{ tipo: 'success' | 'error'; messaggio: string } | null>(null)

  // Carica elenco ambiti disponibili (una volta sola)
  useEffect(() => {
    fetch('/api/interrogazioni/ambito')
      .then(r => r.json())
      .then(j => {
        if (j.success && Array.isArray(j.data)) {
          setAmbitiDisponibili(j.data)
        }
      })
      .catch(() => {})
  }, [])

  // Carica la definizione dell'ambito dal client (statica per ora)
  useEffect(() => {
    // Per non duplicare il file di config, lo carichiamo da /api
    fetch(`/api/interrogazioni/ambito?id=${ambitoId}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setDefinizioneAmbito(j.data)
          // Apri il primo sotto-ambito di default
          if (j.data?.sotto_ambiti?.length) {
            setSottoAmbitiAperti(new Set([j.data.sotto_ambiti[0].id]))
          }
        }
      })
      .catch(() => {})
  }, [ambitoId])

  // Esegui ricerca con debounce
  const ricerca = useCallback(async () => {
    if (!definizioneAmbito) return
    setLoading(true)
    setErrore(null)
    try {
      const res = await fetch('/api/interrogazioni/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ambito: ambitoId,
          filtri,
          per_pagina: 100,
        }),
      })
      const j = await res.json()
      if (!j.success) {
        setErrore(j.error || 'Errore di ricerca')
        return
      }
      setRisultati(j.data.righe)
      setTotale(j.data.totale)
    } catch (e: any) {
      setErrore(e.message || 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }, [ambitoId, filtri, definizioneAmbito])

  useEffect(() => {
    if (!definizioneAmbito) return
    const t = setTimeout(ricerca, 350)
    return () => clearTimeout(t)
  }, [filtri, definizioneAmbito, ricerca])

  // Reset filtri
  const resetFiltri = () => setFiltri({})

  // Export Excel / PDF
  const esegueExport = async (formato: 'excel' | 'pdf') => {
    if (!definizioneAmbito) return
    setExporting(formato)
    try {
      const endpoint = formato === 'excel' ? 'export-excel' : 'export-pdf'
      const extension = formato === 'excel' ? 'xlsx' : 'pdf'
      const res = await fetch(`/api/interrogazioni/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambito: ambitoId, filtri }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setErrore(j?.error || `Errore export ${formato}`)
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const oggi = new Date().toISOString().slice(0, 10)
      a.download = `Interrogazione_${ambitoId}_${oggi}.${extension}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setErrore(e.message || 'Errore export')
    } finally {
      setExporting(null)
    }
  }

  const numeroFiltriAttivi = useMemo(() => {
    return Object.values(filtri).filter(f => {
      if (!f) return false
      if ('valore' in f) return f.valore !== '' && f.valore !== undefined && !Number.isNaN(f.valore)
      if ('valori' in f) return Array.isArray(f.valori) && f.valori.length > 0
      if ('min' in f || 'max' in f) return f.min !== undefined || f.max !== undefined
      if ('da' in f || 'a' in f) return f.da !== undefined || f.a !== undefined
      return false
    }).length
  }, [filtri])

  if (!definizioneAmbito) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header con selezione ambito + KPI */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Interrogazioni database</h2>
              <p className="text-xs text-gray-500">{definizioneAmbito.descrizione}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-teal-700">{loading ? '…' : totale}</p>
            <p className="text-xs text-gray-500">risultati</p>
          </div>
        </div>

        {/* Ambito picker — caricato dinamicamente dal server */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {ambitiDisponibili.map(a => {
            const attivo = ambitoId === a.id
            const icona = ICONE_AMBITO[a.id] || '🔎'
            return (
              <button
                key={a.id}
                onClick={() => {
                  setAmbitoId(a.id)
                  setFiltri({})
                  setRisultati([])
                  setDefinizioneAmbito(null)
                }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  attivo
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title={a.descrizione}
              >
                <span className="mr-1">{icona}</span>
                {a.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Layout 2 colonne: filtri + risultati, con scroll indipendenti */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 lg:h-[calc(100vh-260px)] lg:min-h-[500px]">

        {/* Colonna filtri (scroll proprio) */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 overflow-y-auto lg:h-full">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">Filtri</h3>
              {numeroFiltriAttivi > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
                  {numeroFiltriAttivi}
                </span>
              )}
            </div>
            {numeroFiltriAttivi > 0 && (
              <button
                onClick={resetFiltri}
                className="text-xs text-gray-500 hover:text-red-600 inline-flex items-center"
                title="Azzera filtri"
              >
                <RotateCcw className="w-3 h-3 mr-0.5" />
                Reset
              </button>
            )}
          </div>

          <div className="space-y-1">
            {definizioneAmbito.sotto_ambiti.map(sa => {
              const aperto = sottoAmbitiAperti.has(sa.id)
              return (
                <div key={sa.id} className="border border-gray-100 rounded-md overflow-hidden">
                  <button
                    onClick={() => {
                      const nuovo = new Set(sottoAmbitiAperti)
                      if (aperto) nuovo.delete(sa.id)
                      else nuovo.add(sa.id)
                      setSottoAmbitiAperti(nuovo)
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
                  >
                    <span>{sa.label}</span>
                    {aperto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  {aperto && (
                    <div className="p-3 space-y-3">
                      {sa.filtri.map(f => (
                        <ControlloFiltro
                          key={f.campo}
                          definizione={f}
                          valore={filtri[f.campo]}
                          onChange={(v) => {
                            const nuovo = { ...filtri }
                            if (v) nuovo[f.campo] = v
                            else delete nuovo[f.campo]
                            setFiltri(nuovo)
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Colonna risultati (toolbar fissa + tabella con scroll proprio) */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col lg:h-full">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 flex-shrink-0">
            <div className="flex items-center space-x-2 text-sm text-gray-700">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />}
              <span>
                {loading ? 'Ricerca in corso...' : `${totale} risultati`}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => esegueExport('excel')}
                disabled={exporting !== null || risultati.length === 0}
                className="text-xs px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium inline-flex items-center disabled:opacity-50"
                title="Esporta in Excel"
              >
                {exporting === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Download className="w-3.5 h-3.5 mr-1" />}
                Excel
              </button>
              <button
                onClick={() => esegueExport('pdf')}
                disabled={exporting !== null || risultati.length === 0}
                className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md font-medium inline-flex items-center disabled:opacity-50"
                title="Esporta in PDF"
              >
                {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
                PDF
              </button>
              {definizioneAmbito.azioni_bulk.includes('email') && (
                <button
                  onClick={() => { setEsitoAzione(null); setShowEmailModal(true) }}
                  disabled={risultati.length === 0}
                  className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md font-medium inline-flex items-center disabled:opacity-50"
                  title="Invia email a tutti i destinatari del subset"
                >
                  <Mail className="w-3.5 h-3.5 mr-1" />
                  Email
                </button>
              )}
              {definizioneAmbito.azioni_bulk.includes('crea_scadenza') && (
                <button
                  onClick={() => { setEsitoAzione(null); setShowScadenzaModal(true) }}
                  disabled={risultati.length === 0}
                  className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md font-medium inline-flex items-center disabled:opacity-50"
                  title="Crea una scadenza per ogni cliente del subset"
                >
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  Scadenza
                </button>
              )}
            </div>
          </div>

          {errore && (
            <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
              {errore}
            </div>
          )}

          {risultati.length === 0 && !loading ? (
            <div className="p-12 text-center flex-1 overflow-y-auto">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {numeroFiltriAttivi === 0
                  ? 'Nessun filtro attivo: la ricerca ha restituito tutti i record disponibili (oppure nessuno).'
                  : 'Nessun risultato con i filtri impostati. Prova a rilassarli.'}
              </p>
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    {definizioneAmbito.colonne_risultati.map(c => (
                      <th key={c.campo} className="text-left px-3 py-2 font-medium whitespace-nowrap">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {risultati.map((r, idx) => (
                    <tr key={r.id || idx} className="hover:bg-gray-50">
                      {definizioneAmbito.colonne_risultati.map(c => (
                        <td key={c.campo} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[280px] overflow-hidden text-ellipsis">
                          {formattaPerVista(leggiCampoLocale(r, c.campo), c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showEmailModal && (
        <EmailBulkModal
          ambitoId={ambitoId}
          filtri={filtri}
          onClose={() => setShowEmailModal(false)}
          onEsito={(esito) => { setEsitoAzione(esito); setShowEmailModal(false) }}
        />
      )}

      {showScadenzaModal && (
        <ScadenzaBulkModal
          ambitoId={ambitoId}
          filtri={filtri}
          onClose={() => setShowScadenzaModal(false)}
          onEsito={(esito) => { setEsitoAzione(esito); setShowScadenzaModal(false) }}
        />
      )}

      {esitoAzione && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg z-50 max-w-md flex items-start gap-3 ${
          esitoAzione.tipo === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {esitoAzione.tipo === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <div className="text-sm flex-1">{esitoAzione.messaggio}</div>
          <button onClick={() => setEsitoAzione(null)} className="hover:opacity-70"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Modali per le azioni bulk
// ----------------------------------------------------------------

function EmailBulkModal({ ambitoId, filtri, onClose, onEsito }: {
  ambitoId: string
  filtri: Record<string, ValoreFiltro>
  onClose: () => void
  onEsito: (esito: { tipo: 'success' | 'error'; messaggio: string }) => void
}) {
  const [oggetto, setOggetto] = useState('')
  const [corpo, setCorpo] = useState('Gentile {nome},\n\n\n\nCordiali saluti,')
  const [destinatari, setDestinatari] = useState<Array<{ email: string; nome: string }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  // Carica anteprima destinatari all'apertura
  useEffect(() => {
    setLoading(true)
    fetch('/api/interrogazioni/email-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ambito: ambitoId, filtri, anteprima_destinatari: true }),
    })
      .then(r => r.json())
      .then(j => {
        if (j.success) setDestinatari(j.data.destinatari)
        else setErrore(j.error || 'Errore caricamento destinatari')
      })
      .catch(e => setErrore(e.message))
      .finally(() => setLoading(false))
  }, [ambitoId, filtri])

  const invia = async () => {
    setSending(true)
    setErrore(null)
    try {
      const res = await fetch('/api/interrogazioni/email-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambito: ambitoId, filtri, oggetto, corpo }),
      })
      const j = await res.json()
      if (!j.success) {
        setErrore(j.error || 'Errore invio')
        return
      }
      onEsito({
        tipo: 'success',
        messaggio: `Email inviate: ${j.data.inviati}/${j.data.totale_destinatari}${j.data.falliti > 0 ? ` (falliti: ${j.data.falliti})` : ''}`,
      })
    } catch (e: any) {
      setErrore(e.message || 'Errore di rete')
    } finally {
      setSending(false)
    }
  }

  return (
    <ModaleBase title="Invio email di gruppo" onClose={onClose} icon={<Mail className="w-5 h-5" />}>
      {loading ? (
        <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-teal-600 mx-auto" /></div>
      ) : (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <p className="font-medium">
              {destinatari?.length ?? 0} destinatari univoci con email valida.
            </p>
            <p className="mt-1">Le email saranno inviate dal tuo account Gmail collegato, in sequenza con piccola pausa tra una e l&apos;altra. Puoi usare il placeholder <code className="bg-white px-1 py-0.5 rounded">{`{nome}`}</code> per personalizzare il messaggio.</p>
          </div>

          {destinatari && destinatari.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Anteprima destinatari (primi 8)
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded p-2 text-xs text-gray-700 max-h-32 overflow-y-auto">
                {destinatari.slice(0, 8).map(d => (
                  <div key={d.email} className="py-0.5">
                    {d.nome} <span className="text-gray-400">— {d.email}</span>
                  </div>
                ))}
                {destinatari.length > 8 && (
                  <div className="text-gray-400 italic mt-1">…e altri {destinatari.length - 8}.</div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Oggetto</label>
            <input
              type="text"
              value={oggetto}
              onChange={e => setOggetto(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Es. Aggiornamento bando IA"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Corpo email</label>
            <textarea
              rows={8}
              value={corpo}
              onChange={e => setCorpo(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">Verra&apos; formattato in HTML con header e firma standard.</p>
          </div>

          {errore && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{errore}</div>}

          <div className="flex justify-end space-x-2 pt-2">
            <button onClick={onClose} className="text-sm px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50" disabled={sending}>Annulla</button>
            <button
              onClick={invia}
              disabled={sending || !oggetto.trim() || !corpo.trim() || !destinatari?.length}
              className="text-sm px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium inline-flex items-center disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}
              Invia a {destinatari?.length ?? 0} destinatari
            </button>
          </div>
        </div>
      )}
    </ModaleBase>
  )
}

function ScadenzaBulkModal({ ambitoId, filtri, onClose, onEsito }: {
  ambitoId: string
  filtri: Record<string, ValoreFiltro>
  onClose: () => void
  onEsito: (esito: { tipo: 'success' | 'error'; messaggio: string }) => void
}) {
  const [titolo, setTitolo] = useState('Follow-up: {nome}')
  const [descrizione, setDescrizione] = useState('Contattare {nome} a seguito dell\'interrogazione filtrata nel gestionale.')
  const [dataScadenza, setDataScadenza] = useState('')
  const [priorita, setPriorita] = useState<'ALTA' | 'MEDIA' | 'BASSA'>('MEDIA')
  const [categoria, setCategoria] = useState('follow_up_interrogazione')
  const [responsabileEmail, setResponsabileEmail] = useState('')
  const [creando, setCreando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const crea = async () => {
    setCreando(true)
    setErrore(null)
    try {
      const res = await fetch('/api/interrogazioni/crea-scadenza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ambito: ambitoId,
          filtri,
          titolo_template: titolo,
          descrizione_template: descrizione,
          data_scadenza: dataScadenza,
          priorita,
          categoria: categoria || 'follow_up',
          responsabile_email: responsabileEmail || undefined,
        }),
      })
      const j = await res.json()
      if (!j.success) {
        setErrore(j.error || 'Errore creazione scadenze')
        return
      }
      onEsito({
        tipo: 'success',
        messaggio: `Create ${j.data.create} scadenze (su ${j.data.clienti_coinvolti} clienti).`,
      })
    } catch (e: any) {
      setErrore(e.message || 'Errore di rete')
    } finally {
      setCreando(false)
    }
  }

  return (
    <ModaleBase title="Crea scadenze in serie" onClose={onClose} icon={<Calendar className="w-5 h-5" />}>
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          Verra&apos; creata una scadenza nel calendario contrattuale per ogni cliente unico nei risultati.
          Usa <code className="bg-white px-1 py-0.5 rounded">{`{nome}`}</code> per personalizzare titolo e descrizione.
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Titolo (template)</label>
          <input type="text" value={titolo} onChange={e => setTitolo(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Descrizione (template)</label>
          <textarea rows={3} value={descrizione} onChange={e => setDescrizione(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Data scadenza</label>
            <input type="date" value={dataScadenza} onChange={e => setDataScadenza(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Priorità</label>
            <select value={priorita} onChange={e => setPriorita(e.target.value as any)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
              <option value="BASSA">Bassa</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Categoria</label>
            <input type="text" value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" placeholder="follow_up_interrogazione" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Responsabile (email)</label>
            <input type="email" value={responsabileEmail} onChange={e => setResponsabileEmail(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" placeholder="opzionale" />
          </div>
        </div>

        {errore && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{errore}</div>}

        <div className="flex justify-end space-x-2 pt-2">
          <button onClick={onClose} className="text-sm px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50" disabled={creando}>Annulla</button>
          <button
            onClick={crea}
            disabled={creando || !titolo.trim() || !dataScadenza}
            className="text-sm px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium inline-flex items-center disabled:opacity-50"
          >
            {creando ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Calendar className="w-4 h-4 mr-1.5" />}
            Crea scadenze
          </button>
        </div>
      </div>
    </ModaleBase>
  )
}

function ModaleBase({ title, icon, children, onClose }: { title: string; icon: React.ReactNode; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-teal-600">{icon}</span>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Sub-componenti: controlli per ogni tipo di filtro
// ----------------------------------------------------------------

function ControlloFiltro({ definizione, valore, onChange }: {
  definizione: DefinizioneFiltro
  valore: ValoreFiltro | undefined
  onChange: (v: ValoreFiltro | null) => void
}) {
  switch (definizione.tipo) {
    case 'text':
      return (
        <FiltroText
          label={definizione.label}
          placeholder={definizione.placeholder}
          valore={(valore as any)?.valore || ''}
          onChange={(v) => onChange(v ? { tipo: 'text', valore: v } : null)}
        />
      )
    case 'select':
      return (
        <FiltroSelect
          label={definizione.label}
          opzioni={definizione.opzioni || []}
          valore={(valore as any)?.valore || ''}
          onChange={(v) => onChange(v ? { tipo: 'select', valore: v } : null)}
        />
      )
    case 'multiselect_array':
    case 'multiselect_scalar':
      return (
        <FiltroMultiSelect
          label={definizione.label}
          opzioni={definizione.opzioni || []}
          valori={(valore as any)?.valori || []}
          onChange={(v) => onChange(v.length ? { tipo: definizione.tipo, valori: v } as any : null)}
        />
      )
    case 'number_range':
      return (
        <FiltroNumberRange
          label={definizione.label}
          min={(valore as any)?.min}
          max={(valore as any)?.max}
          onChange={(min, max) => {
            if (min === undefined && max === undefined) onChange(null)
            else onChange({ tipo: 'number_range', min, max })
          }}
        />
      )
    case 'date_range':
      return (
        <FiltroDateRange
          label={definizione.label}
          da={(valore as any)?.da}
          a={(valore as any)?.a}
          onChange={(da, a) => {
            if (!da && !a) onChange(null)
            else onChange({ tipo: 'date_range', da, a })
          }}
        />
      )
    default:
      return null
  }
}

function FiltroText({ label, placeholder, valore, onChange }: { label: string; placeholder?: string; valore: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={valore}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
      />
    </div>
  )
}

function FiltroSelect({ label, opzioni, valore, onChange }: { label: string; opzioni: OpzioneFiltro[]; valore: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={valore}
        onChange={e => onChange(e.target.value)}
        className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
      >
        <option value="">— qualsiasi —</option>
        {opzioni.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function FiltroMultiSelect({ label, opzioni, valori, onChange }: { label: string; opzioni: OpzioneFiltro[]; valori: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => {
    if (valori.includes(v)) onChange(valori.filter(x => x !== v))
    else onChange([...valori, v])
  }
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {valori.length > 0 && <span className="ml-1 text-teal-600">({valori.length})</span>}
      </label>
      <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
        {opzioni.map(o => {
          const attivo = valori.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                attivo
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-teal-300'
              }`}
            >
              {o.label}
              {attivo && <X className="w-3 h-3 inline-block ml-1" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FiltroNumberRange({ label, min, max, onChange }: { label: string; min?: number; max?: number; onChange: (min?: number, max?: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={min ?? ''}
          onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value), max)}
          placeholder="min"
          className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
        />
        <span className="text-gray-400 text-xs">—</span>
        <input
          type="number"
          value={max ?? ''}
          onChange={e => onChange(min, e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="max"
          className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
        />
      </div>
    </div>
  )
}

function FiltroDateRange({ label, da, a, onChange }: { label: string; da?: string; a?: string; onChange: (da?: string, a?: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={da || ''}
          onChange={e => onChange(e.target.value || undefined, a)}
          className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
        />
        <span className="text-gray-400 text-xs">—</span>
        <input
          type="date"
          value={a || ''}
          onChange={e => onChange(da, e.target.value || undefined)}
          className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
        />
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Helpers locali
// ----------------------------------------------------------------

function leggiCampoLocale(riga: any, campo: string): any {
  if (campo.includes('.')) {
    const parti = campo.split('.')
    let v: any = riga
    for (const p of parti) {
      if (v == null) return null
      v = v[p]
    }
    return v
  }
  return riga[campo]
}

function formattaPerVista(valore: unknown, col: DefinizioneColonna): React.ReactNode {
  if (valore === null || valore === undefined || valore === '') return <span className="text-gray-300">—</span>

  switch (col.formato) {
    case 'data':
      try {
        return new Date(valore as string).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
      } catch { return String(valore) }
    case 'data_ora':
      try {
        return new Date(valore as string).toLocaleString('it-IT')
      } catch { return String(valore) }
    case 'enum':
      return col.enum_labels?.[valore as string] || String(valore)
    case 'array':
      if (!Array.isArray(valore)) return ''
      return (
        <div className="flex flex-wrap gap-0.5">
          {(valore as string[]).slice(0, 3).map(v => (
            <span key={v} className="text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">
              {col.enum_labels?.[v] || v}
            </span>
          ))}
          {valore.length > 3 && <span className="text-xs text-gray-400">+{valore.length - 3}</span>}
        </div>
      )
    case 'numero':
      return String(valore)
    default:
      return String(valore)
  }
}
