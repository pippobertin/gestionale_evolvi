'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Trophy, Plus, Edit, Trash2, Download, ExternalLink,
  Euro, TrendingUp, Calendar, Filter, Loader2, AlertCircle
} from 'lucide-react'
import {
  FORMA_LABEL, STATO_LABEL,
  type ContributoWithJoins, type ContributoForma, type ContributoStato, type ContributoOrigine
} from '@/lib/contributi/types'
import { escludiDaiTotali, type RiepilogoContributi } from '@/lib/contributi/riepilogo'
import ContributoFormModal from './ContributoFormModal'
import AiutiRnaSection from './AiutiRnaSection'

interface ContributiOttenutiManagerProps {
  clienteId: string
}

// ----------------------------------------------------------------
// Formatter e mappe colori
// ----------------------------------------------------------------

const fmtEuro = (n: number | null | undefined) => {
  if (n == null) return '—'
  // minimumFractionDigits esplicito: con EUR il default è 2 e alcuni browser
  // lanciano RangeError se maximumFractionDigits < minimumFractionDigits
  return new Intl.NumberFormat('it-IT', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

const fmtData = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT')
}

const fmtPct = (n: number | null | undefined) => {
  if (n == null) return '—'
  return `${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 2 })}%`
}

const FORMA_BADGE: Record<ContributoForma, string> = {
  FONDO_PERDUTO: 'bg-green-100 text-green-700',
  CREDITO_IMPOSTA: 'bg-blue-100 text-blue-700',
  FINANZIAMENTO_AGEVOLATO: 'bg-purple-100 text-purple-700',
  GARANZIA: 'bg-amber-100 text-amber-700',
  CONTRIBUTO_INTERESSI: 'bg-cyan-100 text-cyan-700',
  MISTO: 'bg-gray-100 text-gray-700',
}

const STATO_BADGE: Record<ContributoStato, string> = {
  AMMESSO: 'bg-yellow-100 text-yellow-700',
  CONCESSO: 'bg-blue-100 text-blue-700',
  EROGATO_PARZIALE: 'bg-cyan-100 text-cyan-700',
  EROGATO_TOTALE: 'bg-green-100 text-green-700',
  REVOCATO: 'bg-red-100 text-red-700',
  RINUNCIATO: 'bg-gray-200 text-gray-600',
}

export default function ContributiOttenutiManager({ clienteId }: ContributiOttenutiManagerProps) {
  const [contributi, setContributi] = useState<ContributoWithJoins[]>([])
  const [riepilogo, setRiepilogo] = useState<RiepilogoContributi | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtroAnno, setFiltroAnno] = useState<string>('')         // '' = tutti
  const [filtroForma, setFiltroForma] = useState<ContributoForma | ''>('')
  const [filtroStato, setFiltroStato] = useState<ContributoStato | ''>('')
  const [filtroOrigine, setFiltroOrigine] = useState<'' | ContributoOrigine>('')
  const [errore, setErrore] = useState<string | null>(null)
  // undefined = modale chiusa, null = nuovo contributo, oggetto = modifica
  const [inModifica, setInModifica] = useState<ContributoWithJoins | null | undefined>(undefined)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [esportando, setEsportando] = useState(false)
  // Incrementato a ogni ricarica dei contributi: la sezione RNA si riallinea
  const [versione, setVersione] = useState(0)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  // ----------------------------------------------------------------
  // Caricamento dati (lista + riepilogo in parallelo)
  // ----------------------------------------------------------------
  const loadDati = useCallback(async (isCancelled: () => boolean = () => false) => {
    try {
      setLoading(true)
      setErrore(null)
      const [resLista, resRiep] = await Promise.all([
        fetch(`/api/clienti/${clienteId}/contributi`),
        fetch(`/api/clienti/${clienteId}/contributi/riepilogo`),
      ])
      const [jsonLista, jsonRiep] = await Promise.all([resLista.json(), resRiep.json()])
      if (isCancelled()) return

      if (!jsonLista.success) throw new Error(jsonLista.error || 'Errore nel caricamento contributi')
      if (!jsonRiep.success) throw new Error(jsonRiep.error || 'Errore nel caricamento riepilogo')

      setContributi(jsonLista.data || [])
      setRiepilogo(jsonRiep.data)
      setVersione(v => v + 1)
    } catch (err) {
      if (isCancelled()) return
      console.error('[ContributiOttenutiManager] Error:', err)
      setErrore(err instanceof Error ? err.message : 'Errore nel caricamento contributi')
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [clienteId])

  useEffect(() => {
    // Evita che una risposta lenta di un cliente precedente sovrascriva i dati
    let cancelled = false
    loadDati(() => cancelled)
    return () => { cancelled = true }
  }, [loadDati])

  // ----------------------------------------------------------------
  // Filtri (in memoria)
  // ----------------------------------------------------------------
  const contributiFiltrati = useMemo(() => {
    return contributi.filter(c => {
      if (filtroAnno && String(c.anno_competenza) !== filtroAnno) return false
      if (filtroForma && c.forma_contributo !== filtroForma) return false
      if (filtroStato && c.stato !== filtroStato) return false
      if (filtroOrigine && c.origine !== filtroOrigine) return false
      return true
    })
  }, [contributi, filtroAnno, filtroForma, filtroStato, filtroOrigine])

  const anniDisponibili = useMemo(() => {
    const set = new Set(contributi.map(c => c.anno_competenza))
    return Array.from(set).sort((a, b) => b - a)
  }, [contributi])

  const hasFiltriAttivi = !!(filtroAnno || filtroForma || filtroStato || filtroOrigine)

  const resetFiltri = () => {
    setFiltroAnno('')
    setFiltroForma('')
    setFiltroStato('')
    setFiltroOrigine('')
  }

  const apriNuovo = () => setInModifica(null)

  const handleSalvato = () => {
    showToast(inModifica ? 'Contributo aggiornato' : 'Contributo creato')
    setInModifica(undefined)
    loadDati()
  }

  // Export PDF con i filtri attivi del tab
  const handleEsportaPdf = async () => {
    const qs = new URLSearchParams()
    if (filtroAnno) qs.set('anno', filtroAnno)
    if (filtroForma) qs.set('forma', filtroForma)
    if (filtroStato) qs.set('stato', filtroStato)
    if (filtroOrigine) qs.set('origine', filtroOrigine)
    const query = qs.toString()

    try {
      setEsportando(true)
      const res = await fetch(`/api/clienti/${clienteId}/contributi/export-pdf${query ? `?${query}` : ''}`)
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        showToast(json?.error || 'Errore nella generazione del PDF')
        return
      }

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="?([^";]+)"?/)
      const filename = match?.[1] || `Contributi_${new Date().toISOString().slice(0, 10)}.pdf`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Revoca rimandata: alcuni browser annullano il download se l'URL sparisce subito
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error('[ContributiOttenutiManager] Export PDF error:', err)
      showToast('Errore di rete')
    } finally {
      setEsportando(false)
    }
  }

  const handleElimina = async (c: ContributoWithJoins) => {
    const nome = c.bando?.nome || c.bando_denominazione_manuale || 'questo contributo'
    if (!confirm(`Eliminare il contributo "${nome}" (${c.anno_competenza})? L'operazione non è reversibile.`)) return
    try {
      setEliminandoId(c.id)
      const res = await fetch(`/api/clienti/${clienteId}/contributi/${c.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.success) {
        showToast(json.error || 'Errore nell\'eliminazione')
        return
      }
      showToast('Contributo eliminato')
      loadDati()
    } catch (err) {
      console.error('[ContributiOttenutiManager] Delete error:', err)
      showToast('Errore di rete')
    } finally {
      setEliminandoId(null)
    }
  }

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  const kpi = [
    { icon: Euro, label: 'Totale contributi', value: fmtEuro(riepilogo?.totale_contributi) },
    { icon: TrendingUp, label: 'Totale ESL', value: fmtEuro(riepilogo?.totale_esl) },
    {
      icon: Trophy,
      label: 'Numero contributi',
      value: String(riepilogo?.numero_righe ?? '—'),
      nota: riepilogo && riepilogo.esclusi_dai_totali > 0
        ? `+ ${riepilogo.esclusi_dai_totali} revocati/rinunciati esclusi`
        : null,
    },
    {
      icon: Calendar,
      label: 'Anni coperti',
      value: riepilogo?.anno_primo_contributo != null && riepilogo?.anno_ultimo_contributo != null
        ? (riepilogo.anno_primo_contributo === riepilogo.anno_ultimo_contributo
          ? String(riepilogo.anno_primo_contributo)
          : `${riepilogo.anno_primo_contributo} – ${riepilogo.anno_ultimo_contributo}`)
        : '—',
    },
  ]

  return (
    <div>
      {/* A. Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary-600" />
            Contributi Ottenuti
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Storico delle agevolazioni pubbliche ricevute dal cliente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEsportaPdf}
            disabled={esportando || contributi.length === 0}
            title={contributi.length === 0 ? 'Nessun contributo da esportare' : undefined}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {esportando
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Download className="w-3.5 h-3.5" />}
            Esporta PDF
          </button>
          <button
            onClick={apriNuovo}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Aggiungi contributo
          </button>
        </div>
      </div>

      {/* Errore */}
      {errore && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="text-xs text-red-700">{errore}</span>
          <button
            onClick={() => loadDati()}
            className="ml-auto px-3 py-1 text-xs font-medium text-red-700 border border-red-300 rounded-md hover:bg-red-100"
          >
            Riprova
          </button>
        </div>
      )}

      {/* B. KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {riepilogo === null && loading
          ? [0, 1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 animate-pulse">
              <div className="h-3 w-24 bg-gray-200 rounded" />
              <div className="h-6 w-20 bg-gray-200 rounded mt-2" />
            </div>
          ))
          : kpi.map(({ icon: Icon, label, value, nota }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </div>
              <div className="text-xl font-semibold text-gray-900 mt-1">
                {value}
              </div>
              {nota && <div className="text-[11px] text-gray-400 mt-0.5">{nota}</div>}
            </div>
          ))}
      </div>

      {loading && contributi.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : errore && contributi.length === 0 ? null : contributi.length === 0 ? (
        /* Lista vuota */
        <div className="bg-white border border-gray-200 rounded-lg py-10 flex flex-col items-center text-center">
          <Trophy className="w-8 h-8 text-gray-300" />
          <p className="text-sm text-gray-600 mt-2">Nessun contributo ottenuto registrato</p>
          <button
            onClick={apriNuovo}
            className="mt-3 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Aggiungi contributo
          </button>
        </div>
      ) : (
        <>
          {/* C. Filtri */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-700">Filtri</span>
              {hasFiltriAttivi && (
                <button onClick={resetFiltri} className="ml-auto text-xs text-primary-600 hover:underline">
                  Reset
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <select
                value={filtroAnno}
                onChange={e => setFiltroAnno(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">Tutti gli anni</option>
                {anniDisponibili.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select
                value={filtroForma}
                onChange={e => setFiltroForma(e.target.value as ContributoForma | '')}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">Tutte le forme</option>
                {Object.entries(FORMA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select
                value={filtroStato}
                onChange={e => setFiltroStato(e.target.value as ContributoStato | '')}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">Tutti gli stati</option>
                {Object.entries(STATO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select
                value={filtroOrigine}
                onChange={e => setFiltroOrigine(e.target.value as '' | ContributoOrigine)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">Tutte le origini</option>
                <option value="DA_PROGETTO">Da progetto</option>
                <option value="MANUALE">Manuale</option>
                <option value="DA_RNA">Da RNA</option>
              </select>
            </div>
          </div>

          {/* D. Tabella */}
          {contributiFiltrati.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg py-6 flex flex-col items-center text-center">
              <p className="text-xs text-gray-600">Nessun contributo con i filtri attivi</p>
              <button onClick={resetFiltri} className="mt-2 text-xs font-medium text-primary-600 hover:underline">
                Reset filtri
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Anno</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Bando</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Ente</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Forma</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Imp. progetto</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Contributo</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">ESL</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Intensità</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Stato</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Origine</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">RNA</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contributiFiltrati.map(c => {
                    const nomeBando = c.bando?.nome || c.bando_denominazione_manuale || '—'
                    const orfano = c.origine === 'DA_PROGETTO' && c.progetto_id === null
                    const eliminabile = !(c.origine === 'DA_PROGETTO' && c.progetto_id !== null)
                    // Revocati/rinunciati: visibili ma in grigio, come nel PDF (fuori dai totali)
                    const escluso = escludiDaiTotali(c.stato)
                    const tx = (cls: string) => (escluso ? 'text-gray-400' : cls)

                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td
                          className={`px-3 py-2 font-medium ${tx('text-gray-900')}`}
                          title={c.data_concessione ? `Concessione: ${fmtData(c.data_concessione)}` : undefined}
                        >
                          {c.anno_competenza}
                        </td>
                        <td className={`px-3 py-2 max-w-[220px] ${tx('text-gray-900')}`}>
                          {c.bando_id ? (
                            // Collegamento alla scheda bando: Fase 6
                            <a
                              href="#"
                              onClick={e => e.preventDefault()}
                              className={`hover:underline line-clamp-2 ${tx('text-primary-700')}`}
                            >
                              {nomeBando}
                            </a>
                          ) : (
                            <span className="line-clamp-2">{nomeBando}</span>
                          )}
                        </td>
                        <td className={`px-3 py-2 ${tx('text-gray-600')}`}>
                          {c.bando?.ente_erogatore || c.ente_erogatore || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${FORMA_BADGE[c.forma_contributo]}`}>
                            {FORMA_LABEL[c.forma_contributo]}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right whitespace-nowrap ${tx('text-gray-700')}`}>
                          {fmtEuro(c.importo_progetto)}
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${tx('text-gray-900')}`}>
                          {fmtEuro(c.importo_contributo)}
                        </td>
                        <td className={`px-3 py-2 text-right whitespace-nowrap ${c.esl == null ? 'text-gray-400' : tx('text-gray-700')}`}>
                          {fmtEuro(c.esl)}
                        </td>
                        <td className={`px-3 py-2 text-right whitespace-nowrap ${tx('text-gray-700')}`}>
                          {fmtPct(c.intensita_aiuto_pct)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${STATO_BADGE[c.stato]}`}>
                            {STATO_LABEL[c.stato]}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {orfano ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              Progetto cancellato
                            </span>
                          ) : c.origine === 'DA_PROGETTO' ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-50 text-primary-700 border border-primary-200">
                                Progetto
                              </span>
                              {c.progetto?.codice_progetto && (
                                <span className="text-[10px] text-gray-500">{c.progetto.codice_progetto}</span>
                              )}
                            </span>
                          ) : c.origine === 'DA_RNA' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Da RNA
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-200">
                              Manuale
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {c.rna_url ? (
                            <a
                              href={c.rna_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={c.rna_codice_concessione ? `RNA – COR ${c.rna_codice_concessione}` : 'Apri su RNA'}
                              className="inline-flex text-primary-600 hover:text-primary-700"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setInModifica(c)}
                              title={c.origine === 'DA_PROGETTO' ? 'Modifica (campi importi gestiti dal progetto)' : 'Modifica'}
                              className="p-1 text-gray-500 hover:text-primary-600 rounded"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { if (eliminabile) handleElimina(c) }}
                              disabled={!eliminabile || eliminandoId === c.id}
                              title={eliminabile ? 'Elimina' : 'Cancella il progetto per eliminare questo contributo'}
                              className={`p-1 rounded ${eliminabile ? 'text-gray-500 hover:text-red-600' : 'opacity-30 cursor-not-allowed text-gray-500'}`}
                            >
                              {eliminandoId === c.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Aiuti dal Registro Nazionale Aiuti: altri aiuti, "È nostro", capienza de minimis */}
      <AiutiRnaSection clienteId={clienteId} versione={versione} onContributiCambiati={() => loadDati()} />

      {inModifica !== undefined && (
        <ContributoFormModal
          clienteId={clienteId}
          contributo={inModifica}
          onClose={() => setInModifica(undefined)}
          onSaved={handleSalvato}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-[60] bg-gray-900 text-white text-xs px-3 py-2 rounded-md shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
