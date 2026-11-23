'use client'

import { useState } from 'react'
import { Plus, Paperclip } from 'lucide-react'
import { LoadingSpinner } from '../shared'
import { Avvisi, campo, dataIt, oggi, useRegistro } from './comune'

/**
 * Registro delle deleghe dei clienti (PR.03 §4.2): chi può operare su quale
 * piattaforma per conto di quale cliente. Nessuno usa SPID, password o OTP di un
 * altro: se la delega è solo dell'AU, i colleghi preparano e l'AU inserisce o invia.
 */
const TIPI: Record<string, string> = { delega_piattaforma: 'Delega in piattaforma', mandato: 'Mandato scritto', procura: 'Procura' }
const SEI_MESI = 182 * 24 * 3600 * 1000

function stato(d: any): { testo: string; classe: string } {
  if (d.revocata_il) return { testo: `Revocata il ${dataIt(d.revocata_il)}`, classe: 'bg-gray-100 text-gray-600' }
  if (d.valida_al && d.valida_al < oggi()) return { testo: `Scaduta il ${dataIt(d.valida_al)}`, classe: 'bg-amber-100 text-amber-800' }
  const base = new Date(d.riesaminata_il || d.created_at).getTime()
  if (Date.now() - base > SEI_MESI) return { testo: 'Attiva, riesame da fare', classe: 'bg-amber-100 text-amber-800' }
  return { testo: 'Attiva', classe: 'bg-green-100 text-green-800' }
}

export default function Deleghe({ solaLettura = false, clienteId }: { solaLettura?: boolean; clienteId?: string }) {
  const { dati, errore, messaggio, inCorso, invia } = useRegistro<any>(clienteId ? `/api/231/deleghe?cliente_id=${clienteId}` : '/api/231/deleghe')
  const [nuova, setNuova] = useState<any>(null)
  const [file, setFile] = useState<File | null>(null)
  const [filtro, setFiltro] = useState('')
  const [revoca, setRevoca] = useState<{ id: string; motivo: string } | null>(null)
  const [aggiungi, setAggiungi] = useState<{ id: string; utente: string } | null>(null)

  if (!dati && !errore) return <div className="p-6"><LoadingSpinner /></div>
  if (!dati) return <Avvisi errore={errore} messaggio="" />
  const gestisce = !solaLettura && !clienteId && dati.puoGestire
  const elenco = (dati.deleghe as any[]).filter(d => !filtro || d.cliente_id === filtro)
  const rev = revoca ?? { id: '', motivo: '' }
  const agg = aggiungi ?? { id: '', utente: '' }

  return (
    <div className="space-y-3">
      <Avvisi errore={errore} messaggio={messaggio} />
      {!clienteId && (
        <p className="text-sm text-gray-600">
          Per ogni cliente e piattaforma: il mandato, chi ha l&apos;accesso, le persone autorizzate e la durata. Qui non si scrivono password né codici:
          le credenziali stanno nel password manager. Nessuno usa SPID, password o OTP di un altro; ogni delega attiva si riesamina ogni sei mesi.
          Chi viene disattivato, o ha l&apos;accesso scaduto, esce da solo dagli elenchi delle persone autorizzate.
        </p>
      )}
      {!clienteId && (
        <div className="flex flex-wrap items-center gap-2">
          {dati.clienti?.length > 0 && (
            <select className="px-2 py-1.5 border border-gray-300 rounded text-sm" value={filtro} onChange={e => setFiltro(e.target.value)}>
              <option value="">Tutti i clienti</option>
              {Array.from(new Map((dati.deleghe as any[]).map(d => [d.cliente_id, d.scadenze_bandi_clienti?.denominazione || ''])).entries())
                .sort((a, b) => a[1].localeCompare(b[1])).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          )}
          {gestisce && !nuova && (
            <button type="button" onClick={() => setNuova({ cliente_id: '', piattaforma: '', ambito: '', tipo: 'delega_piattaforma', titolare_id: '', titolare_esterno: '', mandato_data: '', valida_dal: oggi(), valida_al: '', nota: '', persone: [] as string[] })}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Registra una delega</button>
          )}
        </div>
      )}

      {nuova && (
        <div className="bg-white border border-blue-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="text-xs text-gray-600 md:col-span-2">Cliente
            <select className={campo} value={nuova.cliente_id} onChange={e => setNuova({ ...nuova, cliente_id: e.target.value })}>
              <option value="">Scegli…</option>
              {dati.clienti.map((c: any) => <option key={c.id} value={c.id}>{c.denominazione}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Tipo
            <select className={campo} value={nuova.tipo} onChange={e => setNuova({ ...nuova, tipo: e.target.value })}>
              {Object.entries(TIPI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Piattaforma o ente<input className={campo} placeholder="es. Invitalia, Bandi online Lombardia" value={nuova.piattaforma} onChange={e => setNuova({ ...nuova, piattaforma: e.target.value })} /></label>
          <label className="text-xs text-gray-600 md:col-span-2">Ambito<input className={campo} placeholder="es. presentazione e rendicontazione delle domande" value={nuova.ambito} onChange={e => setNuova({ ...nuova, ambito: e.target.value })} /></label>
          <label className="text-xs text-gray-600">Titolare dell&apos;accesso
            <select className={campo} value={nuova.titolare_id} onChange={e => setNuova({ ...nuova, titolare_id: e.target.value })}>
              <option value="">Esterno o intestato alla società</option>
              {dati.utentiAttivi.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
          {!nuova.titolare_id && <label className="text-xs text-gray-600">Titolare (se esterno)<input className={campo} value={nuova.titolare_esterno} onChange={e => setNuova({ ...nuova, titolare_esterno: e.target.value })} /></label>}
          <label className="text-xs text-gray-600">Data del mandato<input type="date" className={campo} value={nuova.mandato_data} onChange={e => setNuova({ ...nuova, mandato_data: e.target.value })} /></label>
          <label className="text-xs text-gray-600">Valida dal<input type="date" className={campo} value={nuova.valida_dal} onChange={e => setNuova({ ...nuova, valida_dal: e.target.value })} /></label>
          <label className="text-xs text-gray-600">Valida fino al (vuoto se senza scadenza)<input type="date" className={campo} value={nuova.valida_al} onChange={e => setNuova({ ...nuova, valida_al: e.target.value })} /></label>
          <div className="text-xs text-gray-600 md:col-span-3">Persone autorizzate a operare
            <div className="flex flex-wrap gap-3 mt-1">
              {dati.utentiAttivi.map((u: any) => (
                <label key={u.id} className="inline-flex items-center gap-1 text-sm text-gray-800">
                  <input type="checkbox" checked={nuova.persone.includes(u.id)}
                    onChange={e => setNuova({ ...nuova, persone: e.target.checked ? [...nuova.persone, u.id] : nuova.persone.filter((x: string) => x !== u.id) })} />
                  {u.nome}
                </label>
              ))}
            </div>
          </div>
          <label className="text-xs text-gray-600 md:col-span-2">Nota<input className={campo} value={nuova.nota} onChange={e => setNuova({ ...nuova, nota: e.target.value })} /></label>
          <label className="text-xs text-gray-600">Mandato o delega (PDF)<input type="file" className="text-sm mt-1" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
          <div className="flex gap-2 md:col-span-3">
            <button type="button" disabled={inCorso || !nuova.cliente_id || !nuova.piattaforma.trim()}
              onClick={async () => {
                const f = new FormData()
                Object.entries(nuova).forEach(([k, v]) => f.append(k, k === 'persone' ? JSON.stringify(v) : String(v ?? '')))
                if (file) f.append('file', file)
                const ok = await invia('/api/231/deleghe', 'POST', f, 'Delega registrata')
                if (ok) { setNuova(null); setFile(null) }
              }}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-40">{inCorso ? 'Salvataggio…' : 'Registra'}</button>
            <button type="button" onClick={() => { setNuova(null); setFile(null) }} className="px-3 py-1.5 text-sm border rounded">Annulla</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-1.5 text-left">Cliente e piattaforma</th>
              <th className="px-3 py-1.5 text-left">Titolare dell&apos;accesso</th>
              <th className="px-3 py-1.5 text-left">Persone autorizzate</th>
              <th className="px-3 py-1.5 text-left">Validità</th>
              <th className="px-3 py-1.5 text-left">Stato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {elenco.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-gray-500">Nessuna delega registrata.</td></tr>}
            {elenco.map((d: any) => {
              const s = stato(d)
              const attive = (d.scadenze_bandi_deleghe_persone || []).filter((p: any) => !p.rimossa_il)
              const modificabile = gestisce && !d.revocata_il
              return (
                <tr key={d.id} className="align-top">
                  <td className="px-3 py-1.5 text-xs">
                    {!clienteId && <div className="text-gray-900 font-medium">{d.scadenze_bandi_clienti?.denominazione}</div>}
                    <div className="text-gray-800">{d.piattaforma} · {TIPI[d.tipo]}</div>
                    {d.ambito && <div className="text-gray-500">{d.ambito}</div>}
                    {d.nota && <div className="text-gray-500 italic">{d.nota}</div>}
                    {(d.allegati || []).map((a: any) => a.url && (
                      <a key={a.id || a.nome} href={a.url} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-0.5 mr-2"><Paperclip className="w-3 h-3" />{a.nome}</a>
                    ))}
                  </td>
                  <td className="px-3 py-1.5 text-xs">{d.titolare_id ? dati.nomi[d.titolare_id] : d.titolare_esterno || <span className="text-gray-400">intestato alla società</span>}</td>
                  <td className="px-3 py-1.5 text-xs">
                    {attive.length === 0 && <span className="text-gray-400">nessuna</span>}
                    {attive.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-1">
                        <span>{dati.nomi[p.utente_id] || 'utente eliminato'}</span>
                        {modificabile && (
                          <button type="button" title="Togli l'autorizzazione" className="text-red-600 hover:underline"
                            onClick={() => { if (confirm('Togliere l\'autorizzazione a questa persona?')) invia(`/api/231/deleghe/${d.id}`, 'PATCH', { azione: 'rimuovi_persona', riga_id: p.id }, 'Autorizzazione tolta') }}>togli</button>
                        )}
                      </div>
                    ))}
                    {modificabile && (aggiungi?.id === d.id
                      ? <div className="flex gap-1 mt-1">
                          <select className="px-1 py-0.5 border rounded text-xs" value={agg.utente} onChange={e => setAggiungi({ ...agg, utente: e.target.value })}>
                            <option value="">Scegli…</option>
                            {dati.utentiAttivi.filter((u: any) => !attive.some((p: any) => p.utente_id === u.id)).map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                          </select>
                          <button type="button" disabled={!agg.utente || inCorso} className="px-2 py-0.5 bg-gray-800 text-white rounded disabled:opacity-40"
                            onClick={async () => { const ok = await invia(`/api/231/deleghe/${d.id}`, 'PATCH', { azione: 'aggiungi_persona', utente_id: agg.utente }, 'Persona autorizzata'); if (ok) setAggiungi(null) }}>Aggiungi</button>
                        </div>
                      : <button type="button" className="text-blue-600 hover:underline mt-1" onClick={() => setAggiungi({ id: d.id, utente: '' })}>+ autorizza</button>)}
                    {d.revocata_il && (d.scadenze_bandi_deleghe_persone || []).length > 0 && <div className="text-gray-400">elenco chiuso con la revoca</div>}
                  </td>
                  <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                    {d.valida_dal ? `dal ${dataIt(d.valida_dal)}` : ''}{d.valida_al ? ` al ${dataIt(d.valida_al)}` : d.valida_dal ? ', senza scadenza' : ''}
                    {d.mandato_data && <div className="text-gray-500">mandato del {dataIt(d.mandato_data)}</div>}
                  </td>
                  <td className="px-3 py-1.5 text-xs">
                    <span className={`px-1.5 py-0.5 rounded ${s.classe}`}>{s.testo}</span>
                    {d.revoca_motivo && <div className="text-gray-500 mt-0.5">{d.revoca_motivo}</div>}
                    {d.riesaminata_il && <div className="text-gray-500 mt-0.5">riesame del {dataIt(d.riesaminata_il)}{d.riesaminata_da ? `, ${dati.nomi[d.riesaminata_da] || ''}` : ''}</div>}
                    {modificabile && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        <button type="button" disabled={inCorso} className="px-2 py-0.5 border border-gray-400 rounded"
                          onClick={() => invia(`/api/231/deleghe/${d.id}`, 'PATCH', { azione: 'riesame' }, 'Riesame registrato')}>Riesaminata oggi</button>
                        {revoca?.id === d.id
                          ? <span className="flex gap-1">
                              <input className="px-1 py-0.5 border rounded text-xs" placeholder="Motivo" value={rev.motivo} onChange={e => setRevoca({ ...rev, motivo: e.target.value })} />
                              <button type="button" disabled={!rev.motivo.trim() || inCorso} className="px-2 py-0.5 bg-red-600 text-white rounded disabled:opacity-40"
                                onClick={async () => { const ok = await invia(`/api/231/deleghe/${d.id}`, 'PATCH', { azione: 'revoca', motivo: rev.motivo }, 'Delega revocata'); if (ok) setRevoca(null) }}>Revoca</button>
                            </span>
                          : <button type="button" className="px-2 py-0.5 border border-red-300 text-red-700 rounded" onClick={() => setRevoca({ id: d.id, motivo: '' })}>Revoca o cessazione</button>}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
