'use client'

import { useState } from 'react'
import { Plus, Paperclip, Check } from 'lucide-react'
import { LoadingSpinner } from '../shared'
import { Avvisi, campo, dataIt, oggi, useRegistro } from './comune'

/**
 * Segnalatori e compensi (PR.02 §4.3). Il segnalatore ha una qualifica (M.01) e
 * un accordo con clausola 231 (M.03) approvato dall'amministratrice unica; ogni compenso passa da
 * attestazione della prestazione, fattura, autorizzazione dell'amministratrice unica e pagamento.
 */
const euro = (n: any) => (n === null || n === undefined ? '' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }))

function statoQualifica(q: any): { testo: string; ok: boolean } {
  if (!q) return { testo: 'Qualifica mancante', ok: false }
  if (q.scade_il && q.scade_il < oggi()) return { testo: `Qualifica scaduta il ${dataIt(q.scade_il)}`, ok: false }
  if (q.esito === 'nessuna_anomalia') return { testo: `Qualificato il ${dataIt(q.compilata_il)}, nessuna anomalia`, ok: true }
  if (q.decisione === 'procedere' || q.decisione === 'procedere_cautele') return { testo: `Qualificato con anomalia, l'amministratrice unica ha deciso di procedere`, ok: true }
  if (q.decisione === 'non_procedere') return { testo: 'Qualifica: l\'amministratrice unica ha deciso di non procedere', ok: false }
  return { testo: 'Qualifica con anomalia in attesa dell\'amministratrice unica', ok: false }
}

const vuotoSegnalatore = () => ({ nome: '', forma: 'persona', codice_fiscale: '', partita_iva: '', email: '', cliente_id: '', qualifica_id: '', accordo_data: '', accordo_scade_il: '', clausola_231: false, compenso_previsto: '', nota: '' })

export default function Segnalatori({ solaLettura = false }: { solaLettura?: boolean }) {
  const { dati, errore, messaggio, inCorso, invia } = useRegistro<any>('/api/231/segnalatori')
  const [nuovo, setNuovo] = useState<any>(null)
  const [modifica, setModifica] = useState<any>(null)
  const [file, setFile] = useState<File | null>(null)
  const [segnalazione, setSegnalazione] = useState<any>(null)
  const [passo, setPasso] = useState<any>(null) // { id, azione, ...campi }

  if (!dati && !errore) return <div className="p-6"><LoadingSpinner /></div>
  if (!dati) return <Avvisi errore={errore} messaggio="" />
  const gestisce = !solaLettura && dati.puoGestire
  const adminNonAu = dati.vedeTutto && !dati.solaLettura && dati.io !== dati.auId
  const puoAutorizzare = (c: any) => !solaLettura && c.attestata_da && dati.io !== c.attestata_da && (c.attestata_da === dati.auId ? adminNonAu : dati.puoDecidere)

  const formSegnalatore = (v: any, set: (x: any) => void, nuovoRecord: boolean) => (
    <div className="bg-white border border-blue-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-2">
      {nuovoRecord && <>
        <label className="text-xs text-gray-600">Nome o denominazione<input className={campo} value={v.nome} onChange={e => set({ ...v, nome: e.target.value })} /></label>
        <label className="text-xs text-gray-600">Forma
          <select className={campo} value={v.forma} onChange={e => set({ ...v, forma: e.target.value })}>
            <option value="persona">Persona o professionista</option><option value="societa">Società</option>
          </select>
        </label>
        <label className="text-xs text-gray-600">Email<input className={campo} value={v.email} onChange={e => set({ ...v, email: e.target.value })} /></label>
        <label className="text-xs text-gray-600">Codice fiscale<input className={campo} value={v.codice_fiscale} onChange={e => set({ ...v, codice_fiscale: e.target.value })} /></label>
        <label className="text-xs text-gray-600">Partita IVA<input className={campo} value={v.partita_iva} onChange={e => set({ ...v, partita_iva: e.target.value })} /></label>
        <label className="text-xs text-gray-600">Anagrafica nel gestionale (se c&apos;è)
          <select className={campo} value={v.cliente_id} onChange={e => set({ ...v, cliente_id: e.target.value })}>
            <option value="">Nessuna</option>
            {dati.clienti.map((c: any) => <option key={c.id} value={c.id}>{c.denominazione}</option>)}
          </select>
        </label>
      </>}
      <label className="text-xs text-gray-600 md:col-span-2">Scheda di qualifica (M.01, scheda Qualifica delle controparti)
        <select className={campo} value={v.qualifica_id} onChange={e => set({ ...v, qualifica_id: e.target.value })}>
          <option value="">Non ancora compilata</option>
          {dati.qualifiche.map((q: any) => <option key={q.id} value={q.id}>{q.denominazione} · {dataIt(q.compilata_il)}{q.esito === 'anomalia' ? ' · anomalia' : ''}</option>)}
        </select>
      </label>
      <label className="text-xs text-gray-600">Compenso previsto<input className={campo} placeholder="es. 10% dell'onorario incassato" value={v.compenso_previsto} onChange={e => set({ ...v, compenso_previsto: e.target.value })} /></label>
      <label className="text-xs text-gray-600">Data dell&apos;accordo<input type="date" className={campo} value={v.accordo_data} onChange={e => set({ ...v, accordo_data: e.target.value })} /></label>
      <label className="text-xs text-gray-600">Scadenza dell&apos;accordo<input type="date" className={campo} value={v.accordo_scade_il} onChange={e => set({ ...v, accordo_scade_il: e.target.value })} /></label>
      <label className="text-xs text-gray-600">Accordo firmato (PDF)<input type="file" className="text-sm mt-1" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
      <label className="text-xs text-gray-800 md:col-span-3 inline-flex items-center gap-1">
        <input type="checkbox" checked={v.clausola_231} onChange={e => set({ ...v, clausola_231: e.target.checked })} />
        L&apos;accordo contiene la clausola 231 per i segnalatori (M.03): niente utilità a chi valuta le pratiche, niente uso di informazioni riservate
      </label>
      <label className="text-xs text-gray-600 md:col-span-3">Nota<input className={campo} value={v.nota} onChange={e => set({ ...v, nota: e.target.value })} /></label>
    </div>
  )

  const salvaSegnalatore = async (v: any, url: string, metodo: string, extra: Record<string, string>, ok: string) => {
    const f = new FormData()
    Object.entries({ ...v, ...extra }).forEach(([k, x]) => f.append(k, String(x ?? '')))
    if (file) f.append('file', file)
    return invia(url, metodo, f, ok)
  }

  const inviaPasso = async (c: any, azione: string, campi: Record<string, string>, f?: File | null, ok = 'Registrato') => {
    const fd = new FormData()
    fd.append('azione', azione)
    Object.entries(campi).forEach(([k, v]) => fd.append(k, v))
    if (f) fd.append('file', f)
    const r = await invia(`/api/231/compensi/${c.id}`, 'PATCH', fd, ok)
    if (r) { setPasso(null); setFile(null) }
  }

  return (
    <div className="space-y-3">
      <Avvisi errore={errore} messaggio={messaggio} />
      <p className="text-sm text-gray-600">
        Chi presenta clienti in cambio di un compenso: prima la qualifica e l&apos;accordo scritto con la clausola 231, approvato dall&apos;amministratrice unica.
        Ogni compenso si paga solo dopo che qualcuno ha attestato la prestazione e l&apos;amministratrice unica ha autorizzato il pagamento (se ha attestato l&apos;amministratrice unica,
        autorizza un altro amministratore). Il pagamento avviene con bonifico tracciabile e si registra qui.
      </p>
      {gestisce && !nuovo && (
        <button type="button" onClick={() => { setNuovo(vuotoSegnalatore()); setFile(null) }}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Nuovo segnalatore</button>
      )}
      {nuovo && (
        <div className="space-y-2">
          {formSegnalatore(nuovo, setNuovo, true)}
          <div className="flex gap-2">
            <button type="button" disabled={inCorso || !nuovo.nome.trim()}
              onClick={async () => { const ok = await salvaSegnalatore(nuovo, '/api/231/segnalatori', 'POST', {}, 'Segnalatore registrato'); if (ok) { setNuovo(null); setFile(null) } }}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-40">{inCorso ? 'Salvataggio…' : 'Registra'}</button>
            <button type="button" onClick={() => setNuovo(null)} className="px-3 py-1.5 text-sm border rounded">Annulla</button>
          </div>
        </div>
      )}

      {(dati.segnalatori as any[]).length === 0 && <div className="bg-white border rounded-lg p-4 text-sm text-gray-500">Nessun segnalatore registrato.</div>}
      {(dati.segnalatori as any[]).map(s => {
        const q = statoQualifica(s.scadenze_bandi_qualifiche)
        const approvato = !!s.accordo_approvato_da
        const scaduto = s.accordo_scade_il && s.accordo_scade_il < oggi()
        const pronto = s.accordo_data && s.clausola_231 && (s.accordo_allegati || []).length > 0
        const compensi = (dati.compensi as any[]).filter(c => c.segnalatore_id === s.id)
        const attivo = !s.cessato_il
        return (
          <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex flex-wrap items-start gap-2">
              <div className="flex-1 min-w-[16rem]">
                <div className="font-medium text-gray-900">{s.nome}{s.cessato_il && <span className="ml-2 text-xs text-gray-500">rapporto cessato il {dataIt(s.cessato_il)}</span>}</div>
                <div className="text-xs text-gray-500">{[s.partita_iva && `P. IVA ${s.partita_iva}`, s.codice_fiscale && `CF ${s.codice_fiscale}`, s.email].filter(Boolean).join(' · ')}</div>
                <div className={`text-xs ${q.ok ? 'text-green-700' : 'text-amber-700'}`}>{q.testo}</div>
                <div className="text-xs text-gray-700">
                  Accordo{s.accordo_data ? ` del ${dataIt(s.accordo_data)}` : ' non registrato'}{s.accordo_scade_il ? `, scade il ${dataIt(s.accordo_scade_il)}` : ''}
                  {s.compenso_previsto ? ` · compenso: ${s.compenso_previsto}` : ''}{s.clausola_231 ? ' · clausola 231' : ' · senza clausola 231'}
                  {(s.accordo_allegati || []).map((a: any) => a.url && <a key={a.id || a.nome} href={a.url} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-0.5 ml-2"><Paperclip className="w-3 h-3" />{a.nome}</a>)}
                </div>
                <div className={`text-xs ${approvato && !scaduto ? 'text-green-700' : 'text-amber-700'}`}>
                  {approvato ? `Accordo approvato dall'amministratrice unica (${dati.nomi[s.accordo_approvato_da] || ''}, ${dataIt(s.accordo_approvato_il)})${scaduto ? ', ma scaduto' : ''}` : 'Accordo da approvare'}
                </div>
                {s.nota && <div className="text-xs text-gray-500 italic">{s.nota}</div>}
              </div>
              {!solaLettura && attivo && (
                <div className="flex flex-wrap gap-1">
                  {!approvato && dati.puoDecidere && (
                    <button type="button" disabled={inCorso || !pronto} title={pronto ? '' : 'Servono accordo firmato, data e clausola 231'}
                      onClick={() => { if (confirm('Approvare l\'accordo con il segnalatore?')) { const f = new FormData(); f.append('azione', 'approva'); invia(`/api/231/segnalatori/${s.id}`, 'PATCH', f, 'Accordo approvato') } }}
                      className="px-2 py-1 text-xs bg-gray-800 text-white rounded disabled:opacity-40 inline-flex items-center gap-1"><Check className="w-3 h-3" /> Approva l&apos;accordo (amministratrice unica)</button>
                  )}
                  {gestisce && <button type="button" className="px-2 py-1 text-xs border rounded" onClick={() => { setFile(null); setModifica({ id: s.id, qualifica_id: s.qualifica_id || '', accordo_data: s.accordo_data || '', accordo_scade_il: s.accordo_scade_il || '', clausola_231: s.clausola_231, compenso_previsto: s.compenso_previsto || '', nota: s.nota || '' }) }}>Qualifica e accordo</button>}
                  {gestisce && <button type="button" className="px-2 py-1 text-xs border rounded" onClick={() => setSegnalazione({ segnalatore_id: s.id, cliente_id: '', progetto_id: '', data_segnalazione: oggi(), descrizione: '', importo: '', base_calcolo: '' })}>+ Segnalazione</button>}
                  {gestisce && <button type="button" className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded" onClick={() => { if (confirm('Registrare la cessazione del rapporto con il segnalatore?')) { const f = new FormData(); f.append('azione', 'cessa'); invia(`/api/231/segnalatori/${s.id}`, 'PATCH', f, 'Cessazione registrata') } }}>Cessa</button>}
                </div>
              )}
            </div>

            {modifica?.id === s.id && (
              <div className="space-y-2">
                {approvato && <p className="text-xs text-amber-700">Se cambi data, scadenza, compenso, clausola o documento dell&apos;accordo, l&apos;amministratrice unica dovrà approvarlo di nuovo.</p>}
                {formSegnalatore(modifica, setModifica, false)}
                <div className="flex gap-2">
                  <button type="button" disabled={inCorso}
                    onClick={async () => { const { id, ...v } = modifica; const ok = await salvaSegnalatore(v, `/api/231/segnalatori/${id}`, 'PATCH', { azione: 'aggiorna' }, 'Dati aggiornati'); if (ok) { setModifica(null); setFile(null) } }}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-40">Salva</button>
                  <button type="button" onClick={() => setModifica(null)} className="px-3 py-1.5 text-sm border rounded">Annulla</button>
                </div>
              </div>
            )}

            {segnalazione?.segnalatore_id === s.id && (
              <div className="bg-slate-50 border rounded p-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="text-xs text-gray-600">Cliente segnalato
                  <select className={campo} value={segnalazione.cliente_id} onChange={e => setSegnalazione({ ...segnalazione, cliente_id: e.target.value, progetto_id: '' })}>
                    <option value="">Scegli…</option>
                    {dati.clienti.map((c: any) => <option key={c.id} value={c.id}>{c.denominazione}</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-600">Pratica (se c&apos;è)
                  <select className={campo} value={segnalazione.progetto_id} onChange={e => setSegnalazione({ ...segnalazione, progetto_id: e.target.value })}>
                    <option value="">Nessuna</option>
                    {dati.progetti.filter((p: any) => !segnalazione.cliente_id || p.cliente_id === segnalazione.cliente_id).map((p: any) => <option key={p.id} value={p.id}>{p.titolo_progetto}</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-600">Data<input type="date" className={campo} value={segnalazione.data_segnalazione} onChange={e => setSegnalazione({ ...segnalazione, data_segnalazione: e.target.value })} /></label>
                <label className="text-xs text-gray-600 md:col-span-3">Che cosa ha fatto il segnalatore<input className={campo} value={segnalazione.descrizione} onChange={e => setSegnalazione({ ...segnalazione, descrizione: e.target.value })} /></label>
                <label className="text-xs text-gray-600">Compenso stimato (euro)<input className={campo} inputMode="decimal" value={segnalazione.importo} onChange={e => setSegnalazione({ ...segnalazione, importo: e.target.value.replace(',', '.') })} /></label>
                <label className="text-xs text-gray-600 md:col-span-2">Base di calcolo<input className={campo} value={segnalazione.base_calcolo} onChange={e => setSegnalazione({ ...segnalazione, base_calcolo: e.target.value })} /></label>
                <div className="flex gap-2 md:col-span-3">
                  <button type="button" disabled={inCorso || !segnalazione.descrizione.trim()}
                    onClick={async () => { const ok = await invia('/api/231/compensi', 'POST', segnalazione, 'Segnalazione registrata'); if (ok) setSegnalazione(null) }}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-40">Registra</button>
                  <button type="button" onClick={() => setSegnalazione(null)} className="px-3 py-1.5 text-sm border rounded">Annulla</button>
                </div>
              </div>
            )}

            {compensi.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="text-gray-500 uppercase"><tr>
                    <th className="py-1 pr-2 text-left">Segnalazione</th><th className="py-1 pr-2 text-left">Prestazione</th>
                    <th className="py-1 pr-2 text-left">Fattura</th><th className="py-1 pr-2 text-left">Autorizzazione</th><th className="py-1 text-left">Pagamento</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {compensi.map(c => {
                      const p = passo?.id === c.id ? passo : null
                      const bloccato = !!c.autorizzato_da
                      return (
                        <tr key={c.id} className="align-top">
                          <td className="py-1 pr-2">
                            <div>{dataIt(c.data_segnalazione)} · {c.scadenze_bandi_clienti?.denominazione || 'cliente non indicato'}</div>
                            {c.scadenze_bandi_progetti?.titolo_progetto && <div className="text-gray-500">{c.scadenze_bandi_progetti.titolo_progetto}</div>}
                            <div className="text-gray-700">{c.descrizione}</div>
                            {c.base_calcolo && <div className="text-gray-500">{c.base_calcolo}</div>}
                          </td>
                          <td className="py-1 pr-2">
                            {c.attestata_da
                              ? <div><div className="text-green-700">Attestata da {dati.nomi[c.attestata_da] || ''}, {dataIt(c.attestata_il)}</div><div className="text-gray-600">{c.attestazione}</div>
                                  {(c.attestazione_allegati || []).map((a: any) => a.url && <a key={a.id || a.nome} href={a.url} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-0.5 mr-2"><Paperclip className="w-3 h-3" />{a.nome}</a>)}</div>
                              : gestisce && p?.azione === 'attesta'
                                ? <div className="space-y-1">
                                    <textarea className="w-full px-1 py-0.5 border rounded" rows={2} placeholder="Come risulta resa (email di presentazione, incontro, contratto firmato…)" value={p.attestazione} onChange={e => setPasso({ ...p, attestazione: e.target.value })} />
                                    <input type="file" className="text-xs" onChange={e => setFile(e.target.files?.[0] || null)} />
                                    <button type="button" disabled={inCorso || !p.attestazione.trim()} className="px-2 py-0.5 bg-gray-800 text-white rounded disabled:opacity-40"
                                      onClick={() => inviaPasso(c, 'attesta', { attestazione: p.attestazione }, file, 'Prestazione attestata')}>Attesta</button>
                                  </div>
                                : gestisce ? <button type="button" className="px-2 py-0.5 border rounded" onClick={() => { setFile(null); setPasso({ id: c.id, azione: 'attesta', attestazione: '' }) }}>Attesta la prestazione</button>
                                : <span className="text-amber-700">da attestare</span>}
                          </td>
                          <td className="py-1 pr-2 whitespace-nowrap">
                            {c.fattura_numero && <div>n. {c.fattura_numero}{c.fattura_data ? ` del ${dataIt(c.fattura_data)}` : ''}</div>}
                            <div>{euro(c.importo)}</div>
                            {gestisce && !bloccato && (p?.azione === 'fattura'
                              ? <div className="space-y-1">
                                  <input className="px-1 py-0.5 border rounded w-24" placeholder="Importo" inputMode="decimal" value={p.importo} onChange={e => setPasso({ ...p, importo: e.target.value })} />
                                  <input className="px-1 py-0.5 border rounded w-24" placeholder="Numero" value={p.fattura_numero} onChange={e => setPasso({ ...p, fattura_numero: e.target.value })} />
                                  <input type="date" className="px-1 py-0.5 border rounded" value={p.fattura_data} onChange={e => setPasso({ ...p, fattura_data: e.target.value })} />
                                  <button type="button" disabled={inCorso || !p.importo || !p.fattura_numero.trim()} className="px-2 py-0.5 bg-gray-800 text-white rounded disabled:opacity-40"
                                    onClick={() => inviaPasso(c, 'fattura', { importo: p.importo, fattura_numero: p.fattura_numero, fattura_data: p.fattura_data }, null, 'Fattura registrata')}>Salva</button>
                                </div>
                              : <button type="button" className="text-blue-600 hover:underline" onClick={() => setPasso({ id: c.id, azione: 'fattura', importo: c.importo ?? '', fattura_numero: c.fattura_numero || '', fattura_data: c.fattura_data || oggi() })}>{c.fattura_numero ? 'modifica' : 'registra la fattura'}</button>)}
                          </td>
                          <td className="py-1 pr-2">
                            {c.autorizzato_da
                              ? <span className="text-green-700">Autorizzato da {dati.nomi[c.autorizzato_da] || ''}, {dataIt(c.autorizzato_il)}</span>
                              : puoAutorizzare(c)
                                ? <button type="button" disabled={inCorso || !c.fattura_numero} title={c.fattura_numero ? '' : 'Manca la fattura'} className="px-2 py-0.5 bg-gray-800 text-white rounded disabled:opacity-40"
                                    onClick={() => { if (confirm(`Autorizzare il pagamento di ${euro(c.importo)} a ${s.nome}?`)) inviaPasso(c, 'autorizza', {}, null, 'Pagamento autorizzato') }}>Autorizza il pagamento</button>
                                : <span className="text-amber-700">{c.attestata_da ? 'in attesa dell\'amministratrice unica' : 'dopo l\'attestazione'}</span>}
                          </td>
                          <td className="py-1 whitespace-nowrap">
                            {c.pagato_il
                              ? <div className="text-green-700">Pagato il {dataIt(c.pagato_il)}{c.pagamento_riferimento ? <div className="text-gray-500">{c.pagamento_riferimento}</div> : null}</div>
                              : c.autorizzato_da && gestisce
                                ? p?.azione === 'pagato'
                                  ? <div className="space-y-1">
                                      <input type="date" className="px-1 py-0.5 border rounded" value={p.pagato_il} onChange={e => setPasso({ ...p, pagato_il: e.target.value })} />
                                      <input className="px-1 py-0.5 border rounded w-32" placeholder="Riferimento (CRO)" value={p.pagamento_riferimento} onChange={e => setPasso({ ...p, pagamento_riferimento: e.target.value })} />
                                      <button type="button" disabled={inCorso || !p.pagato_il} className="px-2 py-0.5 bg-gray-800 text-white rounded disabled:opacity-40"
                                        onClick={() => inviaPasso(c, 'pagato', { pagato_il: p.pagato_il, pagamento_riferimento: p.pagamento_riferimento }, null, 'Pagamento registrato')}>Registra</button>
                                    </div>
                                  : <button type="button" className="px-2 py-0.5 border rounded" onClick={() => setPasso({ id: c.id, azione: 'pagato', pagato_il: oggi(), pagamento_riferimento: '' })}>Registra il pagamento</button>
                                : <span className="text-gray-400">non ancora</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
