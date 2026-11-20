'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, X, AlertTriangle, ExternalLink, FileText, Upload, ChevronRight, ChevronLeft, Trash2 } from 'lucide-react'
import { LoadingSpinner } from './shared'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Percorso della pratica di finanza agevolata (Modello 231, PR.01 e PR.02):
 * incarico, progettazione, controllo pre-invio del revisore, conferma del
 * cliente e invio. I requisiti di ogni passaggio li verifica il database.
 */

const FASI = [
  { id: 'incarico', etichetta: 'Incarico' },
  { id: 'progettazione', etichetta: 'Progettazione' },
  { id: 'controllo_preinvio', etichetta: 'Controllo pre-invio' },
  { id: 'invio', etichetta: 'Conferma e invio' },
  { id: 'inviata', etichetta: 'Inviata' }
] as const

const TIPI_CONTATTO: Record<string, string> = {
  richiesta_formale: 'Richiesta formale (chiarimento, modifica, proroga, variazione)',
  comunicazione_esito: 'Comunicazione su esito o rendicontazione',
  controllo: 'Controllo, ispezione o audit',
  incontro: 'Incontro',
  altro: 'Altro contatto rilevante'
}

type Dati = any

function oggi() { return new Date().toISOString().slice(0, 10) }
function dataIt(d?: string | null) { return d ? new Date(d).toLocaleDateString('it-IT') : '' }

function Requisito({ ok, testo }: { ok: boolean; testo: string }) {
  return (
    <li className={`flex items-start gap-1.5 text-xs ${ok ? 'text-green-700' : 'text-red-700'}`}>
      {ok ? <Check className="w-3.5 h-3.5 mt-px shrink-0" /> : <X className="w-3.5 h-3.5 mt-px shrink-0" />}
      {testo}
    </li>
  )
}

function Sezione({ titolo, children, evidenza = false, fisso = false }: { titolo: string; children: React.ReactNode; evidenza?: boolean; fisso?: boolean }) {
  return (
    <section className={`rounded-lg border p-3 ${evidenza ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'} ${fisso ? 'sticky top-0 z-20 shadow-md' : ''}`}>
      <h4 className="text-sm font-semibold text-gray-900 mb-2">{titolo}</h4>
      {children}
    </section>
  )
}

export default function PraticaPercorso({ progettoId }: { progettoId: string }) {
  const { isAdmin, haPermesso } = useAuth()
  const [dati, setDati] = useState<Dati | null>(null)
  const [errore, setErrore] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [inCorso, setInCorso] = useState<string | null>(null)

  // moduli
  const [ordine, setOrdine] = useState({ contratto_evolvi_id: '', rendicontazione: 'Esclusa', compenso: '', success_fee: '', attivita: '' })
  const [conferma, setConferma] = useState<{ ordineId: string; data: string; canale: string; file: File | null } | null>(null)
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [noteChecklist, setNoteChecklist] = useState('')
  const [verifica, setVerifica] = useState<{ tipo: string; data: string; file: File | null; delega: boolean } | null>(null)
  const [contatto, setContatto] = useState({ data: oggi(), ente: '', persona: '', tipo: 'richiesta_formale', oggetto: '', esito: '', file: null as File | null })
  const [mostraContatto, setMostraContatto] = useState(false)
  const [motivazione, setMotivazione] = useState('')

  const carica = useCallback(async () => {
    try {
      const r = await fetch(`/api/pratiche/${progettoId}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Pratica non disponibile')
      setDati(d)
      setMotivazione(d.pratica.motivazione_stesso_bando || '')
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore')
    }
  }, [progettoId])

  useEffect(() => { carica() }, [carica])

  const esegui = async (chiave: string, azione: () => Promise<Response>, ok?: string) => {
    setInCorso(chiave); setErrore(''); setMessaggio('')
    try {
      const r = await azione()
      const testo = await r.text()
      let d: any = {}
      try { d = JSON.parse(testo) } catch { throw new Error(`Il server non ha risposto correttamente (errore ${r.status})`) }
      if (!r.ok) throw new Error(d.error || 'Operazione non riuscita')
      if (ok) setMessaggio(ok)
      await carica()
      return d
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore')
      return null
    } finally {
      setInCorso(null)
    }
  }

  const aggiorna = (campi: Record<string, unknown>) => esegui('pratica', () => fetch(`/api/pratiche/${progettoId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(campi)
  }), 'Pratica aggiornata')

  const cambiaFase = async (fase: string, deroga?: string) => {
    await esegui('fase', () => fetch(`/api/pratiche/${progettoId}/fase`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fase, deroga })
    }), 'Fase aggiornata')
  }

  const inviaForm = (chiave: string, url: string, campi: Record<string, string | File | null | undefined>, ok: string) => {
    const form = new FormData()
    Object.entries(campi).forEach(([k, v]) => { if (v !== null && v !== undefined) form.append(k, v) })
    return esegui(chiave, () => fetch(url, { method: 'POST', body: form }), ok)
  }

  if (!dati && !errore) return <div className="p-6"><LoadingSpinner /></div>
  if (!dati) return <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{errore}</div>

  const { pratica, stato, nomi } = dati
  const indice = FASI.findIndex(f => f.id === pratica.fase)
  const successiva = FASI[indice + 1]
  const precedente = indice > 0 ? FASI[indice - 1] : null
  const sonoRev = dati.io && dati.io === pratica.rev_id
  const ultimaChecklist = dati.verifiche.find((v: any) => v.tipo === 'checklist_preinvio')
  const verificheTipo = (t: string) => dati.verifiche.filter((v: any) => v.tipo === t)

  const requisiti: { ok: boolean; testo: string }[] =
    successiva?.id === 'progettazione' ? [
      { ok: stato.incarico_ok, testo: 'Contratto firmato o ordine di lavoro confermato dal cliente' },
      { ok: stato.rp_rev_ok, testo: 'Responsabile di pratica e revisore assegnati, persone diverse' },
      ...(stato.pratica_propria ? [{ ok: stato.au_escluso_ok, testo: 'Domanda di BLM in proprio: responsabile e revisore diversi dall\'AU' }] : []),
      ...(stato.rev_coinvolto ? [{ ok: stato.motivazione_stesso_bando_ok, testo: 'Motivazione scritta: il revisore segue anche una pratica concorrente sullo stesso bando' }] : [])
    ] : successiva?.id === 'controllo_preinvio' ? [
      { ok: true, testo: 'Nessun requisito: il revisore farà il controllo nella fase successiva' }
    ] : successiva?.id === 'invio' ? [
      { ok: stato.checklist_ok, testo: 'Checklist pre-invio confermata dal revisore, tutte le voci verificate' }
    ] : successiva?.id === 'inviata' ? [
      { ok: stato.conferma_ok, testo: 'Conferma scritta del cliente sulla versione finale' },
      { ok: stato.trasmissione_ok, testo: 'Indicato chi trasmette la domanda' },
      ...(stato.trasmissione === 'blm' ? [{ ok: stato.delega_ok, testo: 'Delega o procura del cliente (trasmette BLM)' }] : []),
      { ok: stato.ricevuta_ok, testo: 'Ricevuta di invio' }
    ] : []
  const tuttiOk = requisiti.every(r => r.ok)

  const campo = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm'

  return (
    <div className="space-y-3" onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault() }}>
      {errore && <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{errore}</div>}
      {messaggio && <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">{messaggio}</div>}

      {/* Fasi */}
      {/* Sempre visibile mentre si scorre la scheda */}
      <Sezione titolo="Fasi della pratica" evidenza fisso>
        <ol className="flex flex-wrap items-center gap-1 mb-3">
          {FASI.map((f, i) => (
            <li key={f.id} className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${i < indice ? 'bg-green-100 text-green-800' : i === indice ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {i + 1}. {f.etichetta}
              </span>
              {i < FASI.length - 1 && <ChevronRight className="w-3 h-3 text-gray-400" />}
            </li>
          ))}
        </ol>
        {successiva ? (
          <div>
            <p className="text-xs text-gray-600 mb-1">Per passare a <strong>{successiva.etichetta}</strong>:</p>
            <ul className="space-y-0.5 mb-2">{requisiti.map((r, i) => <Requisito key={i} {...r} />)}</ul>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!tuttiOk || inCorso !== null || !haPermesso('dati.modifica')}
                onClick={() => cambiaFase(successiva.id)}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-40 inline-flex items-center gap-1">
                Passa a {successiva.etichetta} <ChevronRight className="w-4 h-4" />
              </button>
              {!tuttiOk && isAdmin() && (
                <button type="button" disabled={inCorso !== null}
                  onClick={() => {
                    const motivo = window.prompt(`Mancano dei requisiti. Per passare comunque a "${successiva.etichetta}" scrivi il motivo della deroga (almeno 15 caratteri). Resterà nella cronologia e nel registro, visibile all'OdV.`)
                    if (motivo && motivo.trim().length >= 15) cambiaFase(successiva.id, motivo.trim())
                  }}
                  className="px-3 py-1.5 text-sm border border-amber-400 text-amber-800 rounded hover:bg-amber-50">
                  Passa in deroga (amministratore)
                </button>
              )}
              {precedente && pratica.fase !== 'inviata' && (
                <button type="button" disabled={inCorso !== null} onClick={() => cambiaFase(precedente.id)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 inline-flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Torna a {precedente.etichetta}
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-green-700">Domanda inviata{pratica.data_invio ? ` il ${dataIt(pratica.data_invio)}` : ''}. Da qui prosegue con lo stato del progetto (decreto atteso, ricevuto, accettato).</p>
        )}
      </Sezione>

      {/* Ruoli */}
      <Sezione titolo="Responsabile di pratica e revisore">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs text-gray-600">Responsabile di pratica (RP)
            <select className={campo} value={pratica.rp_id || ''} disabled={inCorso !== null}
              onChange={e => aggiorna({ rp_id: e.target.value || null })}>
              <option value="">Da assegnare</option>
              {dati.utenti.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Revisore (REV), diverso dal responsabile
            <select className={campo} value={pratica.rev_id || ''} disabled={inCorso !== null}
              onChange={e => aggiorna({ rev_id: e.target.value || null })}>
              <option value="">Da assegnare</option>
              {dati.utenti.filter((u: any) => u.id !== pratica.rp_id).map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-700 mt-2">
          <input type="checkbox" checked={pratica.pratica_propria} disabled={inCorso !== null}
            onChange={e => aggiorna({ pratica_propria: e.target.checked })} />
          Domanda presentata da BLMProject in proprio (responsabile e revisore diversi dall&apos;AU; segnalazione all&apos;OdV prima dell&apos;invio)
        </label>
      </Sezione>

      {/* Stesso bando */}
      {stato.concorrenti?.length > 0 && (
        <Sezione titolo="Altre pratiche sullo stesso bando">
          <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              BLM segue altri clienti sullo stesso bando. Informa l&apos;AU prima di accettare l&apos;incarico; il contratto contiene la
              clausola di trasparenza. Nessuno può essere responsabile di due pratiche concorrenti né revisore della pratica del concorrente.
            </span>
          </div>
          <ul className="text-xs text-gray-700 space-y-0.5 mb-2">
            {stato.concorrenti.map((c: any) => (
              <li key={c.id}>
                {c.cliente || 'Cliente'} · {c.titolo} · fase {FASI.find(f => f.id === c.fase)?.etichetta || c.fase}
                {c.rp_id && ` · RP ${nomi[c.rp_id] || ''}`}{c.rev_id && ` · REV ${nomi[c.rev_id] || ''}`}
              </li>
            ))}
          </ul>
          {stato.rev_coinvolto && (
            <div>
              <p className="text-xs text-red-700 mb-1">Il revisore di questa pratica segue anche una pratica concorrente: se le dimensioni della struttura non consentono altrimenti, scrivi la motivazione.</p>
              <textarea className={campo} rows={2} value={motivazione} onChange={e => setMotivazione(e.target.value)} />
              <button type="button" disabled={inCorso !== null || motivazione.trim().length < 15}
                onClick={() => aggiorna({ motivazione_stesso_bando: motivazione.trim() })}
                className="mt-1 px-3 py-1 text-xs bg-gray-800 text-white rounded disabled:opacity-40">Salva la motivazione</button>
            </div>
          )}
        </Sezione>
      )}

      {/* Incarico */}
      <Sezione titolo="Incarico: contratto o ordine di lavoro">
        <p className="text-xs text-gray-700 mb-2">
          Contratto di progetto: {dati.contratto
            ? (dati.contratto.signed_contract_received ? <span className="text-green-700 font-medium">firmato e registrato</span> : <span>stato {dati.contratto.overall_status}, non ancora firmato</span>)
            : 'nessuno'}. Per i clienti con accordo quadro (Metodo Evolvi) basta l&apos;ordine di lavoro confermato.
        </p>
        {dati.ordini.length > 0 && (
          <ul className="text-xs space-y-1 mb-2">
            {dati.ordini.map((o: any) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-gray-500" />
                <span>Ordine {o.numero} del {dataIt(o.data_ordine)}</span>
                {o.file_url && <a href={o.file_url} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-0.5">documento <ExternalLink className="w-3 h-3" /></a>}
                {o.confermato
                  ? <span className="text-green-700">confermato il {dataIt(o.conferma_data)}{o.conferma_file_url && <> · <a href={o.conferma_file_url} target="_blank" rel="noreferrer" className="underline">conferma</a></>}</span>
                  : haPermesso('contratti.registra_firmato') && (
                    <button type="button" onClick={() => setConferma({ ordineId: o.id, data: oggi(), canale: 'email', file: null })}
                      className="px-2 py-0.5 border border-green-400 text-green-800 rounded hover:bg-green-50">Registra la conferma del cliente</button>
                  )}
              </li>
            ))}
          </ul>
        )}
        {conferma && (
          <div className="border border-gray-200 rounded p-2 mb-2 grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <label className="text-xs text-gray-600">Data<input type="date" className={campo} value={conferma.data} onChange={e => setConferma({ ...conferma, data: e.target.value })} /></label>
            <label className="text-xs text-gray-600">Come
              <select className={campo} value={conferma.canale} onChange={e => setConferma({ ...conferma, canale: e.target.value })}>
                <option value="email">Email</option><option value="pec">PEC</option><option value="firma">Firma sul documento</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">Ordine firmato o email di conferma<input type="file" className="text-xs" onChange={e => setConferma({ ...conferma, file: e.target.files?.[0] || null })} /></label>
            <div className="flex gap-1">
              <button type="button" disabled={!conferma.file || inCorso !== null}
                onClick={async () => { const ok = await inviaForm('conferma', `/api/pratiche/${progettoId}/ordine-lavoro/${conferma.ordineId}/conferma`, { data: conferma.data, canale: conferma.canale, file: conferma.file }, 'Conferma registrata'); if (ok) setConferma(null) }}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded disabled:opacity-40">Registra</button>
              <button type="button" onClick={() => setConferma(null)} className="px-2 py-1 text-xs border rounded">Annulla</button>
            </div>
          </div>
        )}
        {haPermesso('contratti.genera') && (
          <details className="text-xs">
            <summary className="cursor-pointer text-blue-700">Genera un ordine di lavoro</summary>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              <label className="text-gray-600">Accordo quadro
                <select className={campo} value={ordine.contratto_evolvi_id} onChange={e => setOrdine({ ...ordine, contratto_evolvi_id: e.target.value })}>
                  <option value="">{dati.accordi.length ? 'Scegli' : 'Nessun accordo quadro attivo per il cliente'}</option>
                  {dati.accordi.map((a: any) => <option key={a.id} value={a.id}>{a.numero_contratto || 'senza numero'} del {dataIt(a.data_contratto)}</option>)}
                </select>
              </label>
              <label className="text-gray-600">Rendicontazione
                <select className={campo} value={ordine.rendicontazione} onChange={e => setOrdine({ ...ordine, rendicontazione: e.target.value })}>
                  <option value="Esclusa">Esclusa</option><option value="Inclusa">Inclusa</option>
                </select>
              </label>
              {ordine.rendicontazione === 'Inclusa' && (
                <label className="text-gray-600">Compenso per la rendicontazione<input className={campo} value={ordine.compenso} onChange={e => setOrdine({ ...ordine, compenso: e.target.value })} placeholder="per esempio 1.500 euro oltre IVA" /></label>
              )}
              <label className="text-gray-600">Success fee, se diversa dall&apos;accordo quadro<input className={campo} value={ordine.success_fee} onChange={e => setOrdine({ ...ordine, success_fee: e.target.value })} /></label>
              <label className="text-gray-600 md:col-span-2">Attività ulteriori<input className={campo} value={ordine.attivita} onChange={e => setOrdine({ ...ordine, attivita: e.target.value })} /></label>
            </div>
            <button type="button" disabled={inCorso !== null || (ordine.rendicontazione === 'Inclusa' && !ordine.compenso.trim())}
              onClick={() => esegui('ordine', () => fetch(`/api/pratiche/${progettoId}/ordine-lavoro`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contratto_evolvi_id: ordine.contratto_evolvi_id || null,
                  rendicontazione: ordine.rendicontazione === 'Inclusa' ? `Inclusa, con un compenso di ${ordine.compenso.trim()}.` : 'Esclusa.',
                  success_fee: ordine.success_fee, attivita: ordine.attivita
                })
              }), 'Ordine di lavoro generato nella cartella CONTRATTI del progetto: invialo al cliente e registra la conferma')}
              className="mt-2 px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-40">
              {inCorso === 'ordine' ? 'Generazione…' : 'Genera dal modello'}
            </button>
          </details>
        )}
      </Sezione>

      {/* Controllo e invio */}
      <Sezione titolo="Controllo pre-invio e invio">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-800 mb-1">Checklist pre-invio del revisore</p>
            {ultimaChecklist && (
              <p className={`text-xs mb-1 ${stato.checklist_ok ? 'text-green-700' : 'text-amber-700'}`}>
                Ultima checklist: {nomi[ultimaChecklist.eseguito_da] || ''} il {dataIt(ultimaChecklist.created_at)}
                {stato.checklist_ok ? ', tutte le voci verificate' : ', con voci non verificate'}
              </p>
            )}
            {sonoRev ? (
              <div className="border border-gray-200 rounded p-2">
                {dati.voci.map((v: any) => (
                  <label key={v.chiave} className="flex items-start gap-2 text-xs text-gray-800 py-0.5">
                    <input type="checkbox" checked={!!checklist[v.chiave]} onChange={e => setChecklist({ ...checklist, [v.chiave]: e.target.checked })} />
                    {v.etichetta}
                  </label>
                ))}
                <input className={`${campo} mt-1`} placeholder="Note (facoltative)" value={noteChecklist} onChange={e => setNoteChecklist(e.target.value)} />
                <button type="button" disabled={inCorso !== null}
                  onClick={async () => {
                    const voci = dati.voci.map((v: any) => ({ chiave: v.chiave, etichetta: v.etichetta, ok: !!checklist[v.chiave] }))
                    const ok = await inviaForm('checklist', `/api/pratiche/${progettoId}/verifiche`, { tipo: 'checklist_preinvio', voci: JSON.stringify(voci), note: noteChecklist }, 'Checklist registrata')
                    if (ok) { setChecklist({}); setNoteChecklist('') }
                  }}
                  className="mt-1 px-3 py-1 text-xs bg-gray-800 text-white rounded disabled:opacity-40">Conferma la checklist</button>
              </div>
            ) : (
              <p className="text-xs text-gray-500">La compila il revisore{pratica.rev_id ? ` (${nomi[pratica.rev_id] || ''})` : ', ancora da assegnare'}.</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-gray-600">Chi trasmette la domanda
              <select className={campo} value={pratica.trasmissione || ''} disabled={inCorso !== null}
                onChange={e => aggiorna({ trasmissione: e.target.value || null })}>
                <option value="">Da indicare</option>
                <option value="blm">BLM, con delega o procura del cliente</option>
                <option value="cliente">Il cliente direttamente</option>
              </select>
            </label>
          </div>

          {[
            { tipo: 'conferma_cliente', titolo: 'Conferma scritta del cliente sulla versione finale', aiuto: 'Email o PEC in cui il cliente dichiara di aver letto e approvato la versione finale (la firma degli allegati non basta).' },
            ...(pratica.trasmissione === 'blm' ? [{ tipo: 'delega', titolo: 'Delega o procura del cliente', aiuto: 'Necessaria quando trasmette BLM. Nessuno usa SPID, password o OTP di altri.' }] : []),
            { tipo: 'ricevuta_invio', titolo: 'Ricevuta di invio', aiuto: 'Ricevuta rilasciata dalla piattaforma o dall\'ente.' }
          ].map(b => (
            <div key={b.tipo}>
              <p className="text-xs font-medium text-gray-800">{b.titolo}</p>
              <p className="text-[11px] text-gray-500 mb-1">{b.aiuto}</p>
              {verificheTipo(b.tipo).map((v: any) => (
                <p key={v.id} className="text-xs text-green-700">
                  Registrata il {dataIt(v.data)} da {nomi[v.eseguito_da] || ''}
                  {v.file_url && <> · <a href={v.file_url} target="_blank" rel="noreferrer" className="underline">documento</a></>}
                  {v.vale_anche_come_delega && ' · vale anche come delega'}
                </p>
              ))}
              {verifica?.tipo === b.tipo ? (
                <div className="flex flex-wrap items-end gap-2 mt-1">
                  <label className="text-xs text-gray-600">Data<input type="date" className={campo} value={verifica.data} onChange={e => setVerifica({ ...verifica, data: e.target.value })} /></label>
                  <input type="file" className="text-xs" onChange={e => setVerifica({ ...verifica, file: e.target.files?.[0] || null })} />
                  {b.tipo === 'conferma_cliente' && (
                    <label className="flex items-center gap-1 text-xs text-gray-700">
                      <input type="checkbox" checked={verifica.delega} onChange={e => setVerifica({ ...verifica, delega: e.target.checked })} />
                      contiene anche la delega all&apos;invio
                    </label>
                  )}
                  <button type="button" disabled={!verifica.file || inCorso !== null}
                    onClick={async () => { const ok = await inviaForm('verifica', `/api/pratiche/${progettoId}/verifiche`, { tipo: b.tipo, data: verifica.data, file: verifica.file, vale_anche_come_delega: String(verifica.delega) }, 'Documento registrato'); if (ok) setVerifica(null) }}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded disabled:opacity-40">Registra</button>
                  <button type="button" onClick={() => setVerifica(null)} className="px-2 py-1 text-xs border rounded">Annulla</button>
                </div>
              ) : (
                <button type="button" onClick={() => setVerifica({ tipo: b.tipo, data: oggi(), file: null, delega: false })}
                  className="mt-1 px-2 py-0.5 text-xs border border-gray-300 rounded hover:bg-gray-50 inline-flex items-center gap-1">
                  <Upload className="w-3 h-3" /> Carica
                </button>
              )}
            </div>
          ))}
        </div>
      </Sezione>

      {/* Contatti con la PA */}
      <Sezione titolo="Contatti rilevanti con la PA e gli enti">
        <p className="text-[11px] text-gray-500 mb-2">
          Richieste formali di chiarimento, modifica, proroga o variazione; comunicazioni su esiti, controlli e rendicontazione; incontri.
          Non vanno annotate le telefonate solo informative sul bando.
        </p>
        {dati.contatti.length > 0 && (
          <ul className="text-xs space-y-1 mb-2">
            {dati.contatti.map((c: any) => (
              <li key={c.id} className="flex items-start gap-2">
                <span className="text-gray-500 w-20 shrink-0">{dataIt(c.data)}</span>
                <span className="flex-1">
                  <strong>{c.ente}</strong>{c.persona ? `, ${c.persona}` : ''} · {TIPI_CONTATTO[c.tipo]?.split(' (')[0] || c.tipo}: {c.oggetto}
                  {c.esito && <span className="text-gray-600"> · esito: {c.esito}</span>}
                  {c.allegato_url && <> · <a href={c.allegato_url} target="_blank" rel="noreferrer" className="underline">allegato</a></>}
                  <span className="text-gray-400"> · {nomi[c.registrato_da] || ''}</span>
                </span>
                {haPermesso('elementi.elimina') && (
                  <button type="button" title="Elimina" onClick={() => { if (confirm('Eliminare questo contatto dal registro?')) esegui('contatto-del', () => fetch(`/api/pratiche/${progettoId}/contatti-pa/${c.id}`, { method: 'DELETE' }), 'Contatto eliminato') }}
                    className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
        {mostraContatto ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 border border-gray-200 rounded p-2">
            <label className="text-xs text-gray-600">Data<input type="date" className={campo} value={contatto.data} onChange={e => setContatto({ ...contatto, data: e.target.value })} /></label>
            <label className="text-xs text-gray-600">Ente<input className={campo} value={contatto.ente} onChange={e => setContatto({ ...contatto, ente: e.target.value })} /></label>
            <label className="text-xs text-gray-600">Persona<input className={campo} value={contatto.persona} onChange={e => setContatto({ ...contatto, persona: e.target.value })} /></label>
            <label className="text-xs text-gray-600 md:col-span-3">Tipo
              <select className={campo} value={contatto.tipo} onChange={e => setContatto({ ...contatto, tipo: e.target.value })}>
                {Object.entries(TIPI_CONTATTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600 md:col-span-2">Oggetto<input className={campo} value={contatto.oggetto} onChange={e => setContatto({ ...contatto, oggetto: e.target.value })} /></label>
            <label className="text-xs text-gray-600">Esito<input className={campo} value={contatto.esito} onChange={e => setContatto({ ...contatto, esito: e.target.value })} /></label>
            <label className="text-xs text-gray-600 md:col-span-2">Email o documento (facoltativo)<input type="file" className="text-xs block" onChange={e => setContatto({ ...contatto, file: e.target.files?.[0] || null })} /></label>
            <div className="flex gap-1 items-end">
              <button type="button" disabled={!contatto.ente.trim() || !contatto.oggetto.trim() || inCorso !== null}
                onClick={async () => {
                  const ok = await inviaForm('contatto', `/api/pratiche/${progettoId}/contatti-pa`, { ...contatto, file: contatto.file }, 'Contatto registrato')
                  if (ok) { setContatto({ data: oggi(), ente: '', persona: '', tipo: 'richiesta_formale', oggetto: '', esito: '', file: null }); setMostraContatto(false) }
                }}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-40">Registra</button>
              <button type="button" onClick={() => setMostraContatto(false)} className="px-2 py-1 text-xs border rounded">Annulla</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setMostraContatto(true)} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Registra un contatto</button>
        )}
      </Sezione>

      {/* Cronologia */}
      <Sezione titolo="Cronologia dei passaggi">
        {dati.passaggi.length === 0 ? (
          <p className="text-xs text-gray-500">Nessun passaggio ancora.</p>
        ) : (
          <ul className="text-xs space-y-1">
            {dati.passaggi.map((p: any) => (
              <li key={p.id}>
                <span className="text-gray-500">{new Date(p.quando).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</span>{' '}
                {nomi[p.utente_id] || 'Sistema'}: {p.da_fase ? `da ${FASI.find(f => f.id === p.da_fase)?.etichetta} a ` : ''}{FASI.find(f => f.id === p.a_fase)?.etichetta}
                {p.note && <span className="text-gray-500"> · {p.note}</span>}
                {p.deroga && <span className="text-amber-700"> · in deroga: {p.deroga}</span>}
              </li>
            ))}
          </ul>
        )}
      </Sezione>
    </div>
  )
}
