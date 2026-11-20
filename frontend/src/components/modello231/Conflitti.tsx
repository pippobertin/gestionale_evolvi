'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { LoadingSpinner } from '../shared'
import { Avvisi, campo, dataIt, oggi, useRegistro } from './comune'

/**
 * Registro dei conflitti (PR.02 §4.4 e §4.5): conflitti dichiarati o emersi,
 * misure adottate e decisione dell'AU (di un altro amministratore se il
 * conflitto riguarda l'AU). Trasmesso all'OdV.
 */
const ORIGINI: Record<string, string> = {
  dichiarazione: 'Dichiarazione degli interessi', stesso_bando: 'Più clienti sullo stesso bando', segnalazione: 'Segnalazione', altro: 'Altro'
}

export default function Conflitti({ solaLettura = false }: { solaLettura?: boolean }) {
  const { dati, errore, messaggio, inCorso, invia } = useRegistro<any>('/api/231/conflitti')
  const [nuovo, setNuovo] = useState<any>(null)
  const [decidi, setDecidi] = useState<{ id: string; decisione: string; misure: string } | null>(null)

  if (!dati && !errore) return <div className="p-6"><LoadingSpinner /></div>
  if (!dati) return <Avvisi errore={errore} messaggio="" />
  const dec = decidi ?? { id: '', decisione: '', misure: '' }

  return (
    <div className="space-y-3">
      <Avvisi errore={errore} messaggio={messaggio} />
      <p className="text-sm text-gray-600">
        Chi si trova in conflitto rispetto a una decisione lo dichiara prima e si astiene. Qui si annotano i conflitti, le misure e la
        decisione dell&apos;AU{dati.auId ? ` (${dati.nomi[dati.auId] || ''})` : ''}; se il conflitto riguarda l&apos;AU decide un altro amministratore.
      </p>
      {!solaLettura && !nuovo && (
        <button type="button" onClick={() => setNuovo({ data: oggi(), origine: 'stesso_bando', persona_id: '', persona_esterna: '', progetto_id: '', descrizione: '', misure: '' })}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Annota un conflitto</button>
      )}
      {nuovo && (
        <div className="bg-white border border-blue-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="text-xs text-gray-600">Data<input type="date" className={campo} value={nuovo.data} onChange={e => setNuovo({ ...nuovo, data: e.target.value })} /></label>
          <label className="text-xs text-gray-600">Origine
            <select className={campo} value={nuovo.origine} onChange={e => setNuovo({ ...nuovo, origine: e.target.value })}>
              {Object.entries(ORIGINI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Persona interessata
            <select className={campo} value={nuovo.persona_id} onChange={e => setNuovo({ ...nuovo, persona_id: e.target.value })}>
              <option value="">Esterna o nessuna</option>
              {dati.utentiAttivi.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
          {!nuovo.persona_id && <label className="text-xs text-gray-600">Persona esterna<input className={campo} value={nuovo.persona_esterna} onChange={e => setNuovo({ ...nuovo, persona_esterna: e.target.value })} /></label>}
          <label className="text-xs text-gray-600 md:col-span-2">Pratica collegata
            <select className={campo} value={nuovo.progetto_id} onChange={e => setNuovo({ ...nuovo, progetto_id: e.target.value })}>
              <option value="">Nessuna</option>
              {dati.progetti.map((p: any) => <option key={p.id} value={p.id}>{p.titolo_progetto}{p.scadenze_bandi_clienti?.denominazione ? ` · ${p.scadenze_bandi_clienti.denominazione}` : ''}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600 md:col-span-3">Descrizione<input className={campo} value={nuovo.descrizione} onChange={e => setNuovo({ ...nuovo, descrizione: e.target.value })} /></label>
          <label className="text-xs text-gray-600 md:col-span-3">Misure adottate (separazione, astensione, revisione affidata a un altro…)<input className={campo} value={nuovo.misure} onChange={e => setNuovo({ ...nuovo, misure: e.target.value })} /></label>
          <div className="flex gap-2 md:col-span-3">
            <button type="button" disabled={inCorso || !nuovo.descrizione.trim()}
              onClick={async () => { const ok = await invia('/api/231/conflitti', 'POST', nuovo, 'Conflitto annotato'); if (ok) setNuovo(null) }}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-40">Annota</button>
            <button type="button" onClick={() => setNuovo(null)} className="px-3 py-1.5 text-sm border rounded">Annulla</button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-1.5 text-left">Data</th>
              <th className="px-3 py-1.5 text-left">Conflitto</th>
              <th className="px-3 py-1.5 text-left">Misure</th>
              <th className="px-3 py-1.5 text-left">Decisione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dati.conflitti.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-gray-500">Nessun conflitto annotato.</td></tr>}
            {dati.conflitti.map((c: any) => {
              const puo = !solaLettura && dati.io !== c.persona_id && (c.persona_id && c.persona_id === dati.auId ? dati.vedeTutto : dati.puoDecidere)
              return (
                <tr key={c.id} className="align-top">
                  <td className="px-3 py-1.5 text-xs whitespace-nowrap">{dataIt(c.data)}</td>
                  <td className="px-3 py-1.5 text-xs">
                    <div className="text-gray-900">{c.descrizione}</div>
                    <div className="text-gray-500">
                      {ORIGINI[c.origine]}{c.persona_id ? ` · ${dati.nomi[c.persona_id] || ''}` : c.persona_esterna ? ` · ${c.persona_esterna}` : ''}
                      {c.scadenze_bandi_progetti?.titolo_progetto && ` · ${c.scadenze_bandi_progetti.titolo_progetto}`}
                      {c.scadenze_bandi_clienti?.denominazione && ` (${c.scadenze_bandi_clienti.denominazione})`}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-xs">{c.misure || <span className="text-gray-400">da definire</span>}</td>
                  <td className="px-3 py-1.5 text-xs">
                    {c.decisione
                      ? <div>{c.decisione}<div className="text-gray-500">{dati.nomi[c.decisa_da] || ''}, {dataIt(c.decisa_il)}</div></div>
                      : puo
                        ? decidi?.id === c.id
                          ? <div className="space-y-1">
                              <input className="px-1 py-0.5 border rounded text-xs w-full" placeholder="Decisione" value={dec.decisione} onChange={e => setDecidi({ ...dec, decisione: e.target.value })} />
                              <input className="px-1 py-0.5 border rounded text-xs w-full" placeholder="Misure (se da aggiornare)" value={dec.misure} onChange={e => setDecidi({ ...dec, misure: e.target.value })} />
                              <button type="button" disabled={inCorso || !dec.decisione.trim()}
                                onClick={async () => { const ok = await invia(`/api/231/conflitti/${c.id}`, 'PATCH', { decisione: dec.decisione, misure: dec.misure }, 'Decisione registrata'); if (ok) setDecidi(null) }}
                                className="px-2 py-0.5 bg-gray-800 text-white rounded disabled:opacity-40">Registra</button>
                            </div>
                          : <button type="button" onClick={() => setDecidi({ id: c.id, decisione: '', misure: '' })} className="px-2 py-0.5 border border-gray-400 rounded">Decidi</button>
                        : <span className="text-amber-700">In attesa della decisione</span>}
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
