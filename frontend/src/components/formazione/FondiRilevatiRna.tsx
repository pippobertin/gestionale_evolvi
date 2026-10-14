'use client'

import { useState, useEffect, useMemo } from 'react'
import { Landmark, Loader2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'

/**
 * Piani formativi finanziati dai fondi interprofessionali registrati nel
 * Registro Nazionale Aiuti (RNA) per il cliente. Un piano in RNA indica che il
 * cliente è iscritto al fondo e lo sta usando; l'assenza non prova che non sia
 * iscritto (può essere iscritto senza usarlo).
 */

interface AiutoFpi {
  id: string
  cor: string
  titolo_progetto: string | null
  soggetto_concedente: string | null
  data_concessione: string | null
  elemento_aiuto: number | null
  importo_nominale: number | null
  ambito: string
  fondo_interprofessionale: string | null
}

interface AdesioneSintesi {
  sigla: string | null
  nome: string | null
  stato: string
}

const fmtEuro = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('it-IT', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  useGrouping: 'always' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
}).format(n)
const fmtData = (d: string | null) => {
  if (!d) return '—'
  const [y, m, g] = d.slice(0, 10).split('-')
  return `${g}/${m}/${y}`
}
const chiave = (s: string | null | undefined) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^FONDO/, '')

/** true se il nome del fondo RNA corrisponde alla sigla o al nome dell'adesione. */
function stessoFondo(fondoRna: string, a: AdesioneSintesi): boolean {
  const k = chiave(fondoRna)
  if (!k) return false
  return [a.sigla, a.nome].some(v => {
    const kv = chiave(v)
    return !!kv && (kv === k || kv.indexOf(k) >= 0 || k.indexOf(kv) >= 0)
  })
}

export default function FondiRilevatiRna({ clienteId, adesioni }: { clienteId: string; adesioni: AdesioneSintesi[] }) {
  const [aiuti, setAiuti] = useState<AiutoFpi[] | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [aperto, setAperto] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/clienti/${clienteId}/rna`)
        const json = await res.json()
        if (cancelled) return
        if (!json.success) throw new Error(json.error || 'Errore nel caricamento')
        setAiuti((json.data.aiuti || []).filter((a: AiutoFpi) => a.ambito === 'FPI'))
      } catch (err) {
        if (!cancelled) setErrore(err instanceof Error ? err.message : 'Errore nel caricamento')
      }
    })()
    return () => { cancelled = true }
  }, [clienteId])

  const perFondo = useMemo(() => {
    const m = new Map<string, { fondo: string; piani: AiutoFpi[]; esl: number; ultimo: string | null }>()
    ;(aiuti || []).forEach(a => {
      const f = a.fondo_interprofessionale || a.soggetto_concedente || 'Fondo non indicato'
      const g = m.get(f) || { fondo: f, piani: [], esl: 0, ultimo: null }
      g.piani.push(a)
      g.esl += Number(a.elemento_aiuto) || 0
      if (a.data_concessione && (!g.ultimo || a.data_concessione > g.ultimo)) g.ultimo = a.data_concessione
      m.set(f, g)
    })
    return Array.from(m.values()).sort((x, y) => (y.ultimo || '').localeCompare(x.ultimo || ''))
  }, [aiuti])

  const attive = adesioni.filter(a => a.stato === 'ATTIVA')
  const fondiSenzaAdesione = perFondo.filter(g => !attive.some(a => stessoFondo(g.fondo, a)))
  const limite24 = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10)
  const adesioniInattive = attive.filter(a => !perFondo.some(g =>
    (a.sigla || a.nome) && stessoFondo(g.fondo, a) && (g.ultimo || '') > limite24))

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <Landmark className="w-4 h-4 text-indigo-600" />
        Fondi interprofessionali rilevati dal Registro Nazionale Aiuti
      </h4>
      <p className="text-xs text-gray-500 mt-0.5">
        Piani formativi finanziati registrati in RNA. Un piano indica che l&apos;azienda è iscritta al fondo e lo usa; l&apos;assenza non esclude l&apos;iscrizione.
      </p>

      {errore ? (
        <p className="text-xs text-red-600 mt-3">{errore}</p>
      ) : aiuti === null ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
      ) : (
        <>
          {(fondiSenzaAdesione.length > 0 || adesioniInattive.length > 0) && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md p-2.5 space-y-1">
              {fondiSenzaAdesione.map(g => (
                <p key={g.fondo} className="text-xs text-amber-800 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  RNA mostra piani finanziati da <strong>{g.fondo}</strong> (ultimo il {fmtData(g.ultimo)}), ma nel gestionale non c&apos;è un&apos;adesione attiva a questo fondo.
                </p>
              ))}
              {adesioniInattive.map((a, i) => (
                <p key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  Adesione attiva a <strong>{a.sigla || a.nome}</strong> senza piani finanziati in RNA negli ultimi 24 mesi.
                </p>
              ))}
            </div>
          )}

          {perFondo.length === 0 ? (
            <p className="text-xs text-gray-500 mt-3">Nessun piano di fondi interprofessionali registrato in RNA per questa azienda.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100 border border-gray-200 rounded-md">
              {perFondo.map(g => (
                <li key={g.fondo}>
                  <button
                    onClick={() => setAperto(aperto === g.fondo ? null : g.fondo)}
                    className="w-full px-3 py-2 flex items-center gap-3 text-xs hover:bg-gray-50 text-left"
                  >
                    {aperto === g.fondo ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
                    <span className="font-medium text-gray-900 flex-1">{g.fondo}</span>
                    <span className="text-gray-600">{g.piani.length} {g.piani.length === 1 ? 'piano' : 'piani'}</span>
                    <span className="text-gray-600">ultimo {fmtData(g.ultimo)}</span>
                    <span className="font-semibold text-gray-900 w-24 text-right">{fmtEuro(g.esl)}</span>
                  </button>
                  {aperto === g.fondo && (
                    <table className="w-full text-xs bg-gray-50">
                      <tbody>
                        {g.piani.map(p => (
                          <tr key={p.id} className="border-t border-gray-100">
                            <td className="pl-9 pr-3 py-1.5 text-gray-600 whitespace-nowrap">{fmtData(p.data_concessione)}</td>
                            <td className="px-3 py-1.5 text-gray-800">{p.titolo_progetto || '—'}</td>
                            <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">COR {p.cor}</td>
                            <td className="px-3 py-1.5 text-right text-gray-800 whitespace-nowrap">{fmtEuro(p.elemento_aiuto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-gray-400 mt-2">Fonte: Registro Nazionale degli Aiuti di Stato – Open Data, licenza CC BY 4.0.</p>
        </>
      )}
    </div>
  )
}
