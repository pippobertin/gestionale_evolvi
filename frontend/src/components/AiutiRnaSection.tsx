'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Landmark, ExternalLink, Loader2, AlertCircle, ArrowUpCircle, Undo2,
  ShieldCheck, ChevronDown, ChevronRight, X, AlertTriangle, CheckCircle2
} from 'lucide-react'
import {
  FORMA_LABEL, STATO_LABEL, FORME_CONTRIBUTO, STATI_CONTRIBUTO,
  type ContributoForma, type ContributoStato
} from '@/lib/contributi/types'

// ----------------------------------------------------------------
// Tipi della risposta GET /api/clienti/[id]/rna
// ----------------------------------------------------------------

interface AiutoRna {
  id: string
  cor: string
  car: string | null
  titolo_misura: string | null
  soggetto_concedente: string | null
  data_concessione: string | null
  anno_concessione: number | null
  titolo_progetto: string | null
  procedimenti: string[]
  regolamenti: string[]
  strumenti: string[]
  forma_proposta: ContributoForma | null
  importo_nominale: number | null
  elemento_aiuto: number | null
  de_minimis: boolean
  ambito: 'FPI' | 'GARANZIA_PMI' | 'ALTRO'
  fondo_interprofessionale: string | null
  link_atto_concessione: string | null
  link_trasparenza: string | null
  contributo_id: string | null
  collegamento_automatico: boolean
  modificato_da_rna_at: string | null
}

interface ContributoCollegabile {
  id: string
  anno_competenza: number
  importo_contributo: number | null
  origine: string
  nome: string
}

interface DeMinimis {
  massimale: number
  finestra_da: string
  usato: number
  disponibile: number
  n_aiuti: number
  n_aiuti_collegate: number
  usato_collegate: number
  aziende_collegate: number
  altri_regimi: Array<{ regolamento: string; totale: number; n: number }>
}

interface DatiRna {
  aiuti: AiutoRna[]
  contributi_collegabili: ContributoCollegabile[]
  de_minimis: DeMinimis
  ultimo_aggiornamento: string | null
  abbinabile: boolean
}

interface Props {
  clienteId: string
  /** cambia quando la lista contributi viene ricaricata: la sezione si riallinea */
  versione: number
  /** chiamato dopo un'azione che crea, collega o elimina contributi */
  onContributiCambiati: () => void
}

// ----------------------------------------------------------------
// Formatter
// ----------------------------------------------------------------

const fmtEuro = (n: number | null | undefined) => {
  if (n == null) return '—'
  return new Intl.NumberFormat('it-IT', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0,
    useGrouping: 'always' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  }).format(n)
}
const fmtData = (d: string | null | undefined) => {
  if (!d) return '—'
  const [y, m, g] = d.slice(0, 10).split('-')
  return `${g}/${m}/${y}`
}
const fmtDataOra = (d: string | null) => d ? new Date(d).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : null

const AMBITO_LABEL: Record<AiutoRna['ambito'], string> = {
  FPI: 'Fondo interprofessionale',
  GARANZIA_PMI: 'Fondo garanzia PMI',
  ALTRO: 'Altro',
}

function badgeProcedimento(proc: string[]) {
  const p = (proc[0] || '').toLowerCase()
  if (p.includes('minimis')) return { label: 'De minimis', cls: 'bg-orange-50 text-orange-700 border-orange-200' }
  if (p.includes('esenzione')) return { label: 'Esenzione', cls: 'bg-sky-50 text-sky-700 border-sky-200' }
  if (p.includes('notifica')) return { label: 'Notifica', cls: 'bg-violet-50 text-violet-700 border-violet-200' }
  return { label: proc[0] || '—', cls: 'bg-gray-50 text-gray-600 border-gray-200' }
}

// ----------------------------------------------------------------
// Componente
// ----------------------------------------------------------------

export default function AiutiRnaSection({ clienteId, versione, onContributiCambiati }: Props) {
  const [dati, setDati] = useState<DatiRna | null>(null)
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [filtroAmbito, setFiltroAmbito] = useState<'' | AiutoRna['ambito']>('')
  const [filtroAnno, setFiltroAnno] = useState('')
  const [mostraCollegati, setMostraCollegati] = useState(false)
  const [daPromuovere, setDaPromuovere] = useState<AiutoRna | null>(null)
  const [inCorsoId, setInCorsoId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    try {
      setLoading(true)
      setErrore(null)
      const res = await fetch(`/api/clienti/${clienteId}/rna`)
      const json = await res.json()
      if (isCancelled()) return
      if (!json.success) throw new Error(json.error || 'Errore nel caricamento aiuti RNA')
      setDati(json.data)
    } catch (err) {
      if (isCancelled()) return
      setErrore(err instanceof Error ? err.message : 'Errore nel caricamento aiuti RNA')
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [clienteId])

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => { cancelled = true }
  }, [load, versione])

  const altri = useMemo(() => (dati?.aiuti || []).filter(a => !a.contributo_id), [dati])
  const collegati = useMemo(() => (dati?.aiuti || []).filter(a => a.contributo_id), [dati])
  const modificati = useMemo(() => collegati.filter(a => a.modificato_da_rna_at), [collegati])

  const anni = useMemo(() => {
    const s = new Set<number>()
    altri.forEach(a => { if (a.anno_concessione) s.add(a.anno_concessione) })
    return Array.from(s).sort((a, b) => b - a)
  }, [altri])

  const altriFiltrati = useMemo(() => altri.filter(a => {
    if (filtroAmbito && a.ambito !== filtroAmbito) return false
    if (filtroAnno && String(a.anno_concessione) !== filtroAnno) return false
    return true
  }), [altri, filtroAmbito, filtroAnno])

  const riportaTraAltri = async (a: AiutoRna) => {
    if (!confirm(
      `Riportare tra gli altri aiuti "${a.titolo_misura || a.cor}"?\n\n` +
      'Se il contributo era stato creato da RNA verrà eliminato; se era un contributo inserito a mano o da progetto resterà, ma senza collegamento a questo aiuto.'
    )) return
    try {
      setInCorsoId(a.id)
      const res = await fetch(`/api/clienti/${clienteId}/rna/${a.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.success) { showToast(json.error || 'Operazione non riuscita'); return }
      showToast('Aiuto riportato tra gli altri')
      onContributiCambiati()
    } catch {
      showToast('Errore di rete')
    } finally {
      setInCorsoId(null)
    }
  }

  const segnaVerificato = async (a: AiutoRna) => {
    try {
      setInCorsoId(a.id)
      const res = await fetch(`/api/clienti/${clienteId}/rna/${a.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione: 'verificato' }),
      })
      const json = await res.json()
      if (!json.success) { showToast(json.error || 'Operazione non riuscita'); return }
      load()
    } catch {
      showToast('Errore di rete')
    } finally {
      setInCorsoId(null)
    }
  }

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  const dm = dati?.de_minimis
  const pctUsato = dm ? Math.min(100, (dm.usato / dm.massimale) * 100) : 0
  const coloreBarra = pctUsato >= 90 ? 'bg-red-500' : pctUsato >= 70 ? 'bg-amber-500' : 'bg-primary-600'

  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-indigo-600" />
            Aiuti dal Registro Nazionale Aiuti (RNA)
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Tutti gli aiuti di Stato registrati per il cliente. Quelli seguiti da noi si portano tra i contributi con &quot;È nostro&quot;.
            {dati?.ultimo_aggiornamento && <> Ultimo aggiornamento: {fmtDataOra(dati.ultimo_aggiornamento)}.</>}
          </p>
        </div>
      </div>

      {loading && !dati ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : errore ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="text-xs text-red-700">{errore}</span>
          <button onClick={() => load()} className="ml-auto px-3 py-1 text-xs font-medium text-red-700 border border-red-300 rounded-md hover:bg-red-100">Riprova</button>
        </div>
      ) : dati && !dati.abbinabile ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600">
          Il cliente non ha codice fiscale né partita IVA in anagrafica: non è possibile abbinare gli aiuti RNA.
        </div>
      ) : dati && !dati.ultimo_aggiornamento && dati.aiuti.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600">
          L&apos;archivio RNA non è ancora stato importato.
        </div>
      ) : dati ? (
        <>
          {/* Capienza de minimis */}
          {dm && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
                Capienza de minimis (Reg. UE 2023/2831) — stima
              </div>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 mt-2">
                <div><span className="text-xs text-gray-500">Usato </span><span className="text-base font-semibold text-gray-900">{fmtEuro(dm.usato)}</span></div>
                <div><span className="text-xs text-gray-500">Disponibile </span><span className="text-base font-semibold text-gray-900">{fmtEuro(dm.disponibile)}</span></div>
                <div className="text-xs text-gray-500">su {fmtEuro(dm.massimale)} · {dm.n_aiuti} aiuti dopo il {fmtData(dm.finestra_da)}</div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
                <div className={`h-full ${coloreBarra}`} style={{ width: `${pctUsato}%` }} />
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                {dm.aziende_collegate > 0
                  ? `Comprende ${dm.n_aiuti_collegate} aiuti (${fmtEuro(dm.usato_collegate)}) di ${dm.aziende_collegate} aziende collegate presenti nel gestionale. `
                  : 'Nessuna azienda collegata registrata: se il cliente fa parte di un’impresa unica, gli aiuti delle collegate vanno sommati. '}
                Per la verifica formale fa fede la visura RNA.
              </p>
              {dm.altri_regimi.length > 0 && (
                <p className="text-[11px] text-gray-500 mt-1">
                  Altri regimi de minimis (massimali diversi, non conteggiati):{' '}
                  {dm.altri_regimi.map(r => `${r.regolamento}: ${fmtEuro(r.totale)} (${r.n})`).join(' · ')}
                </p>
              )}
            </div>
          )}

          {/* Avvisi: aiuti collegati modificati da RNA */}
          {modificati.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" />
                RNA ha modificato {modificati.length === 1 ? 'un aiuto collegato' : `${modificati.length} aiuti collegati`} ai nostri contributi: verifica importi e date.
              </div>
              <ul className="mt-2 space-y-1">
                {modificati.map(a => (
                  <li key={a.id} className="flex items-center gap-2 text-xs text-amber-900">
                    <span className="flex-1">{a.titolo_misura} · COR {a.cor} · {fmtEuro(a.importo_nominale)} (ESL {fmtEuro(a.elemento_aiuto)}) · {fmtData(a.data_concessione)}</span>
                    <button
                      onClick={() => segnaVerificato(a)}
                      disabled={inCorsoId === a.id}
                      className="px-2 py-0.5 border border-amber-300 rounded hover:bg-amber-100 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Verificato
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Altri aiuti */}
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Altri aiuti ricevuti ({altri.length})
            </h4>
            {altri.length > 0 && (
              <div className="flex items-center gap-2">
                <select value={filtroAmbito} onChange={e => setFiltroAmbito(e.target.value as '' | AiutoRna['ambito'])}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white">
                  <option value="">Tutti gli ambiti</option>
                  <option value="FPI">Fondi interprofessionali</option>
                  <option value="GARANZIA_PMI">Fondo garanzia PMI</option>
                  <option value="ALTRO">Altro</option>
                </select>
                <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white">
                  <option value="">Tutti gli anni</option>
                  {anni.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            )}
          </div>

          {altri.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg py-6 text-center text-xs text-gray-500">
              Nessun altro aiuto RNA per questo cliente.
            </div>
          ) : altriFiltrati.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg py-6 text-center text-xs text-gray-500">
              Nessun aiuto con i filtri attivi.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Data</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Misura</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Ente</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Strumento</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Nominale</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">ESL</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Regime</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">COR</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {altriFiltrati.map(a => {
                    const proc = badgeProcedimento(a.procedimenti || [])
                    const link = a.link_atto_concessione || a.link_trasparenza
                    return (
                      <tr key={a.id} className="hover:bg-gray-50 align-top">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-900">{fmtData(a.data_concessione)}</td>
                        <td className="px-3 py-2 max-w-[260px]">
                          <div className="text-gray-900 line-clamp-2">{a.titolo_misura || '—'}</div>
                          {a.ambito !== 'ALTRO' && (
                            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${a.ambito === 'FPI' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                              {a.ambito === 'FPI' && a.fondo_interprofessionale ? a.fondo_interprofessionale : AMBITO_LABEL[a.ambito]}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600 max-w-[200px]"><span className="line-clamp-2">{a.soggetto_concedente || '—'}</span></td>
                        <td className="px-3 py-2 text-gray-600 max-w-[180px]">
                          <span className="line-clamp-2" title={(a.strumenti || []).join(' + ')}>
                            {a.forma_proposta ? FORMA_LABEL[a.forma_proposta] : (a.strumenti || [])[0] || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-gray-700">{fmtEuro(a.importo_nominale)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap font-semibold text-gray-900">{fmtEuro(a.elemento_aiuto)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap ${proc.cls}`} title={(a.regolamenti || []).join('; ')}>
                            {proc.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {link ? (
                            <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-700 hover:underline"
                              title={a.link_atto_concessione ? 'Atto di concessione' : 'Pagina della misura sul sito dell’ente'}>
                              {a.cor}<ExternalLink className="w-3 h-3" />
                            </a>
                          ) : <span className="text-gray-700">{a.cor}</span>}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => setDaPromuovere(a)}
                            className="px-2 py-1 text-[11px] font-medium text-primary-700 border border-primary-200 rounded-md hover:bg-primary-50 inline-flex items-center gap-1"
                          >
                            <ArrowUpCircle className="w-3.5 h-3.5" /> È nostro
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Aiuti già collegati ai nostri contributi */}
          {collegati.length > 0 && (
            <div className="mt-4">
              <button onClick={() => setMostraCollegati(v => !v)} className="text-xs font-medium text-gray-700 flex items-center gap-1 hover:text-gray-900">
                {mostraCollegati ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Aiuti RNA collegati ai nostri contributi ({collegati.length})
              </button>
              {mostraCollegati && (
                <ul className="mt-2 bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {collegati.map(a => (
                    <li key={a.id} className="px-3 py-2 flex items-center gap-3 text-xs">
                      <span className="text-gray-500 whitespace-nowrap">{fmtData(a.data_concessione)}</span>
                      <span className="flex-1 text-gray-900">{a.titolo_misura} <span className="text-gray-500">· COR {a.cor} · ESL {fmtEuro(a.elemento_aiuto)}</span></span>
                      {a.collegamento_automatico && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200" title="Collegato automaticamente dall'importazione">auto</span>
                      )}
                      <button
                        onClick={() => riportaTraAltri(a)}
                        disabled={inCorsoId === a.id}
                        className="px-2 py-0.5 text-[11px] text-gray-600 border border-gray-300 rounded hover:bg-gray-50 inline-flex items-center gap-1"
                      >
                        {inCorsoId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
                        Riporta tra gli altri
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="text-[10px] text-gray-400 mt-4">
            Fonte: Registro Nazionale degli Aiuti di Stato – Open Data (rna.gov.it), licenza CC BY 4.0. Dati filtrati sul codice fiscale/P.IVA del cliente.
          </p>
        </>
      ) : null}

      {daPromuovere && dati && (
        <PromuoviModal
          clienteId={clienteId}
          aiuto={daPromuovere}
          collegabili={dati.contributi_collegabili}
          onClose={() => setDaPromuovere(null)}
          onFatto={(creato) => {
            setDaPromuovere(null)
            showToast(creato ? 'Contributo creato da RNA' : 'Aiuto collegato al contributo')
            onContributiCambiati()
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-gray-900 text-white text-xs px-4 py-2 rounded-lg shadow-lg">{toast}</div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Modale "È nostro"
// ----------------------------------------------------------------

function PromuoviModal({ clienteId, aiuto, collegabili, onClose, onFatto }: {
  clienteId: string
  aiuto: AiutoRna
  collegabili: ContributoCollegabile[]
  onClose: () => void
  onFatto: (creato: boolean) => void
}) {
  // Suggeriti: stesso anno ±1 (in cima alla lista)
  const ordinati = useMemo(() => {
    const anno = aiuto.anno_concessione || 0
    return collegabili.slice().sort((a, b) => {
      const da = Math.abs(a.anno_competenza - anno), db = Math.abs(b.anno_competenza - anno)
      return da - db || b.anno_competenza - a.anno_competenza
    })
  }, [collegabili, aiuto])

  const [modo, setModo] = useState<'crea' | 'collega'>('crea')
  const [forma, setForma] = useState<ContributoForma>(aiuto.forma_proposta || 'FONDO_PERDUTO')
  const [stato, setStato] = useState<ContributoStato>('CONCESSO')
  const [contributoId, setContributoId] = useState(ordinati[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const conferma = async () => {
    setErrore(null)
    if (modo === 'collega' && !contributoId) { setErrore('Scegli il contributo da collegare'); return }
    try {
      setSaving(true)
      const body = modo === 'crea'
        ? { azione: 'crea', forma_contributo: forma, stato }
        : { azione: 'collega', contributo_id: contributoId }
      const res = await fetch(`/api/clienti/${clienteId}/rna/${aiuto.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.success) { setErrore(json.error || 'Operazione non riuscita'); return }
      onFatto(!!json.data?.creato)
    } catch {
      setErrore('Errore di rete')
    } finally {
      setSaving(false)
    }
  }

  const sovvenzione = (aiuto.strumenti || []).some(s => s.toLowerCase().includes('conto interessi'))

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Porta tra i nostri contributi</h3>
          <button onClick={onClose} disabled={saving} className="p-1 text-gray-500 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4 text-xs">
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 space-y-1">
            <div className="font-medium text-gray-900">{aiuto.titolo_misura}</div>
            <div className="text-gray-600">{aiuto.soggetto_concedente}</div>
            <div className="text-gray-600">
              Concesso il {fmtData(aiuto.data_concessione)} · COR {aiuto.cor} · Nominale {fmtEuro(aiuto.importo_nominale)} · ESL {fmtEuro(aiuto.elemento_aiuto)}
            </div>
            <div className="text-gray-500">{(aiuto.regolamenti || []).join('; ')}</div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={modo === 'crea'} onChange={() => setModo('crea')} />
              <span className="font-medium text-gray-800">Crea un nuovo contributo con questi dati</span>
            </label>
            {modo === 'crea' && (
              <div className="ml-6 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1">Forma</label>
                  <select value={forma} onChange={e => setForma(e.target.value as ContributoForma)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 bg-white">
                    {FORME_CONTRIBUTO.map(f => <option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
                  </select>
                  {sovvenzione && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      RNA indica &quot;Sovvenzione/Contributo in conto interessi&quot;: scegli Fondo perduto o Contributo in c/interessi.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Stato</label>
                  <select value={stato} onChange={e => setStato(e.target.value as ContributoStato)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 bg-white">
                    {STATI_CONTRIBUTO.map(s => <option key={s} value={s}>{STATO_LABEL[s]}</option>)}
                  </select>
                </div>
                <p className="col-span-2 text-[11px] text-gray-500">
                  Il bando viene registrato con il nome della misura RNA. Dopo la creazione puoi modificarlo dal contributo, per esempio per collegarlo al catalogo bandi.
                </p>
              </div>
            )}

            <label className={`flex items-center gap-2 ${collegabili.length ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
              <input type="radio" checked={modo === 'collega'} disabled={!collegabili.length} onChange={() => setModo('collega')} />
              <span className="font-medium text-gray-800">Collega a un contributo già presente</span>
              {!collegabili.length && <span className="text-gray-500">(nessun contributo disponibile)</span>}
            </label>
            {modo === 'collega' && (
              <div className="ml-6">
                <select value={contributoId} onChange={e => setContributoId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 bg-white">
                  {ordinati.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.anno_competenza} · {c.nome} · {fmtEuro(c.importo_contributo)}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Nel contributo vengono compilati solo i campi vuoti: COR, ESL, regime, ente, link RNA e data di concessione.
                </p>
              </div>
            )}
          </div>

          {errore && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2 flex items-center gap-2 text-red-700">
              <AlertCircle className="w-3.5 h-3.5" /> {errore}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Annulla</button>
          <button onClick={conferma} disabled={saving}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 inline-flex items-center gap-1.5 disabled:opacity-60">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Conferma
          </button>
        </div>
      </div>
    </div>
  )
}
