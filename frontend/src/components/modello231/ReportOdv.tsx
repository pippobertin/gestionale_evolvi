'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, RefreshCw, Send, Paperclip, Check } from 'lucide-react'
import { LoadingSpinner } from '../shared'
import { Avvisi, dataIt, useRegistro } from './comune'
import { CalendarService } from '@/lib/notifications/calendarService'

/**
 * Report semestrale all'OdV (modulo M.05): bozza precompilata con i dati dei
 * registri, sezioni completate e confermate dai responsabili, invio dell'AU.
 */
export default function ReportOdv({ solaLettura = false }: { solaLettura?: boolean }) {
  const { dati, errore, messaggio, inCorso, invia } = useRegistro<any>('/api/231/report-odv')
  const [aperto, setAperto] = useState<string | null>(null)
  const [bozze, setBozze] = useState<Record<string, any>>({})
  const [scelta, setScelta] = useState('')
  const promemoriaTentati = useRef(false)

  // Promemoria ricorrenti in calendario: si creano una volta sola, dal primo amministratore che apre la scheda
  useEffect(() => {
    if (!dati || solaLettura || !dati.admin || dati.promemoriaAttivi || promemoriaTentati.current) return
    promemoriaTentati.current = true
    CalendarService.promemoriaReportOdv(dati.emailAdmin || [])
      .then(n => { if (n > 0) fetch('/api/231/report-odv', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione: 'promemoria' }) }) })
      .catch(err => console.error('Promemoria del report OdV non creati:', err))
  }, [dati, solaLettura])

  if (!dati && !errore) return <div className="p-6"><LoadingSpinner /></div>
  if (!dati) return <Avvisi errore={errore} messaggio="" />
  const report = (dati.report as any[]).find(r => r.id === aperto) || null
  const modificabile = !solaLettura && report && !report.inviato_il

  const bozzaDi = (k: string, s: any) => bozze[k] || { nessuna_novita: s.nessuna_novita, testo: s.testo || '', voci: s.voci.map((v: any) => ({ chiave: v.chiave, numero: v.numero, nota: v.nota })) }
  const aggiornaVoce = (k: string, s: any, chiave: string, campo: string, valore: string) => {
    const b = bozzaDi(k, s)
    setBozze({ ...bozze, [k]: { ...b, voci: b.voci.map((v: any) => v.chiave === chiave ? { ...v, [campo]: valore } : v) } })
  }
  const azione = async (corpo: any, ok: string) => {
    const r = await invia(`/api/231/report-odv/${report.id}`, 'PATCH', corpo, ok)
    if (r && corpo.chiave) { const { [corpo.chiave]: _, ...resto } = bozze; void _; setBozze(resto) }
    return r
  }
  const tutteConfermate = report && Object.values(report.sezioni).every((s: any) => s.confermata_il)

  return (
    <div className="space-y-3">
      <Avvisi errore={errore} messaggio={messaggio} />
      {!report && (
        <>
          <p className="text-sm text-gray-600">
            Un report per semestre, da inviare all&apos;OdV entro il 31 luglio (primo semestre) e il 31 gennaio (secondo). La bozza si prepara da sola
            alla chiusura del semestre con i dati dei registri; ogni responsabile verifica e completa la propria sezione e la conferma, poi l&apos;AU
            lo invia e il PDF resta su Drive. I fatti gravi non aspettano il report: si comunicano subito all&apos;OdV.
          </p>
          {!solaLettura && dati.admin && dati.disponibili.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select className="px-2 py-1.5 border border-gray-300 rounded text-sm" value={scelta} onChange={e => setScelta(e.target.value)}>
                <option value="">Prepara il report di…</option>
                {dati.disponibili.map((s: any) => <option key={`${s.anno}-${s.semestre}`} value={`${s.anno}-${s.semestre}`}>{s.semestre}° semestre {s.anno}</option>)}
              </select>
              <button type="button" disabled={!scelta || inCorso} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-40"
                onClick={async () => { const [anno, semestre] = scelta.split('-'); const r = await invia('/api/231/report-odv', 'POST', { anno, semestre }, 'Bozza preparata'); if (r?.id) { setAperto(r.id); setScelta('') } }}>Prepara</button>
            </div>
          )}
          <div className="bg-white rounded-lg border border-gray-200 divide-y">
            {dati.report.length === 0 && <div className="p-4 text-sm text-gray-500">{solaLettura ? 'Nessun report ancora inviato.' : 'Nessun report preparato.'}</div>}
            {dati.report.map((r: any) => {
              const confermate = Object.values(r.sezioni).filter((s: any) => s.confermata_il).length
              return (
                <button key={r.id} type="button" onClick={() => { setAperto(r.id); setBozze({}) }} className="w-full px-3 py-2 flex flex-wrap items-center gap-2 text-left text-sm hover:bg-gray-50">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="font-medium text-gray-900">{r.semestre}° semestre {r.anno}</span>
                  <span className="text-gray-500">dal {dataIt(r.periodo_dal)} al {dataIt(r.periodo_al)} · entro il {dataIt(r.scadenza)}</span>
                  <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${r.inviato_il ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                    {r.inviato_il ? `Inviato il ${dataIt(r.inviato_il)}` : `Bozza · ${confermate} di ${Object.keys(r.sezioni).length} sezioni confermate`}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {report && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { setAperto(null); setBozze({}) }} className="text-sm text-blue-600 hover:underline">← Tutti i report</button>
            <h3 className="text-base font-semibold text-gray-900">Report del {report.semestre}° semestre {report.anno}</h3>
            <span className="text-sm text-gray-500">dal {dataIt(report.periodo_dal)} al {dataIt(report.periodo_al)} · da inviare entro il {dataIt(report.scadenza)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {report.inviato_il
              ? <span className="text-green-700">Inviato all&apos;OdV il {dataIt(report.inviato_il)} da {dati.nomi[report.inviato_da] || ''}</span>
              : <span className="text-amber-700">Bozza{report.dati_aggiornati_il ? `, dati dei registri aggiornati il ${new Date(report.dati_aggiornati_il).toLocaleString('it-IT')}` : ''}</span>}
            {report.pdf?.url && <a href={report.pdf.url} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-0.5"><Paperclip className="w-3 h-3" />PDF su Drive</a>}
            <a href={`/api/231/report-odv/${report.id}/pdf`} target="_blank" rel="noreferrer" className="px-2 py-1 border rounded inline-flex items-center gap-1"><FileText className="w-3 h-3" /> {report.inviato_il ? 'Apri il PDF' : 'Anteprima PDF'}</a>
            {modificabile && (
              <button type="button" disabled={inCorso} className="px-2 py-1 border rounded inline-flex items-center gap-1"
                onClick={() => azione({ azione: 'aggiorna_dati' }, 'Dati aggiornati nelle sezioni non ancora confermate')}><RefreshCw className="w-3 h-3" /> Aggiorna i dati dai registri</button>
            )}
            {modificabile && dati.puoDecidere && (
              <button type="button" disabled={inCorso || !tutteConfermate} title={tutteConfermate ? '' : 'Ogni sezione va prima confermata'}
                className="px-3 py-1 bg-gray-800 text-white rounded disabled:opacity-40 inline-flex items-center gap-1"
                onClick={() => { if (confirm('Inviare il report all\'OdV? Dopo l\'invio non sarà più modificabile e il PDF verrà salvato su Drive.')) azione({ azione: 'invia' }, 'Report inviato: l\'OdV lo trova nella sua area e il PDF è su Drive') }}>
                <Send className="w-3 h-3" /> Invia all&apos;OdV (AU)</button>
            )}
          </div>
          {modificabile && <p className="text-xs text-gray-500">Le voci con il segno «dal gestionale» si compilano da sole con i dati dei registri; nella nota si aggiunge ciò che serve. Le altre le compila il responsabile.</p>}

          {Object.entries(report.sezioni).map(([k, s]: [string, any]) => {
            const b = bozzaDi(k, s)
            const aperta = modificabile && !s.confermata_il
            return (
              <div key={k} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium text-gray-900">{k}. {s.titolo}</h4>
                  <span className="text-xs text-gray-500">compila: {s.compila}</span>
                  <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${s.confermata_il ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {s.confermata_il ? `Confermata da ${dati.nomi[s.confermata_da] || ''} il ${dataIt(s.confermata_il)}` : 'Da confermare'}
                  </span>
                </div>
                <label className="inline-flex items-center gap-1 text-sm text-gray-800">
                  <input type="checkbox" disabled={!aperta} checked={!!b.nessuna_novita} onChange={e => setBozze({ ...bozze, [k]: { ...b, nessuna_novita: e.target.checked } })} /> Nessuna novità
                </label>
                <table className="min-w-full text-xs">
                  <tbody className="divide-y divide-gray-100">
                    {s.voci.map((v: any) => {
                      const bv = b.voci.find((x: any) => x.chiave === v.chiave) || v
                      return (
                        <tr key={v.chiave} className="align-top">
                          <td className="py-1.5 pr-2 w-1/3 text-gray-800">
                            {v.etichetta}
                            {v.auto && <span className="ml-1 text-[10px] px-1 rounded bg-blue-50 text-blue-700">dal gestionale</span>}
                          </td>
                          <td className="py-1.5 pr-2 w-20">
                            {aperta && !v.auto
                              ? <input className="px-1 py-0.5 border rounded w-16" value={bv.numero} onChange={e => aggiornaVoce(k, s, v.chiave, 'numero', e.target.value)} />
                              : <span className="font-medium">{v.numero}</span>}
                          </td>
                          <td className="py-1.5">
                            {v.dettaglio && <div className="whitespace-pre-line text-gray-700 mb-1">{v.dettaglio}</div>}
                            {aperta
                              ? <textarea className="w-full px-1 py-0.5 border rounded" rows={v.auto ? 1 : 2} placeholder={v.auto ? 'Nota (facoltativa)' : 'Dettaglio dei casi da segnalare'} value={bv.nota} onChange={e => aggiornaVoce(k, s, v.chiave, 'nota', e.target.value)} />
                              : v.nota && <div className="whitespace-pre-line text-gray-600">{v.nota}</div>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {(k === '7' || b.testo || s.testo) && (aperta
                  ? <textarea className="w-full px-2 py-1 border rounded text-sm" rows={2} placeholder="Fatti o proposte da portare all'attenzione dell'OdV" value={b.testo} onChange={e => setBozze({ ...bozze, [k]: { ...b, testo: e.target.value } })} />
                  : s.testo && <p className="text-sm text-gray-700 whitespace-pre-line">{s.testo}</p>)}
                {modificabile && (
                  <div className="flex flex-wrap gap-2">
                    {aperta && <button type="button" disabled={inCorso || !bozze[k]} className="px-3 py-1 text-sm border border-gray-400 rounded disabled:opacity-40" onClick={() => azione({ azione: 'salva_sezione', chiave: k, sezione: b }, 'Sezione salvata')}>Salva</button>}
                    {aperta && <button type="button" disabled={inCorso} className="px-3 py-1 text-sm bg-gray-800 text-white rounded disabled:opacity-40 inline-flex items-center gap-1" onClick={() => azione({ azione: 'conferma', chiave: k, sezione: b }, 'Sezione confermata')}><Check className="w-3 h-3" /> Conferma la sezione</button>}
                    {s.confermata_il && <button type="button" disabled={inCorso} className="px-3 py-1 text-sm border rounded" onClick={() => azione({ azione: 'riapri', chiave: k }, 'Sezione riaperta')}>Riapri</button>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
