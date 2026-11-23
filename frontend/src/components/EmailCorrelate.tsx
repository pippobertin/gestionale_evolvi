'use client'

import { useCallback, useEffect, useState } from 'react'
import { Mail, Search, Paperclip, ExternalLink, Archive, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

/**
 * Riquadro "Email" della scheda cliente e della pratica: le email scambiate con
 * il cliente, cercate nella casella Gmail di chi è collegato, e l'archiviazione
 * in PDF su Drive (con eventuale registrazione come contatto con la PA o come
 * conferma del cliente). Sta dentro moduli: tutti i pulsanti sono type="button".
 */
type Props = { clienteId?: string; progettoId?: string }

const TIPI_CONTATTO: Record<string, string> = {
  richiesta_formale: 'Richiesta formale (chiarimento, modifica, proroga, variazione)',
  comunicazione_esito: 'Comunicazione su esiti, controlli o rendicontazione', controllo: 'Controllo o verifica', incontro: 'Incontro', altro: 'Altro'
}
const REGISTRATA: Record<string, string> = { documento: 'documento', contatto_pa: 'contatto con la PA', conferma_cliente: 'conferma del cliente' }
const h = (m: any, n: string) => (m.payload?.headers || []).find((x: any) => x.name?.toLowerCase() === n)?.value || ''
const nomeBreve = (s: string) => (s.match(/^\s*"?([^"<]+?)"?\s*</)?.[1] || s).trim()
const quando = (ms: string | number) => {
  const d = new Date(Number(ms)); const oggi = new Date()
  return d.toDateString() === oggi.toDateString() ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('it-IT')
}

export default function EmailCorrelate({ clienteId, progettoId }: Props) {
  const [dati, setDati] = useState<any>(null)
  const [errore, setErrore] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [caricamento, setCaricamento] = useState(false)
  const [ricerca, setRicerca] = useState('')
  const [applicata, setApplicata] = useState('')
  const [aperto, setAperto] = useState<string | null>(null)
  const [contenuto, setContenuto] = useState<Record<string, any>>({})
  const [archivia, setArchivia] = useState<any>(null)
  const [inCorso, setInCorso] = useState(false)
  const [mostraIndirizzi, setMostraIndirizzi] = useState(false)

  const carica = useCallback(async (pageToken?: string) => {
    setCaricamento(true); setErrore('')
    try {
      const qs = new URLSearchParams()
      if (progettoId) qs.set('progetto_id', progettoId)
      if (clienteId) qs.set('cliente_id', clienteId)
      if (applicata) qs.set('q', applicata)
      if (pageToken) qs.set('pageToken', pageToken)
      const r = await fetch(`/api/email/correlate?${qs}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Email non disponibili')
      setDati((prima: any) => pageToken && prima ? { ...d, messages: [...prima.messages, ...d.messages] } : d)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore')
    } finally {
      setCaricamento(false)
    }
  }, [clienteId, progettoId, applicata])
  useEffect(() => { carica() }, [carica])

  const apri = async (id: string) => {
    if (aperto === id) { setAperto(null); return }
    setAperto(id); setArchivia(null)
    if (contenuto[id]) return
    const r = await fetch(`/api/email/messaggio/${id}`)
    const d = await r.json().catch(() => ({}))
    setContenuto(c => ({ ...c, [id]: r.ok ? d.messaggio : { errore: d.error || 'Messaggio non disponibile' } }))
  }

  const salva = async () => {
    if (!archivia) return
    setInCorso(true); setErrore(''); setMessaggio('')
    try {
      const r = await fetch('/api/email/archivia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: archivia.id, cliente_id: clienteId, progetto_id: progettoId, registra: archivia.registra, allegati: archivia.allegati,
          contatto: { ente: archivia.ente, tipo: archivia.tipo, oggetto: archivia.oggetto, esito: archivia.esito },
          vale_anche_come_delega: archivia.delega
        })
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Archiviazione non riuscita')
      setMessaggio(`Email archiviata su Drive${d.allegati ? ` con ${d.allegati} allegati` : ''}${archivia.registra !== 'documento' ? ` e registrata come ${REGISTRATA[archivia.registra]}` : ''}.`)
      setArchivia(null)
      carica()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore')
    } finally {
      setInCorso(false)
    }
  }

  const archiviatePer = (id: string) => (dati?.archiviate || []).filter((a: any) => a.gmail_message_id === id)
  const campo = 'w-full px-2 py-1 border border-gray-300 rounded text-sm'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Mail className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-900">Email con {dati?.denominazione || 'il cliente'}</span>
        {dati?.casella && <span className="text-xs text-gray-500">dalla casella {dati.casella}</span>}
        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input className="pl-7 pr-2 py-1 border border-gray-300 rounded text-sm w-56" placeholder="Filtra (parole, Invio)" value={ricerca}
            onChange={e => setRicerca(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setApplicata(ricerca.trim()) } }} />
        </div>
        <button type="button" onClick={() => carica()} className="p-1.5 text-gray-500 hover:text-gray-800" title="Aggiorna"><RefreshCw className={`w-4 h-4 ${caricamento ? 'animate-spin' : ''}`} /></button>
      </div>

      {dati && (dati.indirizzi?.length > 0 || dati.domini?.length > 0) && (
        <button type="button" onClick={() => setMostraIndirizzi(!mostraIndirizzi)} className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">
          Cerca tra {dati.indirizzi.length} indirizzi{dati.domini.length ? ` e il dominio ${dati.domini.join(', ')}` : ''} {mostraIndirizzi ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      )}
      {mostraIndirizzi && <div className="text-xs text-gray-500">{dati.indirizzi.join(' · ')}</div>}
      {errore && <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{errore}</div>}
      {messaggio && <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">{messaggio}</div>}
      {dati?.avviso && <div className="p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">{dati.avviso}</div>}

      <div className="bg-white border border-gray-200 rounded-lg divide-y">
        {!dati && caricamento && <div className="p-4 text-sm text-gray-500">Ricerca delle email…</div>}
        {dati && dati.messages.length === 0 && !dati.avviso && <div className="p-4 text-sm text-gray-500">Nessuna email trovata con questo cliente.</div>}
        {(dati?.messages || []).map((m: any) => {
          const gia = archiviatePer(m.id)
          const c = contenuto[m.id]
          const nonLetto = (m.labelIds || []).includes('UNREAD')
          return (
            <div key={m.id}>
              <button type="button" onClick={() => apri(m.id)} className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${aperto === m.id ? 'bg-gray-50' : ''}`}>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`truncate max-w-[14rem] ${nonLetto ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {(m.labelIds || []).includes('SENT') ? `A: ${nomeBreve(h(m, 'to'))}` : nomeBreve(h(m, 'from'))}
                  </span>
                  <span className={`flex-1 truncate ${nonLetto ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>{h(m, 'subject') || '(senza oggetto)'}</span>
                  {gia.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 whitespace-nowrap">archiviata</span>}
                  <span className="text-xs text-gray-500 whitespace-nowrap">{quando(m.internalDate)}</span>
                </div>
                <div className="text-xs text-gray-500 truncate">{m.snippet}</div>
              </button>
              {aperto === m.id && (
                <div className="px-3 pb-3 space-y-2">
                  {!c && <div className="text-sm text-gray-500">Apertura del messaggio…</div>}
                  {c?.errore && <div className="text-sm text-red-700">{c.errore}</div>}
                  {c && !c.errore && (
                    <>
                      <div className="text-xs text-gray-600">
                        <div><strong>Da:</strong> {c.mittente}</div>
                        <div><strong>A:</strong> {c.destinatari}{c.cc ? ` · Cc: ${c.cc}` : ''}</div>
                        <div><strong>Data:</strong> {c.data ? new Date(c.data).toLocaleString('it-IT') : ''}</div>
                      </div>
                      {c.html
                        ? <iframe sandbox="" srcDoc={c.html} title={c.oggetto} className="w-full h-80 border rounded bg-white" />
                        : <pre className="whitespace-pre-wrap text-sm text-gray-800 max-h-80 overflow-y-auto border rounded p-2 bg-white">{c.testo}</pre>}
                      {c.allegati?.length > 0 && (
                        <div className="text-xs text-gray-600 flex flex-wrap gap-2">
                          {c.allegati.map((a: any) => <span key={a.attachmentId} className="inline-flex items-center gap-0.5"><Paperclip className="w-3 h-3" />{a.filename}</span>)}
                        </div>
                      )}
                      {gia.map((a: any) => (
                        <div key={a.id} className="text-xs text-green-700">
                          Archiviata il {new Date(a.created_at).toLocaleDateString('it-IT')} come {REGISTRATA[a.registrata_come]}
                          {a.google_drive_url && <a href={a.google_drive_url} target="_blank" rel="noreferrer" className="ml-1 text-blue-600 underline">PDF su Drive</a>}
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <a href={`https://mail.google.com/mail/u/0/#all/${m.threadId}`} target="_blank" rel="noreferrer" className="px-2 py-1 text-xs border rounded inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Apri in Gmail</a>
                        {!archivia && (
                          <button type="button" className="px-2 py-1 text-xs bg-blue-600 text-white rounded inline-flex items-center gap-1"
                            onClick={() => setArchivia({ id: m.id, registra: 'documento', allegati: (c.allegati || []).length > 0, ente: dati?.ente || '', tipo: 'richiesta_formale', oggetto: c.oggetto || '', esito: '', delega: false })}>
                            <Archive className="w-3 h-3" /> {progettoId ? 'Salva nella pratica' : 'Salva nei documenti del cliente'}
                          </button>
                        )}
                      </div>
                      {archivia?.id === m.id && (
                        <div className="p-2 bg-slate-50 border rounded space-y-2">
                          {progettoId && (
                            <div className="flex flex-wrap gap-3 text-sm">
                              {Object.entries(REGISTRATA).map(([k, v]) => (
                                <label key={k} className="inline-flex items-center gap-1">
                                  <input type="radio" checked={archivia.registra === k} onChange={() => setArchivia({ ...archivia, registra: k })} />
                                  {k === 'documento' ? 'Solo archiviare' : `Registrare come ${v}`}
                                </label>
                              ))}
                            </div>
                          )}
                          {archivia.registra === 'contatto_pa' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <label className="text-xs text-gray-600">Ente<input className={campo} value={archivia.ente} onChange={e => setArchivia({ ...archivia, ente: e.target.value })} /></label>
                              <label className="text-xs text-gray-600">Tipo
                                <select className={campo} value={archivia.tipo} onChange={e => setArchivia({ ...archivia, tipo: e.target.value })}>
                                  {Object.entries(TIPI_CONTATTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                              </label>
                              <label className="text-xs text-gray-600 md:col-span-2">Oggetto<input className={campo} value={archivia.oggetto} onChange={e => setArchivia({ ...archivia, oggetto: e.target.value })} /></label>
                              <label className="text-xs text-gray-600 md:col-span-2">Esito (facoltativo)<input className={campo} value={archivia.esito} onChange={e => setArchivia({ ...archivia, esito: e.target.value })} /></label>
                            </div>
                          )}
                          {archivia.registra === 'conferma_cliente' && (
                            <label className="text-sm inline-flex items-center gap-1">
                              <input type="checkbox" checked={archivia.delega} onChange={e => setArchivia({ ...archivia, delega: e.target.checked })} /> contiene anche la delega all&apos;invio
                            </label>
                          )}
                          {(c.allegati || []).length > 0 && (
                            <label className="text-sm inline-flex items-center gap-1 ml-3">
                              <input type="checkbox" checked={archivia.allegati} onChange={e => setArchivia({ ...archivia, allegati: e.target.checked })} /> salva anche gli allegati
                            </label>
                          )}
                          <div className="text-xs text-gray-500">
                            Il PDF va su Drive {progettoId ? 'nella cartella della pratica' : 'tra i documenti del cliente (cartella EMAIL)'}; in Gmail il messaggio riceve l&apos;etichetta «Archiviata nel gestionale».
                          </div>
                          <div className="flex gap-2">
                            <button type="button" disabled={inCorso} onClick={salva} className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-40">{inCorso ? 'Archiviazione…' : 'Archivia'}</button>
                            <button type="button" onClick={() => setArchivia(null)} className="px-3 py-1 text-sm border rounded">Annulla</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {dati?.nextPageToken && (
          <button type="button" disabled={caricamento} onClick={() => carica(dati.nextPageToken)} className="w-full py-2 text-sm text-blue-600 hover:bg-gray-50">
            {caricamento ? 'Caricamento…' : 'Email precedenti'}
          </button>
        )}
      </div>

      {(dati?.archiviate || []).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-800 mb-1">Email archiviate {progettoId ? 'nella pratica' : 'per il cliente'}</h4>
          <div className="bg-white border border-gray-200 rounded-lg divide-y">
            {dati.archiviate.map((a: any) => (
              <div key={a.id} className="px-3 py-1.5 text-xs flex flex-wrap items-center gap-2">
                <span className="text-gray-500">{a.data_email ? new Date(a.data_email).toLocaleDateString('it-IT') : ''}</span>
                <span className="text-gray-800 flex-1 truncate">{a.oggetto || '(senza oggetto)'}</span>
                <span className="text-gray-500">{REGISTRATA[a.registrata_come]}</span>
                {a.google_drive_url && <a href={a.google_drive_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">PDF</a>}
                {(a.allegati || []).length > 0 && <span className="text-gray-500">+{a.allegati.length} allegati</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
