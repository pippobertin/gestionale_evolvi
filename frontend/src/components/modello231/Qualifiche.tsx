'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, ExternalLink, Plus } from 'lucide-react'
import { LoadingSpinner } from '../shared'
import { Avvisi, campo, dataIt, useRegistro } from './comune'

/**
 * Qualifica delle controparti (modulo M.01, PR.06 §4.1): una scheda per ogni
 * nuovo cliente, partner, fornitore, consulente o segnalatore, rinnovata ogni
 * 12 mesi per i rapporti continuativi. Le anomalie le decide l'AU per iscritto.
 */

const TIPI: Record<string, string> = {
  cliente: 'Cliente', partner: 'Partner', fornitore: 'Fornitore', consulente: 'Consulente o professionista', segnalatore: 'Segnalatore'
}
const DECISIONI: Record<string, string> = {
  procedere: 'Si procede', procedere_cautele: 'Si procede con cautele', non_procedere: 'Non si procede'
}

function giorniA(d: string) {
  return Math.round((new Date(`${d}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000)
}

export default function Qualifiche({ solaLettura = false }: { solaLettura?: boolean }) {
  const { dati, errore, messaggio, inCorso, invia } = useRegistro<any>('/api/231/qualifiche')
  const [nuova, setNuova] = useState<any>(null)
  const [decisione, setDecisione] = useState<{ id: string; decisione: string; motivazione: string } | null>(null)
  const [filtro, setFiltro] = useState('')
  const dec = decisione ?? { id: '', decisione: 'procedere_cautele', motivazione: '' }

  if (!dati && !errore) return <div className="p-6"><LoadingSpinner /></div>
  if (!dati) return <Avvisi errore={errore} messaggio="" />

  const voci = (forma: string) => dati.voci.filter((v: any) => v.tipo === (forma === 'societa' ? 'qualifica_societa' : 'qualifica_persona'))
  const schede = dati.schede.filter((s: any) => !filtro || s.denominazione.toLowerCase().includes(filtro.toLowerCase()))
  const daRinnovare = dati.schede.filter((s: any) => s.scade_il && giorniA(s.scade_il) <= 30)
  const daDecidere = dati.schede.filter((s: any) => s.esito === 'anomalia' && !s.decisione)

  const apriNuova = (forma = 'societa') => setNuova({
    soggetto_tipo: 'cliente', forma, cliente_id: '', denominazione: '', codice_fiscale: '', partita_iva: '',
    continuativo: true, verifiche: Object.fromEntries(voci(forma).map((v: any) => [v.chiave, { fatto: false, nota: '' }])),
    esito: 'nessuna_anomalia', anomalia: '', file: [] as File[]
  })

  const salva = async () => {
    const form = new FormData()
    for (const k of ['soggetto_tipo', 'forma', 'cliente_id', 'denominazione', 'codice_fiscale', 'partita_iva', 'esito', 'anomalia']) form.append(k, nuova[k] || '')
    form.append('continuativo', String(nuova.continuativo))
    form.append('verifiche', JSON.stringify(voci(nuova.forma).map((v: any) => ({
      chiave: v.chiave, etichetta: v.etichetta, fatto: !!nuova.verifiche[v.chiave]?.fatto, nota: nuova.verifiche[v.chiave]?.nota || ''
    }))))
    for (const f of nuova.file) form.append('file', f)
    const ok = await invia('/api/231/qualifiche', 'POST', form, nuova.esito === 'anomalia' ? 'Scheda registrata: l\'anomalia è in attesa della decisione dell\'AU' : 'Scheda di qualifica registrata')
    if (ok) setNuova(null)
  }

  return (
    <div className="space-y-3">
      <Avvisi errore={errore} messaggio={messaggio} />
      <p className="text-sm text-gray-600">
        Una scheda per ogni nuovo cliente, partner, fornitore, consulente o segnalatore, prima del contratto; per i rapporti continuativi
        si rinnova ogni 12 mesi. Le anomalie le decide l&apos;AU per iscritto{dati.auId ? ` (${dati.nomi[dati.auId] || ''})` : ''}.
      </p>

      {(daDecidere.length > 0 || daRinnovare.length > 0) && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {daDecidere.length > 0 && <>{daDecidere.length} schede con anomalia in attesa della decisione dell&apos;AU. </>}
            {daRinnovare.length > 0 && <>{daRinnovare.length} schede da rinnovare entro 30 giorni o già scadute.</>}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <input className={`${campo} max-w-xs`} placeholder="Cerca per nome" value={filtro} onChange={e => setFiltro(e.target.value)} />
        {!solaLettura && !nuova && (
          <button type="button" onClick={() => apriNuova()} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-1 ml-auto">
            <Plus className="w-4 h-4" /> Nuova scheda di qualifica
          </button>
        )}
      </div>

      {nuova && (
        <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="text-xs text-gray-600">Controparte
              <select className={campo} value={nuova.soggetto_tipo} onChange={e => setNuova({ ...nuova, soggetto_tipo: e.target.value })}>
                {Object.entries(TIPI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600">Forma
              <select className={campo} value={nuova.forma} onChange={e => {
                // Cambia solo la checklist: tipo, nome e dati già scritti restano
                const forma = e.target.value
                setNuova({ ...nuova, forma, verifiche: Object.fromEntries(voci(forma).map((v: any) => [v.chiave, { fatto: false, nota: '' }])) })
              }}>
                <option value="societa">Società</option><option value="persona">Persona o professionista</option>
              </select>
            </label>
            {nuova.soggetto_tipo === 'cliente' && (
              <label className="text-xs text-gray-600">Cliente del gestionale
                <select className={campo} value={nuova.cliente_id} onChange={e => {
                  const c = dati.clienti.find((x: any) => x.id === e.target.value)
                  setNuova({ ...nuova, cliente_id: e.target.value, denominazione: c?.denominazione || nuova.denominazione, partita_iva: c?.partita_iva || nuova.partita_iva, codice_fiscale: c?.codice_fiscale || nuova.codice_fiscale })
                }}>
                  <option value="">Scegli (facoltativo)</option>
                  {dati.clienti.map((c: any) => <option key={c.id} value={c.id}>{c.denominazione}</option>)}
                </select>
              </label>
            )}
            <label className="text-xs text-gray-600">Denominazione o nome e cognome<input className={campo} value={nuova.denominazione} onChange={e => setNuova({ ...nuova, denominazione: e.target.value })} /></label>
            <label className="text-xs text-gray-600">Partita IVA<input className={campo} value={nuova.partita_iva} onChange={e => setNuova({ ...nuova, partita_iva: e.target.value })} /></label>
            <label className="text-xs text-gray-600">Codice fiscale<input className={campo} value={nuova.codice_fiscale} onChange={e => setNuova({ ...nuova, codice_fiscale: e.target.value })} /></label>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={nuova.continuativo} onChange={e => setNuova({ ...nuova, continuativo: e.target.checked })} />
            Rapporto continuativo (la scheda si rinnova fra 12 mesi)
          </label>
          <div>
            <p className="text-xs font-medium text-gray-800 mb-1">Verifiche</p>
            {voci(nuova.forma).map((v: any) => (
              <div key={v.chiave} className="flex flex-wrap items-center gap-2 py-0.5">
                <label className="flex items-start gap-2 text-xs text-gray-800 flex-1 min-w-[260px]">
                  <input type="checkbox" checked={!!nuova.verifiche[v.chiave]?.fatto}
                    onChange={e => setNuova({ ...nuova, verifiche: { ...nuova.verifiche, [v.chiave]: { ...nuova.verifiche[v.chiave], fatto: e.target.checked } } })} />
                  {v.etichetta}
                </label>
                <input className="px-2 py-1 border border-gray-200 rounded text-xs w-56" placeholder="Nota (esito, punteggio, data)"
                  value={nuova.verifiche[v.chiave]?.nota || ''}
                  onChange={e => setNuova({ ...nuova, verifiche: { ...nuova.verifiche, [v.chiave]: { ...nuova.verifiche[v.chiave], nota: e.target.value } } })} />
              </div>
            ))}
          </div>
          <label className="text-xs text-gray-600 block">Documenti (report, visura, schermate delle liste UE…)
            <input type="file" multiple className="text-xs block" onChange={e => setNuova({ ...nuova, file: Array.from(e.target.files || []) })} />
          </label>
          <div className="flex flex-wrap gap-3 items-start">
            <label className="flex items-center gap-1 text-sm"><input type="radio" checked={nuova.esito === 'nessuna_anomalia'} onChange={() => setNuova({ ...nuova, esito: 'nessuna_anomalia' })} /> Nessuna anomalia</label>
            <label className="flex items-center gap-1 text-sm"><input type="radio" checked={nuova.esito === 'anomalia'} onChange={() => setNuova({ ...nuova, esito: 'anomalia' })} /> Anomalia rilevata (la decide l&apos;AU)</label>
            {nuova.esito === 'anomalia' && <input className={campo} placeholder="Descrivi l'anomalia" value={nuova.anomalia} onChange={e => setNuova({ ...nuova, anomalia: e.target.value })} />}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={inCorso || !nuova.denominazione.trim() || (nuova.esito === 'anomalia' && !nuova.anomalia.trim())}
              onClick={salva} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-40">{inCorso ? 'Salvataggio…' : 'Registra la scheda'}</button>
            <button type="button" onClick={() => setNuova(null)} className="px-3 py-1.5 text-sm border rounded">Annulla</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-1.5 text-left">Controparte</th>
              <th className="px-3 py-1.5 text-left">Compilata</th>
              <th className="px-3 py-1.5 text-left">Verifiche</th>
              <th className="px-3 py-1.5 text-left">Esito</th>
              <th className="px-3 py-1.5 text-left">Rinnovo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schede.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-gray-500">Nessuna scheda.</td></tr>}
            {schede.map((s: any) => {
              const fatte = (s.verifiche || []).filter((v: any) => v.fatto).length
              const totali = (s.verifiche || []).length
              return (
                <tr key={s.id} className="align-top">
                  <td className="px-3 py-1.5">
                    <div className="font-medium text-gray-900">{s.denominazione}</div>
                    <div className="text-xs text-gray-500">{TIPI[s.soggetto_tipo]} · {s.forma === 'societa' ? 'società' : 'persona'}{s.partita_iva ? ` · P.IVA ${s.partita_iva}` : ''}</div>
                    {(s.allegati || []).length > 0 && (
                      <div className="text-xs flex flex-wrap gap-2 mt-0.5">
                        {s.allegati.map((a: any, i: number) => a.url && <a key={i} href={a.url} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-0.5">{a.nome}<ExternalLink className="w-3 h-3" /></a>)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs">{dataIt(s.compilata_il)}<div className="text-gray-500">{dati.nomi[s.compilata_da] || ''}</div></td>
                  <td className="px-3 py-1.5 text-xs" title={(s.verifiche || []).map((v: any) => `${v.fatto ? '✓' : '✗'} ${v.etichetta}${v.nota ? ` (${v.nota})` : ''}`).join('\n')}>
                    <span className={fatte === totali ? 'text-green-700' : 'text-amber-700'}>{fatte} di {totali}</span>
                  </td>
                  <td className="px-3 py-1.5 text-xs">
                    {s.esito === 'nessuna_anomalia'
                      ? <span className="text-green-700 inline-flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Nessuna anomalia</span>
                      : <div>
                          <span className="text-amber-800">Anomalia: {s.anomalia}</span>
                          {s.decisione
                            ? <div className="text-gray-700">Decisione dell&apos;AU: <strong>{DECISIONI[s.decisione]}</strong>, {dati.nomi[s.decisa_da] || ''} il {dataIt(s.decisa_il)}{s.decisione_motivazione && <> · {s.decisione_motivazione}</>}</div>
                            : dati.puoDecidere && !solaLettura
                              ? decisione?.id === s.id
                                ? <div className="flex flex-wrap gap-1 mt-1">
                                    <select className="px-1 py-0.5 border rounded text-xs" value={dec.decisione} onChange={e => setDecisione({ ...dec, decisione: e.target.value })}>
                                      {Object.entries(DECISIONI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                    <input className="px-1 py-0.5 border rounded text-xs flex-1" placeholder="Motivazione" value={dec.motivazione} onChange={e => setDecisione({ ...dec, motivazione: e.target.value })} />
                                    <button type="button" disabled={inCorso || !dec.motivazione.trim()}
                                      onClick={async () => { const ok = await invia(`/api/231/qualifiche/${s.id}`, 'PATCH', { decisione: dec.decisione, motivazione: dec.motivazione }, 'Decisione registrata'); if (ok) setDecisione(null) }}
                                      className="px-2 py-0.5 bg-gray-800 text-white rounded disabled:opacity-40">Registra</button>
                                  </div>
                                : <button type="button" onClick={() => setDecisione({ id: s.id, decisione: 'procedere_cautele', motivazione: '' })} className="mt-1 px-2 py-0.5 border border-amber-400 text-amber-800 rounded">Decidi (AU)</button>
                              : <div className="text-amber-700">In attesa della decisione dell&apos;AU</div>}
                        </div>}
                  </td>
                  <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                    {s.scade_il
                      ? <span className={giorniA(s.scade_il) < 0 ? 'text-red-700 font-medium' : giorniA(s.scade_il) <= 30 ? 'text-amber-700' : 'text-gray-600'}>{dataIt(s.scade_il)}</span>
                      : <span className="text-gray-400">non continuativo</span>}
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
