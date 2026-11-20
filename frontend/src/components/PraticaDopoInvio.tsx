'use client'

import { useState } from 'react'
import { Check, ExternalLink, Upload, CalendarClock, AlertTriangle, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { CalendarService } from '@/lib/notifications/calendarService'

/**
 * Pratica dopo l'invio (Modello 231, PR.01 §4.2-4.3): integrazioni richieste
 * dall'ente con controllo a quattro occhi, rendicontazione (cumulo, checklist
 * di RP e REV, firma, ricevuta), rettifiche segnalate ad AU e OdV.
 */

type Props = {
  progettoId: string
  dati: any
  ricarica: () => Promise<void>
  /** Esegue una richiesta e mostra esito o errore nella scheda */
  invia: (chiave: string, url: string, campi: Record<string, string | File | null | undefined>, ok: string) => Promise<any>
  occupato: boolean
}

function oggi() { return new Date().toISOString().slice(0, 10) }
function dataIt(d?: string | null) { return d ? new Date(d).toLocaleDateString('it-IT') : '' }
function giorniA(d: string) {
  const t = new Date(`${d}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()
  return Math.round(t / 86400000)
}

function Scadenza({ data, conclusa }: { data: string; conclusa: boolean }) {
  if (conclusa) return <span className="text-green-700">inviata</span>
  const g = giorniA(data)
  const colore = g < 0 ? 'text-red-700 font-medium' : g <= 10 ? 'text-amber-700 font-medium' : g <= 30 ? 'text-amber-600' : 'text-gray-600'
  return <span className={colore}>scadenza {dataIt(data)} ({g < 0 ? `superata da ${-g} giorni` : g === 0 ? 'oggi' : `tra ${g} giorni`})</span>
}

function Collegamento({ url, testo }: { url?: string | null; testo: string }) {
  if (!url) return null
  return <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-0.5">{testo}<ExternalLink className="w-3 h-3" /></a>
}

const campo = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm'

export default function PraticaDopoInvio({ progettoId, dati, ricarica, invia, occupato }: Props) {
  const { haPermesso, isAdmin } = useAuth()
  const { pratica, nomi } = dati
  const io = dati.io as string
  const partecipanti = [dati.email?.[pratica.rp_id], dati.email?.[pratica.rev_id]].filter(Boolean) as string[]
  const [nuovaIntegrazione, setNuovaIntegrazione] = useState<any>(null)
  const [nuovoRendiconto, setNuovoRendiconto] = useState<any>(null)
  const [nuovaRettifica, setNuovaRettifica] = useState<any>(null)
  const [modulo, setModulo] = useState<{ voce: string; azione: string; data: string; file: File | null; extra: Record<string, string> } | null>(null)
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  // Modulo aperto (letture e aggiornamenti sicuri anche quando è chiuso)
  const mod = modulo ?? { voce: '', azione: '', data: oggi(), file: null as File | null, extra: {} as Record<string, string> }
  const [avvisoCalendario, setAvvisoCalendario] = useState('')

  const promemoria = async (entityId: string, titolo: string, descrizione: string, scadenza: string) => {
    try {
      const n = await CalendarService.creaPromemoria231({ entityId, titolo, descrizione, scadenza, partecipanti })
      setAvvisoCalendario(n > 0
        ? `Promemoria creati nel calendario (${n}): 30 e 10 giorni prima e il giorno della scadenza${partecipanti.length ? ', con responsabile e revisore invitati' : ''}.`
        : 'Promemoria di calendario non creati: collega il tuo account Google in Impostazioni > Le Mie API Google.')
    } catch {
      setAvvisoCalendario('Promemoria di calendario non creati: permessi del calendario insufficienti.')
    }
  }

  const azione = async (tipo: 'integrazioni' | 'rendiconti', voce: string, nome: string, extra: Record<string, string | File | null | undefined> = {}, ok = 'Aggiornato') => {
    const r = await invia(`${tipo}-${voce}`, `/api/pratiche/${progettoId}/${tipo}/${voce}`, { azione: nome, ...extra }, ok)
    if (r) setModulo(null)
    return r
  }

  const elimina = async (tipo: 'integrazioni' | 'rendiconti', voce: string) => {
    if (!confirm('Eliminare questa voce? Resta ripristinabile dal registro attività.')) return
    const r = await fetch(`/api/pratiche/${progettoId}/${tipo}/${voce}`, { method: 'DELETE' })
    if (r.ok) await ricarica()
  }

  const moduloInvio = (tipo: 'integrazioni' | 'rendiconti', voceId: string, etichetta: string) => (
    modulo?.voce === voceId && modulo.azione === 'inviato' ? (
      <div className="flex flex-wrap items-end gap-2 mt-1">
        <label className="text-xs text-gray-600">Data di invio<input type="date" className={campo} value={mod.data} onChange={e => setModulo({ ...mod, data: e.target.value })} /></label>
        <label className="text-xs text-gray-600">Ricevuta<input type="file" className="text-xs block" onChange={e => setModulo({ ...mod, file: e.target.files?.[0] || null })} /></label>
        {isAdmin() && (
          <label className="text-xs text-gray-600">Deroga (solo amministratori, se manca qualcosa)
            <input className={campo} value={mod.extra.deroga || ''} onChange={e => setModulo({ ...mod, extra: { ...mod.extra, deroga: e.target.value } })} />
          </label>
        )}
        <button type="button" disabled={occupato}
          onClick={() => azione(tipo, voceId, tipo === 'integrazioni' ? 'inviata' : 'inviato', { data: mod.data, file: mod.file, deroga: mod.extra.deroga }, `${etichetta}: invio registrato`)}
          className="px-2 py-1 text-xs bg-green-600 text-white rounded disabled:opacity-40">Registra l&apos;invio</button>
        <button type="button" onClick={() => setModulo(null)} className="px-2 py-1 text-xs border rounded">Annulla</button>
      </div>
    ) : (
      <button type="button" onClick={() => setModulo({ voce: voceId, azione: 'inviato', data: oggi(), file: null, extra: {} })}
        className="px-2 py-0.5 text-xs border border-green-400 text-green-800 rounded hover:bg-green-50">Registra l&apos;invio</button>
    )
  )

  const ChecklistRendiconto = ({ r, chi }: { r: any; chi: 'rp' | 'rev' }) => {
    const valore = r[`checklist_${chi}`]
    const autore = r[`checklist_${chi}_da`]
    const titolare = chi === 'rp' ? pratica.rp_id : pratica.rev_id
    const ruolo = chi === 'rp' ? 'responsabile di pratica' : 'revisore'
    const tutteOk = Array.isArray(valore) && valore.every((v: any) => v.ok)
    if (valore) {
      return <p className={`text-xs ${tutteOk ? 'text-green-700' : 'text-amber-700'}`}>Checklist del {ruolo}: {nomi[autore] || ''}, {dataIt(r[`checklist_${chi}_il`])}{tutteOk ? ', tutto verificato' : ', con voci non verificate'}</p>
    }
    if (io !== titolare) return <p className="text-xs text-gray-500">Checklist del {ruolo}: la compila {nomi[titolare] || 'il ' + ruolo + ' (da assegnare)'}.</p>
    const chiave = `${r.id}-${chi}`
    return (
      <div className="border border-gray-200 rounded p-2 my-1">
        <p className="text-xs font-medium text-gray-800 mb-1">La tua checklist da {ruolo}</p>
        {dati.vociRendicontazione.map((v: any) => (
          <label key={v.chiave} className="flex items-start gap-2 text-xs text-gray-800 py-0.5">
            <input type="checkbox" checked={!!checklist[`${chiave}-${v.chiave}`]} onChange={e => setChecklist({ ...checklist, [`${chiave}-${v.chiave}`]: e.target.checked })} />
            {v.etichetta}
          </label>
        ))}
        <button type="button" disabled={occupato}
          onClick={() => azione('rendiconti', r.id, `checklist_${chi}`, {
            voci: JSON.stringify(dati.vociRendicontazione.map((v: any) => ({ chiave: v.chiave, etichetta: v.etichetta, ok: !!checklist[`${chiave}-${v.chiave}`] })))
          }, 'Checklist registrata')}
          className="mt-1 px-2 py-1 text-xs bg-gray-800 text-white rounded disabled:opacity-40">Conferma la checklist</button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {avvisoCalendario && (
        <div className="p-2 text-xs bg-blue-50 border border-blue-200 rounded text-blue-800 flex gap-1.5"><CalendarClock className="w-4 h-4 shrink-0" />{avvisoCalendario}</div>
      )}

      {/* Integrazioni */}
      <section className="rounded-lg border border-gray-200 bg-white p-3">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">Integrazioni richieste dall&apos;ente</h4>
        <p className="text-[11px] text-gray-500 mb-2">La risposta la prepara una persona e la verifica un&apos;altra prima dell&apos;invio.</p>
        {dati.integrazioni.length > 0 && (
          <ul className="space-y-2 mb-2">
            {dati.integrazioni.map((i: any) => (
              <li key={i.id} className="text-xs border-l-2 border-gray-200 pl-2">
                <div className="flex flex-wrap gap-x-2">
                  <strong>{i.ente}</strong><span>{i.oggetto}</span>
                  <Scadenza data={i.scadenza} conclusa={!!i.data_invio} />
                  <Collegamento url={i.richiesta_file_url} testo="richiesta" />
                  {haPermesso('elementi.elimina') && !i.data_invio && (
                    <button type="button" title="Elimina" onClick={() => elimina('integrazioni', i.id)} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-gray-700">
                  {i.preparata_da
                    ? <span><Check className="w-3 h-3 inline text-green-600" /> preparata da {nomi[i.preparata_da]}</span>
                    : <button type="button" disabled={occupato} onClick={() => azione('integrazioni', i.id, 'preparata', {}, 'Risposta segnata come preparata')} className="px-2 py-0.5 border rounded hover:bg-gray-50">La risposta è pronta</button>}
                  {i.preparata_da && (i.verificata_da
                    ? <span><Check className="w-3 h-3 inline text-green-600" /> verificata da {nomi[i.verificata_da]}</span>
                    : io !== i.preparata_da
                      ? <button type="button" disabled={occupato} onClick={() => azione('integrazioni', i.id, 'verificata', {}, 'Risposta verificata')} className="px-2 py-0.5 border border-blue-400 text-blue-800 rounded hover:bg-blue-50">Ho verificato la risposta</button>
                      : <span className="text-amber-700">da verificare da un&apos;altra persona</span>)}
                  {i.data_invio
                    ? <span className="text-green-700">inviata il {dataIt(i.data_invio)} <Collegamento url={i.ricevuta_file_url} testo="ricevuta" />{i.deroga && <span className="text-amber-700"> · in deroga: {i.deroga}</span>}</span>
                    : (i.verificata_da || isAdmin()) && moduloInvio('integrazioni', i.id, 'Integrazione')}
                </div>
              </li>
            ))}
          </ul>
        )}
        {nuovaIntegrazione ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 border border-gray-200 rounded p-2">
            <label className="text-xs text-gray-600">Richiesta del<input type="date" className={campo} value={nuovaIntegrazione.data_richiesta} onChange={e => setNuovaIntegrazione({ ...nuovaIntegrazione, data_richiesta: e.target.value })} /></label>
            <label className="text-xs text-gray-600">Scadenza per rispondere<input type="date" className={campo} value={nuovaIntegrazione.scadenza} onChange={e => setNuovaIntegrazione({ ...nuovaIntegrazione, scadenza: e.target.value })} /></label>
            <label className="text-xs text-gray-600">Ente<input className={campo} value={nuovaIntegrazione.ente} onChange={e => setNuovaIntegrazione({ ...nuovaIntegrazione, ente: e.target.value })} /></label>
            <label className="text-xs text-gray-600 md:col-span-2">Che cosa chiede<input className={campo} value={nuovaIntegrazione.oggetto} onChange={e => setNuovaIntegrazione({ ...nuovaIntegrazione, oggetto: e.target.value })} /></label>
            <label className="text-xs text-gray-600">Richiesta (facoltativa)<input type="file" className="text-xs block" onChange={e => setNuovaIntegrazione({ ...nuovaIntegrazione, file: e.target.files?.[0] || null })} /></label>
            <div className="flex gap-1 md:col-span-3">
              <button type="button" disabled={occupato || !nuovaIntegrazione.ente.trim() || !nuovaIntegrazione.oggetto.trim() || !nuovaIntegrazione.scadenza}
                onClick={async () => {
                  const r = await invia('integrazione', `/api/pratiche/${progettoId}/integrazioni`, nuovaIntegrazione, 'Integrazione registrata')
                  if (r?.id) {
                    await promemoria(r.id, `Integrazione ${nuovaIntegrazione.ente} · ${pratica.cliente}`, `Risposta all'integrazione: ${nuovaIntegrazione.oggetto}\nPratica: ${pratica.titolo}`, nuovaIntegrazione.scadenza)
                    setNuovaIntegrazione(null)
                  }
                }}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-40">Registra</button>
              <button type="button" onClick={() => setNuovaIntegrazione(null)} className="px-2 py-1 text-xs border rounded">Annulla</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setNuovaIntegrazione({ data_richiesta: oggi(), scadenza: '', ente: '', oggetto: '', file: null })}
            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Registra una richiesta di integrazione</button>
        )}
      </section>

      {/* Rendicontazione */}
      <section className="rounded-lg border border-gray-200 bg-white p-3">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">Rendicontazione</h4>
        <p className="text-[11px] text-gray-500 mb-2">
          Prima dell&apos;invio: dichiarazione del cliente sugli altri contributi e sul cumulo, checklist del responsabile e del revisore,
          firma del cliente o di un delegato BLM (delega archiviata, AU informata), ricevuta.
        </p>
        {dati.rendiconti.length > 0 && (
          <ul className="space-y-3 mb-2">
            {dati.rendiconti.map((r: any) => (
              <li key={r.id} className="text-xs border-l-2 border-gray-200 pl-2 space-y-1">
                <div className="flex flex-wrap gap-x-2 items-center">
                  <strong>{r.descrizione}</strong>
                  <Scadenza data={r.scadenza} conclusa={!!r.data_invio} />
                  {r.segnalato_ritardo_il && !r.data_invio && <span className="text-red-700 inline-flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> ritardo segnalato ad AU e OdV</span>}
                  {haPermesso('elementi.elimina') && !r.data_invio && (
                    <button type="button" title="Elimina" onClick={() => elimina('rendiconti', r.id)} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                {/* Cumulo */}
                {r.cumulo_file_url
                  ? <p className="text-green-700">Dichiarazione sul cumulo del {dataIt(r.cumulo_data)} <Collegamento url={r.cumulo_file_url} testo="documento" /></p>
                  : modulo?.voce === r.id && mod.azione === 'cumulo' ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="text-gray-600">Data<input type="date" className={campo} value={mod.data} onChange={e => setModulo({ ...mod, data: e.target.value })} /></label>
                      <input type="file" className="text-xs" onChange={e => setModulo({ ...mod, file: e.target.files?.[0] || null })} />
                      <button type="button" disabled={!mod.file || occupato} onClick={() => azione('rendiconti', r.id, 'cumulo', { data: mod.data, file: mod.file }, 'Dichiarazione registrata')} className="px-2 py-1 bg-green-600 text-white rounded disabled:opacity-40">Registra</button>
                      <button type="button" onClick={() => setModulo(null)} className="px-2 py-1 border rounded">Annulla</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setModulo({ voce: r.id, azione: 'cumulo', data: oggi(), file: null, extra: {} })} className="px-2 py-0.5 border rounded hover:bg-gray-50 inline-flex items-center gap-1"><Upload className="w-3 h-3" /> Dichiarazione del cliente sul cumulo</button>
                  )}
                <ChecklistRendiconto r={r} chi="rp" />
                <ChecklistRendiconto r={r} chi="rev" />
                {/* Firma */}
                {r.firmatario
                  ? <p className="text-gray-700">Firma: {r.firmatario === 'cliente' ? 'il cliente' : 'un delegato BLM'}{r.firmatario === 'delegato_blm' && <> · <Collegamento url={r.delega_file_url} testo="delega" />{r.au_informata ? ' · AU informata' : <span className="text-red-700"> · AU da informare</span>}</>}</p>
                  : modulo?.voce === r.id && mod.azione === 'firma' ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="text-gray-600">Chi firma
                        <select className={campo} value={mod.extra.firmatario || 'cliente'} onChange={e => setModulo({ ...mod, extra: { ...mod.extra, firmatario: e.target.value } })}>
                          <option value="cliente">Il cliente</option><option value="delegato_blm">Un delegato BLM</option>
                        </select>
                      </label>
                      {mod.extra.firmatario === 'delegato_blm' && (<>
                        <label className="text-gray-600">Delega<input type="file" className="text-xs block" onChange={e => setModulo({ ...mod, file: e.target.files?.[0] || null })} /></label>
                        <label className="flex items-center gap-1 text-gray-700"><input type="checkbox" checked={mod.extra.au_informata === 'true'} onChange={e => setModulo({ ...mod, extra: { ...mod.extra, au_informata: String(e.target.checked) } })} /> AU informata</label>
                      </>)}
                      <button type="button" disabled={occupato} onClick={() => azione('rendiconti', r.id, 'firma', { firmatario: mod.extra.firmatario || 'cliente', au_informata: mod.extra.au_informata || 'false', file: mod.file }, 'Firma registrata')} className="px-2 py-1 bg-green-600 text-white rounded disabled:opacity-40">Registra</button>
                      <button type="button" onClick={() => setModulo(null)} className="px-2 py-1 border rounded">Annulla</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setModulo({ voce: r.id, azione: 'firma', data: oggi(), file: null, extra: { firmatario: 'cliente' } })} className="px-2 py-0.5 border rounded hover:bg-gray-50">Indica chi firma</button>
                  )}
                {/* Invio */}
                {r.data_invio
                  ? <p className="text-green-700">Inviato il {dataIt(r.data_invio)} <Collegamento url={r.ricevuta_file_url} testo="ricevuta" />{r.deroga && <span className="text-amber-700"> · in deroga: {r.deroga}</span>}</p>
                  : moduloInvio('rendiconti', r.id, 'Rendiconto')}
              </li>
            ))}
          </ul>
        )}
        {nuovoRendiconto ? (
          <div className="flex flex-wrap items-end gap-2 border border-gray-200 rounded p-2">
            <label className="text-xs text-gray-600">Che cosa
              <input className={campo} value={nuovoRendiconto.descrizione} placeholder="per esempio Anticipo, SAL 1, Saldo" onChange={e => setNuovoRendiconto({ ...nuovoRendiconto, descrizione: e.target.value })} />
            </label>
            <label className="text-xs text-gray-600">Scadenza<input type="date" className={campo} value={nuovoRendiconto.scadenza} onChange={e => setNuovoRendiconto({ ...nuovoRendiconto, scadenza: e.target.value })} /></label>
            <button type="button" disabled={occupato || !nuovoRendiconto.descrizione.trim() || !nuovoRendiconto.scadenza}
              onClick={async () => {
                const r = await invia('rendiconto', `/api/pratiche/${progettoId}/rendiconti`, nuovoRendiconto, 'Rendiconto registrato')
                if (r?.id) {
                  await promemoria(r.id, `Rendicontazione ${nuovoRendiconto.descrizione} · ${pratica.cliente}`, `Rendiconto: ${nuovoRendiconto.descrizione}\nPratica: ${pratica.titolo}`, nuovoRendiconto.scadenza)
                  setNuovoRendiconto(null)
                }
              }}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-40">Registra</button>
            <button type="button" onClick={() => setNuovoRendiconto(null)} className="px-2 py-1 text-xs border rounded">Annulla</button>
          </div>
        ) : (
          <button type="button" onClick={() => setNuovoRendiconto({ descrizione: '', scadenza: pratica.scadenza_rendicontazione || '' })}
            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Aggiungi un rendiconto con la sua scadenza</button>
        )}
      </section>

      {/* Rettifiche */}
      <section className="rounded-lg border border-gray-200 bg-white p-3">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">Rettifiche dopo l&apos;invio</h4>
        <p className="text-[11px] text-gray-500 mb-2">
          Un errore emerso dopo l&apos;invio si corregge solo con rettifica formale (portale o PEC). La registrazione avvisa AU e OdV nel registro attività.
        </p>
        {dati.rettifiche.length > 0 && (
          <ul className="text-xs space-y-1 mb-2">
            {dati.rettifiche.map((r: any) => (
              <li key={r.id}>
                <span className="text-gray-500">{dataIt(r.data_rilevazione)}</span> · {r.errore} · rettifica via {r.modalita === 'pec' ? 'PEC' : 'portale'}
                {r.data_rettifica && ` il ${dataIt(r.data_rettifica)}`} <Collegamento url={r.allegato_file_url} testo="documento" />
                <span className="text-gray-400"> · {nomi[r.registrata_da] || ''}</span>
              </li>
            ))}
          </ul>
        )}
        {nuovaRettifica ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 border border-gray-200 rounded p-2">
            <label className="text-xs text-gray-600">Errore rilevato il<input type="date" className={campo} value={nuovaRettifica.data_rilevazione} onChange={e => setNuovaRettifica({ ...nuovaRettifica, data_rilevazione: e.target.value })} /></label>
            <label className="text-xs text-gray-600">Rettifica via
              <select className={campo} value={nuovaRettifica.modalita} onChange={e => setNuovaRettifica({ ...nuovaRettifica, modalita: e.target.value })}>
                <option value="pec">PEC</option><option value="portale">Portale dell&apos;ente</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">Inviata il (se già fatta)<input type="date" className={campo} value={nuovaRettifica.data_rettifica} onChange={e => setNuovaRettifica({ ...nuovaRettifica, data_rettifica: e.target.value })} /></label>
            <label className="text-xs text-gray-600 md:col-span-2">Errore e correzione<input className={campo} value={nuovaRettifica.errore} onChange={e => setNuovaRettifica({ ...nuovaRettifica, errore: e.target.value })} /></label>
            <label className="text-xs text-gray-600">Documento (facoltativo)<input type="file" className="text-xs block" onChange={e => setNuovaRettifica({ ...nuovaRettifica, file: e.target.files?.[0] || null })} /></label>
            <div className="flex gap-1 md:col-span-3">
              <button type="button" disabled={occupato || !nuovaRettifica.errore.trim()}
                onClick={async () => { const r = await invia('rettifica', `/api/pratiche/${progettoId}/rettifiche`, nuovaRettifica, 'Rettifica registrata e segnalata ad AU e OdV'); if (r) setNuovaRettifica(null) }}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-40">Registra</button>
              <button type="button" onClick={() => setNuovaRettifica(null)} className="px-2 py-1 text-xs border rounded">Annulla</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setNuovaRettifica({ data_rilevazione: oggi(), modalita: 'pec', data_rettifica: '', errore: '', file: null })}
            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Registra una rettifica</button>
        )}
      </section>
    </div>
  )
}
