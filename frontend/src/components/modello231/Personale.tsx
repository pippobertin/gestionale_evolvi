'use client'

import { useState } from 'react'
import { Plus, Paperclip, AlertTriangle } from 'lucide-react'
import { LoadingSpinner } from '../shared'
import { Avvisi, campo, dataIt, oggi, useRegistro } from './comune'

/**
 * Checklist di ingresso e di uscita del personale (modulo M.06). L'uscita si
 * compila il giorno dell'uscita: accesso al gestionale chiuso, persona tolta
 * dagli elenchi delle deleghe, documento firmato dal responsabile.
 */
const TIPI: Record<string, string> = {
  ingresso_interno: 'Ingresso di persona interna', ingresso_esterno: 'Ingresso di persona esterna', uscita: 'Uscita'
}
const STATI: Record<string, string> = { da_fare: 'Da fare', fatto: 'Fatto', non_dovuta: 'Non dovuta' }

function traGiorni(data: string) {
  return Math.round((new Date(`${data.slice(0, 10)}T00:00:00`).getTime() - new Date(`${oggi()}T00:00:00`).getTime()) / 86400000)
}

export default function Personale({ solaLettura = false }: { solaLettura?: boolean }) {
  const { dati, errore, messaggio, inCorso, invia, carica } = useRegistro<any>('/api/231/personale')
  const [nuova, setNuova] = useState<any>(null)
  const [aperta, setAperta] = useState<string | null>(null)
  const [bozza, setBozza] = useState<any[] | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [erroreLocale, setErroreLocale] = useState('')

  if (!dati && !errore) return <div className="p-6"><LoadingSpinner /></div>
  if (!dati) return <Avvisi errore={errore} messaggio="" />
  const admin = dati.admin && !solaLettura
  const utenti: any[] = dati.utenti || []

  // Uscite in arrivo: fine accesso entro 15 giorni (o passata) senza checklist di uscita completata
  const uscite = admin ? utenti.filter(u => u.accesso_fino_al && traGiorni(u.accesso_fino_al) <= 15 &&
    !(dati.checklist as any[]).some(c => c.tipo === 'uscita' && c.utente_id === u.id && c.completata_il)) : []

  const disattiva = async (utenteId: string) => {
    if (!confirm('Disattivare ora l\'accesso al gestionale? La persona non potrà più entrare e uscirà dagli elenchi delle deleghe.')) return
    setErroreLocale('')
    const r = await fetch(`/api/admin/users/${utenteId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attivo: false }) })
    if (!r.ok) setErroreLocale((await r.json().catch(() => ({}))).error || 'Disattivazione non riuscita')
    await carica()
  }

  const salva = async (c: any, azione: 'salva' | 'completa') => {
    const f = new FormData()
    f.append('azione', azione)
    if (bozza) f.append('voci', JSON.stringify(bozza))
    if (file) f.append('file', file)
    const ok = await invia(`/api/231/personale/${c.id}`, 'PATCH', f, azione === 'completa' ? 'Checklist completata' : 'Checklist salvata')
    if (ok) { setFile(null); if (azione === 'completa') { setAperta(null); setBozza(null) } else setBozza(null) }
  }

  return (
    <div className="space-y-3">
      <Avvisi errore={errore || erroreLocale} messaggio={messaggio} />
      <p className="text-sm text-gray-600">
        Una checklist per ogni ingresso (interni ed esterni) e per ogni uscita, da completare con il documento firmato dal responsabile.
        {admin ? ' Le compilano gli amministratori.' : solaLettura ? '' : ' Qui vedi le tue.'}
      </p>

      {uscite.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm space-y-1">
          <div className="font-medium text-amber-900 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Uscite in arrivo</div>
          {uscite.map(u => {
            const giorni = traGiorni(u.accesso_fino_al)
            const esistente = (dati.checklist as any[]).find(c => c.tipo === 'uscita' && c.utente_id === u.id)
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-2 text-amber-900">
                <span>{dati.nomi[u.id]}: accesso fino al {dataIt(u.accesso_fino_al)} ({giorni < 0 ? 'già scaduto' : giorni === 0 ? 'oggi' : `tra ${giorni} giorni`})</span>
                {esistente
                  ? <button type="button" className="text-blue-700 hover:underline" onClick={() => { setAperta(esistente.id); setBozza(null) }}>apri la checklist di uscita</button>
                  : <button type="button" disabled={inCorso} className="px-2 py-0.5 border border-amber-400 rounded"
                      onClick={async () => { const d = await invia('/api/231/personale', 'POST', { tipo: 'uscita', utente_id: u.id }, 'Checklist di uscita creata'); if (d?.id) setAperta(d.id) }}>Crea la checklist di uscita</button>}
              </div>
            )
          })}
        </div>
      )}

      {admin && !nuova && (
        <button type="button" onClick={() => setNuova({ tipo: 'ingresso_interno', utente_id: '', persona: '', ruolo: '', periodo_dal: oggi(), periodo_al: '' })}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Nuova checklist</button>
      )}
      {nuova && (
        <div className="bg-white border border-blue-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="text-xs text-gray-600">Tipo
            <select className={campo} value={nuova.tipo} onChange={e => setNuova({ ...nuova, tipo: e.target.value })}>
              {Object.entries(TIPI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Utente del gestionale
            <select className={campo} value={nuova.utente_id} onChange={e => setNuova({ ...nuova, utente_id: e.target.value })}>
              <option value="">Nessuno (persona senza accesso)</option>
              {utenti.map(u => <option key={u.id} value={u.id}>{dati.nomi[u.id]}{u.attivo ? '' : ' (disattivato)'}</option>)}
            </select>
          </label>
          {!nuova.utente_id && <label className="text-xs text-gray-600">Nome e cognome<input className={campo} value={nuova.persona} onChange={e => setNuova({ ...nuova, persona: e.target.value })} /></label>}
          <label className="text-xs text-gray-600">Ruolo<input className={campo} placeholder="es. tirocinante, docente, collaboratore" value={nuova.ruolo} onChange={e => setNuova({ ...nuova, ruolo: e.target.value })} /></label>
          <label className="text-xs text-gray-600">Periodo dal<input type="date" className={campo} value={nuova.periodo_dal} onChange={e => setNuova({ ...nuova, periodo_dal: e.target.value })} /></label>
          <label className="text-xs text-gray-600">al (se già nota; per gli utenti vale la fine dell&apos;accesso)<input type="date" className={campo} value={nuova.periodo_al} onChange={e => setNuova({ ...nuova, periodo_al: e.target.value })} /></label>
          <div className="flex gap-2 md:col-span-3">
            <button type="button" disabled={inCorso || (!nuova.utente_id && !nuova.persona.trim())}
              onClick={async () => { const d = await invia('/api/231/personale', 'POST', nuova, 'Checklist creata'); if (d?.id) { setNuova(null); setAperta(d.id); setBozza(null) } }}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-40">Crea</button>
            <button type="button" onClick={() => setNuova(null)} className="px-3 py-1.5 text-sm border rounded">Annulla</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(dati.checklist as any[]).length === 0 && <div className="bg-white border rounded-lg p-4 text-sm text-gray-500">Nessuna checklist.</div>}
        {(dati.checklist as any[]).map(c => {
          const espansa = aperta === c.id
          const voci: any[] = espansa && bozza ? bozza : c.voci
          const fatte = (c.voci as any[]).filter(v => v.stato !== 'da_fare').length
          const modificabile = admin && !c.completata_il
          const utente = utenti.find(u => u.id === c.utente_id)
          const autorizzazioni = (dati.autorizzazioni || []).filter((a: any) => a.utente_id === c.utente_id)
          const titolarita = (dati.titolarita || []).filter((t: any) => t.titolare_id === c.utente_id)
          const aggiorna = (chiave: string, campo: string, valore: string) =>
            setBozza((bozza || c.voci).map((v: any) => v.chiave === chiave ? { ...v, [campo]: valore, ...(campo === 'stato' && valore === 'fatto' && !v.data ? { data: oggi() } : {}) } : v))
          return (
            <div key={c.id} className="bg-white border border-gray-200 rounded-lg">
              <button type="button" onClick={() => { setAperta(espansa ? null : c.id); setBozza(null); setFile(null) }}
                className="w-full px-3 py-2 flex flex-wrap items-center gap-2 text-left text-sm">
                <span className="font-medium text-gray-900">{c.persona}</span>
                <span className="text-gray-500">{TIPI[c.tipo]}{c.ruolo ? ` · ${c.ruolo}` : ''}</span>
                <span className="text-gray-500">{c.periodo_dal ? `dal ${dataIt(c.periodo_dal)}` : ''}{c.periodo_al ? ` al ${dataIt(c.periodo_al)}` : ''}</span>
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${c.completata_il ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                  {c.completata_il ? `Completata il ${dataIt(c.completata_il)}${c.completata_da ? `, ${dati.nomi[c.completata_da] || ''}` : ''}` : `${fatte} di ${c.voci.length} voci`}
                </span>
              </button>
              {espansa && (
                <div className="border-t px-3 py-2 space-y-2">
                  {c.tipo === 'uscita' && c.utente_id && admin && (
                    <div className="p-2 bg-slate-50 border rounded text-xs space-y-1">
                      <div>
                        Gestionale: {utente?.attivo === false ? <span className="text-green-700">accesso disattivato</span>
                          : <>accesso attivo{utente?.accesso_fino_al ? ` fino al ${dataIt(utente.accesso_fino_al)}` : ''}
                              {!c.completata_il && <button type="button" className="ml-2 px-2 py-0.5 border border-red-300 text-red-700 rounded" onClick={() => disattiva(c.utente_id)}>Disattiva ora</button>}</>}
                      </div>
                      <div>
                        Persone autorizzate sulle deleghe: {autorizzazioni.length === 0 ? <span className="text-green-700">non compare in nessun elenco</span>
                          : <>{autorizzazioni.map((a: any) => `${a.scadenze_bandi_deleghe?.scadenze_bandi_clienti?.denominazione || ''} (${a.scadenze_bandi_deleghe?.piattaforma || ''})`).join('; ')}
                              {!c.completata_il && <button type="button" disabled={inCorso} className="ml-2 px-2 py-0.5 border border-red-300 text-red-700 rounded"
                                onClick={() => { const f = new FormData(); f.append('azione', 'rimuovi_autorizzazioni'); invia(`/api/231/personale/${c.id}`, 'PATCH', f, 'Tolta da tutti gli elenchi') }}>Togli da tutti</button>}</>}
                      </div>
                      {titolarita.length > 0 && (
                        <div className="text-amber-800">
                          È titolare dell&apos;accesso su: {titolarita.map((t: any) => `${t.scadenze_bandi_clienti?.denominazione || ''} (${t.piattaforma})`).join('; ')}.
                          Va chiesto al cliente di revocare o trasferire la delega, poi la si registra come revocata nella scheda Deleghe dei clienti.
                        </div>
                      )}
                    </div>
                  )}
                  <table className="min-w-full text-xs">
                    <tbody className="divide-y divide-gray-100">
                      {voci.map((v: any) => (
                        <tr key={v.chiave} className="align-top">
                          <td className="py-1 pr-2 text-gray-800">{v.etichetta}</td>
                          <td className="py-1 pr-2 whitespace-nowrap">
                            {modificabile
                              ? <select className="px-1 py-0.5 border rounded" value={v.stato} onChange={e => aggiorna(v.chiave, 'stato', e.target.value)}>
                                  {Object.entries(STATI).filter(([k]) => k !== 'non_dovuta' || v.facoltativa).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                                </select>
                              : <span className={v.stato === 'da_fare' ? 'text-amber-700' : 'text-gray-700'}>{STATI[v.stato]}</span>}
                          </td>
                          <td className="py-1 pr-2 whitespace-nowrap">
                            {modificabile && v.stato === 'fatto'
                              ? <input type="date" className="px-1 py-0.5 border rounded" value={v.data || ''} onChange={e => aggiorna(v.chiave, 'data', e.target.value)} />
                              : dataIt(v.data)}
                          </td>
                          <td className="py-1 w-1/3">
                            {modificabile
                              ? <input className="px-1 py-0.5 border rounded w-full" placeholder="Nota" value={v.nota || ''} onChange={e => aggiorna(v.chiave, 'nota', e.target.value)} />
                              : <span className="text-gray-500">{v.nota}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-xs">
                    {(c.allegati || []).map((a: any) => a.url && (
                      <a key={a.id || a.nome} href={a.url} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-0.5 mr-3"><Paperclip className="w-3 h-3" />{a.nome}</a>
                    ))}
                  </div>
                  {modificabile && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs text-gray-600">Checklist firmata dal responsabile <input type="file" className="text-xs" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
                      <button type="button" disabled={inCorso || (!bozza && !file)} onClick={() => salva(c, 'salva')}
                        className="px-3 py-1 text-sm border border-gray-400 rounded disabled:opacity-40">Salva</button>
                      <button type="button" disabled={inCorso} onClick={() => { if (confirm('Completare la checklist? Dopo non sarà più modificabile.')) salva(c, 'completa') }}
                        className="px-3 py-1 text-sm bg-gray-800 text-white rounded disabled:opacity-40">Completa</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
