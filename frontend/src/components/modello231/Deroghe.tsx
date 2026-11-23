'use client'

import { useState } from 'react'
import { Plus, Paperclip } from 'lucide-react'
import { LoadingSpinner } from '../shared'
import { Avvisi, campo, dataIt, oggi, useRegistro } from './comune'

/**
 * Registro delle deroghe (PR.01 §4.1, PR.02 §4.3): ogni scostamento dalle regole
 * o dalle condizioni standard, motivato e deciso per iscritto dall'amministratrice unica. In fondo
 * le deroghe già registrate dal gestionale durante il lavoro.
 */
const AMBITI: Record<string, string> = {
  contratto: 'Condizioni contrattuali (onorari, success fee, rendicontazione inclusa o esclusa)',
  pagamento: 'Pagamenti e compensi', procedura: 'Procedura del Modello', altro: 'Altro'
}

export default function Deroghe({ solaLettura = false }: { solaLettura?: boolean }) {
  const { dati, errore, messaggio, inCorso, invia } = useRegistro<any>('/api/231/deroghe')
  const [nuova, setNuova] = useState<any>(null)
  const [file, setFile] = useState<File | null>(null)
  const [decidi, setDecidi] = useState<{ id: string; nota: string } | null>(null)

  if (!dati && !errore) return <div className="p-6"><LoadingSpinner /></div>
  if (!dati) return <Avvisi errore={errore} messaggio="" />
  const adminNonAu = dati.vedeTutto && !dati.solaLettura && dati.io !== dati.auId
  const puoDecidere = (d: any) => !solaLettura && !d.decisione && dati.io !== d.richiesta_da && (d.richiesta_da === dati.auId ? adminNonAu : dati.puoDecidere)
  const dec = decidi ?? { id: '', nota: '' }

  return (
    <div className="space-y-3">
      <Avvisi errore={errore} messaggio={messaggio} />
      <p className="text-sm text-gray-600">
        Quando si fa diversamente da quanto prevedono il Modello o le condizioni standard, la deroga si chiede qui con la sua motivazione e la
        decide per iscritto l&apos;amministratrice unica{dati.auId ? ` (${dati.nomi[dati.auId] || ''})` : ''}; se la chiede l&apos;amministratrice unica, decide un altro amministratore.
        Una deroga decisa non si modifica più.
      </p>
      {!solaLettura && !nuova && (
        <button type="button" onClick={() => { setFile(null); setNuova({ data: oggi(), ambito: 'contratto', oggetto: '', regola: '', motivazione: '', cliente_id: '', progetto_id: '' }) }}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Chiedi una deroga</button>
      )}
      {nuova && (
        <div className="bg-white border border-blue-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="text-xs text-gray-600">Data<input type="date" className={campo} value={nuova.data} onChange={e => setNuova({ ...nuova, data: e.target.value })} /></label>
          <label className="text-xs text-gray-600 md:col-span-2">Ambito
            <select className={campo} value={nuova.ambito} onChange={e => setNuova({ ...nuova, ambito: e.target.value })}>
              {Object.entries(AMBITI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600 md:col-span-3">Oggetto della deroga<input className={campo} placeholder="es. success fee ridotta al 3% per il cliente X" value={nuova.oggetto} onChange={e => setNuova({ ...nuova, oggetto: e.target.value })} /></label>
          <label className="text-xs text-gray-600 md:col-span-3">Che cosa prevede la regola<input className={campo} placeholder="es. listino: success fee 5%" value={nuova.regola} onChange={e => setNuova({ ...nuova, regola: e.target.value })} /></label>
          <label className="text-xs text-gray-600 md:col-span-3">Motivazione<textarea className={campo} rows={2} value={nuova.motivazione} onChange={e => setNuova({ ...nuova, motivazione: e.target.value })} /></label>
          <label className="text-xs text-gray-600">Cliente
            <select className={campo} value={nuova.cliente_id} onChange={e => setNuova({ ...nuova, cliente_id: e.target.value, progetto_id: '' })}>
              <option value="">Nessuno</option>
              {dati.clienti.map((c: any) => <option key={c.id} value={c.id}>{c.denominazione}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Pratica
            <select className={campo} value={nuova.progetto_id} onChange={e => setNuova({ ...nuova, progetto_id: e.target.value })}>
              <option value="">Nessuna</option>
              {dati.progetti.filter((p: any) => !nuova.cliente_id || p.cliente_id === nuova.cliente_id).map((p: any) => <option key={p.id} value={p.id}>{p.titolo_progetto}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Documento (facoltativo)<input type="file" className="text-sm mt-1" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
          <div className="flex gap-2 md:col-span-3">
            <button type="button" disabled={inCorso || !nuova.oggetto.trim() || !nuova.motivazione.trim()}
              onClick={async () => {
                const f = new FormData()
                Object.entries(nuova).forEach(([k, v]) => f.append(k, String(v ?? '')))
                if (file) f.append('file', file)
                const ok = await invia('/api/231/deroghe', 'POST', f, 'Deroga registrata: ora la decide l\'amministratrice unica')
                if (ok) { setNuova(null); setFile(null) }
              }}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-40">Invia la richiesta</button>
            <button type="button" onClick={() => setNuova(null)} className="px-3 py-1.5 text-sm border rounded">Annulla</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-1.5 text-left">Data</th>
              <th className="px-3 py-1.5 text-left">Deroga</th>
              <th className="px-3 py-1.5 text-left">Motivazione</th>
              <th className="px-3 py-1.5 text-left">Decisione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dati.deroghe.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-gray-500">Nessuna deroga chiesta.</td></tr>}
            {dati.deroghe.map((d: any) => (
              <tr key={d.id} className="align-top">
                <td className="px-3 py-1.5 text-xs whitespace-nowrap">{dataIt(d.data)}</td>
                <td className="px-3 py-1.5 text-xs">
                  <div className="text-gray-900">{d.oggetto}</div>
                  <div className="text-gray-500">{AMBITI[d.ambito]?.split(' (')[0]}{d.scadenze_bandi_clienti?.denominazione ? ` · ${d.scadenze_bandi_clienti.denominazione}` : ''}{d.scadenze_bandi_progetti?.titolo_progetto ? ` · ${d.scadenze_bandi_progetti.titolo_progetto}` : ''}</div>
                  {d.regola && <div className="text-gray-500">Regola: {d.regola}</div>}
                  <div className="text-gray-500">Chiesta da {dati.nomi[d.richiesta_da] || ''}</div>
                  {(d.allegati || []).map((a: any) => a.url && <a key={a.id || a.nome} href={a.url} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-0.5 mr-2"><Paperclip className="w-3 h-3" />{a.nome}</a>)}
                </td>
                <td className="px-3 py-1.5 text-xs">{d.motivazione}</td>
                <td className="px-3 py-1.5 text-xs">
                  {d.decisione
                    ? <div className={d.decisione === 'approvata' ? 'text-green-700' : 'text-red-700'}>
                        {d.decisione === 'approvata' ? 'Approvata' : 'Respinta'} da {dati.nomi[d.decisa_da] || ''}, {dataIt(d.decisa_il)}
                        {d.decisione_nota && <div className="text-gray-600">{d.decisione_nota}</div>}
                      </div>
                    : puoDecidere(d)
                      ? decidi?.id === d.id
                        ? <div className="space-y-1">
                            <input className="px-1 py-0.5 border rounded text-xs w-full" placeholder="Nota (facoltativa)" value={dec.nota} onChange={e => setDecidi({ ...dec, nota: e.target.value })} />
                            <div className="flex gap-1">
                              <button type="button" disabled={inCorso} className="px-2 py-0.5 bg-green-700 text-white rounded disabled:opacity-40"
                                onClick={async () => { const ok = await invia(`/api/231/deroghe/${d.id}`, 'PATCH', { decisione: 'approvata', nota: dec.nota }, 'Deroga approvata'); if (ok) setDecidi(null) }}>Approva</button>
                              <button type="button" disabled={inCorso} className="px-2 py-0.5 bg-red-700 text-white rounded disabled:opacity-40"
                                onClick={async () => { const ok = await invia(`/api/231/deroghe/${d.id}`, 'PATCH', { decisione: 'respinta', nota: dec.nota }, 'Deroga respinta'); if (ok) setDecidi(null) }}>Respingi</button>
                            </div>
                          </div>
                        : <button type="button" className="px-2 py-0.5 border border-gray-400 rounded" onClick={() => setDecidi({ id: d.id, nota: '' })}>Decidi</button>
                      : <span className="text-amber-700">In attesa della decisione</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-800 mb-1">Deroghe registrate durante il lavoro</h3>
        <p className="text-xs text-gray-500 mb-2">Le hanno decise gli amministratori nel momento in cui servivano, con la loro motivazione: approvazione di un contratto da parte di chi aveva generato la bozza, passaggi di fase senza tutti i requisiti, invii di integrazioni e rendiconti fuori dalla regola dei quattro occhi.</p>
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase">
              <tr><th className="px-3 py-1.5 text-left">Data</th><th className="px-3 py-1.5 text-left">Dove</th><th className="px-3 py-1.5 text-left">Che cosa</th><th className="px-3 py-1.5 text-left">Motivazione</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dati.automatiche.length === 0 && <tr><td colSpan={4} className="px-3 py-3 text-gray-500">Nessuna.</td></tr>}
              {dati.automatiche.map((a: any) => (
                <tr key={a.id} className="align-top">
                  <td className="px-3 py-1.5 whitespace-nowrap">{dataIt(a.data)}</td>
                  <td className="px-3 py-1.5">{a.fonte}{a.riferimento ? <div className="text-gray-500">{a.riferimento}</div> : null}</td>
                  <td className="px-3 py-1.5">{a.oggetto}{a.chi ? <div className="text-gray-500">{a.chi}</div> : null}</td>
                  <td className="px-3 py-1.5">{a.motivazione}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
