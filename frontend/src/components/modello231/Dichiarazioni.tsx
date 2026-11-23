'use client'

import { useState } from 'react'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { LoadingSpinner } from '../shared'
import { Avvisi, campo, dataIt, useRegistro } from './comune'

/**
 * Dichiarazioni degli interessi (modulo M.04, PR.02 §4.4): ognuno presenta la
 * propria all'ingresso, ogni anno entro il 31 gennaio e a ogni variazione.
 * L'AU le valuta (un altro amministratore valuta quella dell'amministratrice unica).
 */

const SEZIONI: { chiave: string; titolo: string; aiuto: string; campi: { k: string; etichetta: string }[] }[] = [
  {
    chiave: 'enti', titolo: '1. Rapporti con enti finanziatori e valutatori',
    aiuto: 'Parenti o affini fino al secondo grado, coniuge, convivente o persone con cui hai rapporti economici, che lavorano presso enti finanziatori, enti gestori di bandi, commissioni di valutazione o organismi di controllo.',
    campi: [{ k: 'persona', etichetta: 'Persona e legame' }, { k: 'ente', etichetta: 'Ente' }, { k: 'ruolo', etichetta: 'Ruolo' }]
  },
  {
    chiave: 'clienti', titolo: '2. Rapporti con clienti, fornitori, partner e concorrenti',
    aiuto: 'Partecipazioni, cariche (amministratore, sindaco, socio), rapporti di lavoro o familiari con clienti, fornitori, partner o concorrenti di BLMProject.',
    campi: [{ k: 'soggetto', etichetta: 'Soggetto' }, { k: 'rapporto', etichetta: 'Tipo di rapporto' }, { k: 'dal', etichetta: 'Dal' }]
  },
  {
    chiave: 'attivita', titolo: '3. Altre attività professionali',
    aiuto: 'Per collaboratori con partita IVA e consulenti: incarichi per altri clienti nello stesso ambito, in particolare su bandi seguiti anche da BLMProject.',
    campi: [{ k: 'committente', etichetta: 'Committente' }, { k: 'attivita', etichetta: 'Attività' }, { k: 'bandi', etichetta: 'Bandi interessati' }]
  },
  {
    chiave: 'omaggi', titolo: '4. Omaggi e utilità ricevuti negli ultimi 12 mesi',
    aiuto: 'Da clienti, fornitori, partner o enti, di valore superiore a 150 euro complessivi per soggetto.',
    campi: [{ k: 'da', etichetta: 'Da chi' }, { k: 'cosa', etichetta: 'Che cosa' }, { k: 'valore', etichetta: 'Valore indicativo' }, { k: 'gestione', etichetta: 'Come è stato gestito' }]
  }
]

const TIPI: Record<string, string> = { prima: 'Prima dichiarazione', rinnovo: 'Rinnovo annuale', variazione: 'Variazione' }

function vuota() {
  return {
    tipo: 'rinnovo',
    sezioni: Object.fromEntries(SEZIONI.map(s => [s.chiave, { nessuno: false, casi: [] as Record<string, string>[] }])) as Record<string, { nessuno: boolean; casi: Record<string, string>[] }>,
    altro: '',
    impegno: false
  }
}

export default function Dichiarazioni({ solaLettura = false }: { solaLettura?: boolean }) {
  const { dati, errore, messaggio, inCorso, invia } = useRegistro<any>('/api/231/dichiarazioni')
  const [nuova, setNuova] = useState<ReturnType<typeof vuota> | null>(null)
  const [valuta, setValuta] = useState<{ id: string; esito: string; nota: string; misure: string } | null>(null)
  const [aperta, setAperta] = useState<string | null>(null)

  if (!dati && !errore) return <div className="p-6"><LoadingSpinner /></div>
  if (!dati) return <Avvisi errore={errore} messaggio="" />
  const val = valuta ?? { id: '', esito: 'nessun_conflitto', nota: '', misure: '' }

  const sezioneCompleta = (s: { nessuno: boolean; casi: Record<string, string>[] }) =>
    s.nessuno || (s.casi.length > 0 && s.casi.every(c => Object.values(c).some(v => v.trim())))
  const pronta = nuova && SEZIONI.every(s => sezioneCompleta(nuova.sezioni[s.chiave])) && nuova.impegno

  const presenta = async () => {
    if (!nuova) return
    const sezioni: Record<string, unknown> = { ...nuova.sezioni, altro: nuova.altro.trim() }
    const ok = await invia('/api/231/dichiarazioni', 'POST', { tipo: nuova.tipo, sezioni, impegno: nuova.impegno }, 'Dichiarazione presentata')
    if (ok) setNuova(null)
  }

  const mie = dati.dichiarazioni.filter((d: any) => d.utente_id === dati.io)
  const presentataQuestAnno = mie.some((d: any) => d.anno === dati.anno)

  return (
    <div className="space-y-3">
      <Avvisi errore={errore} messaggio={messaggio} />
      <p className="text-sm text-gray-600">
        Dichiarare un interesse non è una colpa; lo è tacerlo. Si presenta all&apos;ingresso, ogni anno entro il 31 gennaio e a ogni
        variazione. Le valuta l&apos;amministratrice unica{dati.auId ? ` (${dati.nomi[dati.auId] || ''})` : ''}; quella dell&apos;amministratrice unica la valuta un altro amministratore.
        {solaLettura && ' All\'OdV le dichiarazioni arrivano in forma riepilogativa.'}
      </p>

      {!solaLettura && !presentataQuestAnno && !nuova && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Non hai ancora presentato la dichiarazione del {dati.anno}.
          <button type="button" onClick={() => setNuova({ ...vuota(), tipo: mie.length ? 'rinnovo' : 'prima' })} className="ml-auto px-2 py-1 text-xs bg-amber-600 text-white rounded">Presentala ora</button>
        </div>
      )}

      {dati.vedeTutte && dati.mancanti.length > 0 && (
        <p className="text-xs text-gray-600">Non hanno ancora presentato la dichiarazione del {dati.anno}: {dati.mancanti.map((u: any) => u.nome).join(', ')}.</p>
      )}

      {!solaLettura && !nuova && presentataQuestAnno && (
        <button type="button" onClick={() => setNuova({ ...vuota(), tipo: 'variazione' })} className="px-3 py-1.5 text-sm border border-gray-300 rounded inline-flex items-center gap-1">
          <Plus className="w-4 h-4" /> Presenta una variazione
        </button>
      )}

      {nuova && (
        <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-3">
          <label className="text-xs text-gray-600 block max-w-xs">Tipo
            <select className={campo} value={nuova.tipo} onChange={e => setNuova({ ...nuova, tipo: e.target.value })}>
              {Object.entries(TIPI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          {SEZIONI.map(s => {
            const v = nuova.sezioni[s.chiave]
            const aggiorna = (x: typeof v) => setNuova({ ...nuova, sezioni: { ...nuova.sezioni, [s.chiave]: x } })
            return (
              <div key={s.chiave} className="border-t border-gray-100 pt-2">
                <p className="text-sm font-medium text-gray-900">{s.titolo}</p>
                <p className="text-xs text-gray-500 mb-1">{s.aiuto}</p>
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" checked={v.nessuno} onChange={e => aggiorna({ nessuno: e.target.checked, casi: e.target.checked ? [] : v.casi })} /> Nessuno
                </label>
                {!v.nessuno && (
                  <div className="space-y-1 mt-1">
                    {v.casi.map((c, i) => (
                      <div key={i} className="flex flex-wrap gap-1 items-center">
                        {s.campi.map(f => (
                          <input key={f.k} className="px-2 py-1 border border-gray-300 rounded text-xs flex-1 min-w-[120px]" placeholder={f.etichetta}
                            value={c[f.k] || ''} onChange={e => aggiorna({ ...v, casi: v.casi.map((x, j) => j === i ? { ...x, [f.k]: e.target.value } : x) })} />
                        ))}
                        <button type="button" onClick={() => aggiorna({ ...v, casi: v.casi.filter((_, j) => j !== i) })} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => aggiorna({ ...v, casi: [...v.casi, {}] })} className="text-xs text-blue-700">Aggiungi un caso</button>
                  </div>
                )}
              </div>
            )
          })}
          <div className="border-t border-gray-100 pt-2">
            <p className="text-sm font-medium text-gray-900">5. Altro</p>
            <textarea className={campo} rows={2} placeholder="Ogni altra situazione che potrebbe essere percepita come conflitto di interessi (facoltativo)"
              value={nuova.altro} onChange={e => setNuova({ ...nuova, altro: e.target.value })} />
          </div>
          <label className="flex items-start gap-2 text-xs text-gray-800 border-t border-gray-100 pt-2">
            <input type="checkbox" className="mt-0.5" checked={nuova.impegno} onChange={e => setNuova({ ...nuova, impegno: e.target.checked })} />
            Mi impegno a comunicare all&apos;amministratrice unica ogni variazione e, se mi trovo in conflitto rispetto a una decisione o a una pratica, a dichiararlo
            prima e ad astenermi. Prendo atto che i dati sono trattati per l&apos;applicazione del Modello 231, secondo l&apos;informativa privacy ricevuta.
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={inCorso || !pronta} onClick={presenta} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-40">Presenta la dichiarazione</button>
            <button type="button" onClick={() => setNuova(null)} className="px-3 py-1.5 text-sm border rounded">Annulla</button>
          </div>
          {!pronta && <p className="text-xs text-gray-500">Per ogni sezione indica &quot;Nessuno&quot; oppure almeno un caso, e accetta gli impegni.</p>}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-1.5 text-left">Persona</th>
              <th className="px-3 py-1.5 text-left">Dichiarazione</th>
              <th className="px-3 py-1.5 text-left">Contenuto</th>
              <th className="px-3 py-1.5 text-left">Valutazione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dati.dichiarazioni.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-gray-500">Nessuna dichiarazione.</td></tr>}
            {dati.dichiarazioni.map((d: any) => {
              const conCasi = SEZIONI.filter(s => !d.sezioni?.[s.chiave]?.nessuno)
              return (
                <tr key={d.id} className="align-top">
                  <td className="px-3 py-1.5">{dati.nomi[d.utente_id] || ''}</td>
                  <td className="px-3 py-1.5 text-xs whitespace-nowrap">{TIPI[d.tipo]} {d.anno}<div className="text-gray-500">{dataIt(d.dichiarata_il)}</div></td>
                  <td className="px-3 py-1.5 text-xs">
                    {conCasi.length === 0 && !d.sezioni?.altro
                      ? <span className="text-gray-600">Nessun interesse dichiarato</span>
                      : solaLettura
                        ? <span>{conCasi.map(s => `${s.titolo.replace(/^\d\. /, '')}: ${d.sezioni[s.chiave].numero_casi} casi`).join(' · ')}{d.sezioni?.altro ? ' · altro: presente' : ''}</span>
                        : <>
                            <button type="button" className="text-blue-700" onClick={() => setAperta(aperta === d.id ? null : d.id)}>
                              {conCasi.length} sezioni con casi{d.sezioni?.altro ? ' e note' : ''}: {aperta === d.id ? 'chiudi' : 'leggi'}
                            </button>
                            {aperta === d.id && (
                              <div className="mt-1 space-y-1">
                                {conCasi.map(s => (
                                  <div key={s.chiave}><strong>{s.titolo}</strong>
                                    {(d.sezioni[s.chiave].casi || []).map((c: any, i: number) => <div key={i} className="text-gray-700">· {s.campi.map(f => c[f.k]).filter(Boolean).join(' · ')}</div>)}
                                  </div>
                                ))}
                                {d.sezioni?.altro && <div><strong>Altro:</strong> {d.sezioni.altro}</div>}
                              </div>
                            )}
                          </>}
                  </td>
                  <td className="px-3 py-1.5 text-xs">
                    {d.esito
                      ? <div>
                          <span className={d.esito === 'nessun_conflitto' ? 'text-green-700' : 'text-amber-800'}>{d.esito === 'nessun_conflitto' ? 'Nessun conflitto rilevante' : 'Conflitto annotato nel registro'}</span>
                          <div className="text-gray-500">{dati.nomi[d.valutata_da] || ''}, {dataIt(d.valutata_il)}{d.nota_valutazione && !solaLettura ? ` · ${d.nota_valutazione}` : ''}</div>
                        </div>
                      : !solaLettura && dati.io !== d.utente_id && (dati.puoDecidere || (d.utente_id === dati.auId && dati.vedeTutte))
                        ? valuta?.id === d.id
                          ? <div className="space-y-1">
                              <select className="px-1 py-0.5 border rounded text-xs" value={val.esito} onChange={e => setValuta({ ...val, esito: e.target.value })}>
                                <option value="nessun_conflitto">Nessun conflitto rilevante</option>
                                <option value="conflitto_annotato">Conflitto da annotare nel registro</option>
                              </select>
                              <input className="px-1 py-0.5 border rounded text-xs w-full" placeholder="Nota (facoltativa)" value={val.nota} onChange={e => setValuta({ ...val, nota: e.target.value })} />
                              {val.esito === 'conflitto_annotato' && <input className="px-1 py-0.5 border rounded text-xs w-full" placeholder="Misure adottate" value={val.misure} onChange={e => setValuta({ ...val, misure: e.target.value })} />}
                              <button type="button" disabled={inCorso || (val.esito === 'conflitto_annotato' && !val.misure.trim())}
                                onClick={async () => { const ok = await invia(`/api/231/dichiarazioni/${d.id}`, 'PATCH', { esito: val.esito, nota: val.nota, misure: val.misure }, 'Valutazione registrata'); if (ok) setValuta(null) }}
                                className="px-2 py-0.5 bg-gray-800 text-white rounded disabled:opacity-40">Registra</button>
                            </div>
                          : <button type="button" onClick={() => setValuta({ id: d.id, esito: 'nessun_conflitto', nota: '', misure: '' })} className="px-2 py-0.5 border border-gray-400 rounded">Valuta</button>
                        : <span className="text-amber-700">Da valutare</span>}
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
