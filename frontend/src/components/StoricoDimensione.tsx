'use client'

import { useEffect, useMemo, useState } from 'react'
import { History, Plus, Pencil, Trash2, X, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { applicaDueEsercizi, dimensioniPerEsercizio, type DatiEsercizio, type LegameConStorico, type DimensioneRiconosciuta } from '@/lib/dimensioneImpresa'

/**
 * Storico per esercizio dei dati dimensionali di un cliente, con la dimensione
 * riconosciuta secondo la regola dei due esercizi consecutivi e il registro
 * delle modifiche.
 */

interface RigaEsercizio {
  id: string
  esercizio: number
  ula: number | null
  fatturato: number | null
  attivo: number | null
  fonte: string
  note: string | null
}

interface VoceRegistro {
  id: string
  origine: string
  campo: string
  valore_precedente: string | null
  valore_nuovo: string | null
  modificato_da: string | null
  modificato_il: string
}

export interface CollegamentoPerStorico {
  azienda_collegata_id: string
  tipo_collegamento: string
  percentuale_partecipazione?: number | null
  denominazione_collegata?: string
}

const FONTI: Record<string, string> = {
  bilancio: 'Bilancio',
  visura: 'Visura',
  dichiarazione_cliente: 'Dichiarazione del cliente',
  stima: 'Stima',
  altro: 'Altro'
}

const CAMPI: Record<string, string> = {
  ula: 'ULA',
  fatturato: 'Fatturato',
  attivo: 'Attivo',
  fonte: 'Fonte',
  esercizio_riferimento: 'Esercizio di riferimento',
  inserimento: 'Esercizio inserito',
  eliminazione: 'Esercizio eliminato'
}

const euro = (v: number | null) => v === null || v === undefined ? '-' : `€ ${Number(v).toLocaleString('it-IT')}`

export default function StoricoDimensione({ clienteId, collegamenti = [], modificabile = true, onAggiornato, onRiconosciuta }: {
  clienteId: string
  collegamenti?: CollegamentoPerStorico[]
  modificabile?: boolean
  onAggiornato?: () => void
  /** Riceve la dimensione riconosciuta (regola dei due esercizi) a ogni ricalcolo */
  onRiconosciuta?: (r: DimensioneRiconosciuta, numeroEsercizi: number) => void
}) {
  const { user } = useAuth()
  const [righe, setRighe] = useState<RigaEsercizio[]>([])
  const [eserciziLegami, setEserciziLegami] = useState<Record<string, DatiEsercizio[]>>({})
  const [registro, setRegistro] = useState<VoceRegistro[]>([])
  const [utenti, setUtenti] = useState<Record<string, string>>({})
  const [mostraRegistro, setMostraRegistro] = useState(false)
  const [modifica, setModifica] = useState<Partial<RigaEsercizio> | null>(null)
  const [errore, setErrore] = useState('')

  const idsLegami = collegamenti.map(c => c.azienda_collegata_id).filter(Boolean)

  const carica = async () => {
    const [{ data: es }, { data: log }] = await Promise.all([
      supabase.from('scadenze_bandi_clienti_esercizi')
        .select('id, esercizio, ula, fatturato, attivo, fonte, note')
        .eq('cliente_id', clienteId).order('esercizio', { ascending: false }),
      supabase.from('scadenze_bandi_clienti_dati_log')
        .select('id, origine, campo, valore_precedente, valore_nuovo, modificato_da, modificato_il')
        .eq('cliente_id', clienteId).order('modificato_il', { ascending: false }).limit(100)
    ])
    setRighe((es as RigaEsercizio[]) || [])
    setRegistro((log as VoceRegistro[]) || [])

    if (idsLegami.length > 0) {
      const { data: esLegami } = await supabase.from('scadenze_bandi_clienti_esercizi')
        .select('cliente_id, esercizio, ula, fatturato, attivo').in('cliente_id', idsLegami)
      const mappa: Record<string, DatiEsercizio[]> = {}
      ;(esLegami || []).forEach((r: any) => {
        (mappa[r.cliente_id] = mappa[r.cliente_id] || []).push({ esercizio: r.esercizio, ula: r.ula, fatturato: r.fatturato, attivo: r.attivo })
      })
      setEserciziLegami(mappa)
    }

    const autori = Array.from(new Set(((log as VoceRegistro[]) || []).map(v => v.modificato_da).filter(Boolean))) as string[]
    if (autori.length > 0) {
      const { data: u } = await supabase.from('scadenze_bandi_utenti').select('id, nome, cognome').in('id', autori)
      setUtenti(Object.fromEntries((u || []).map((x: any) => [x.id, `${x.nome} ${x.cognome}`])))
    }
  }

  useEffect(() => { carica() }, [clienteId, idsLegami.join(',')])

  const calcolo = useMemo(() => {
    const legami: LegameConStorico[] = collegamenti.map(c => ({
      tipo: c.tipo_collegamento,
      percentuale: c.percentuale_partecipazione,
      denominazione: c.denominazione_collegata,
      esercizi: eserciziLegami[c.azienda_collegata_id] || []
    }))
    const perAnno = dimensioniPerEsercizio(
      righe.map(r => ({ esercizio: r.esercizio, ula: r.ula, fatturato: r.fatturato, attivo: r.attivo })),
      legami
    )
    return { perAnno, riconosciuta: applicaDueEsercizi(perAnno) }
  }, [righe, eserciziLegami, collegamenti])

  useEffect(() => {
    onRiconosciuta?.(calcolo.riconosciuta, righe.length)
  }, [calcolo])

  // I valori attuali della scheda cliente seguono l'ultimo esercizio dello storico
  const allineaCliente = async (elenco: RigaEsercizio[]) => {
    const ultimo = [...elenco].sort((a, b) => b.esercizio - a.esercizio)[0]
    await supabase.from('scadenze_bandi_clienti').update(ultimo
      ? { ula: ultimo.ula, ultimo_fatturato: ultimo.fatturato, attivo_bilancio: ultimo.attivo, esercizio_riferimento: ultimo.esercizio }
      : { esercizio_riferimento: null }
    ).eq('id', clienteId)
  }

  const salva = async () => {
    setErrore('')
    if (!modifica?.esercizio || modifica.esercizio < 1990 || modifica.esercizio > 2100) {
      setErrore('Indica l\'esercizio (anno di bilancio)')
      return
    }
    const dati = {
      cliente_id: clienteId,
      esercizio: modifica.esercizio,
      ula: modifica.ula ?? null,
      fatturato: modifica.fatturato ?? null,
      attivo: modifica.attivo ?? null,
      fonte: modifica.fonte || 'altro',
      note: modifica.note || null
    }
    const { error } = modifica.id
      ? await supabase.from('scadenze_bandi_clienti_esercizi').update({ ...dati, aggiornato_da: user?.id }).eq('id', modifica.id)
      : await supabase.from('scadenze_bandi_clienti_esercizi').insert({ ...dati, inserito_da: user?.id })
    if (error) {
      setErrore(error.code === '23505' ? 'Esiste già una riga per questo esercizio' : error.message)
      return
    }
    setModifica(null)
    const { data: es } = await supabase.from('scadenze_bandi_clienti_esercizi')
      .select('id, esercizio, ula, fatturato, attivo, fonte, note').eq('cliente_id', clienteId)
    await allineaCliente((es as RigaEsercizio[]) || [])
    await carica()
    onAggiornato?.()
  }

  const elimina = async (riga: RigaEsercizio) => {
    if (!confirm(`Eliminare i dati dell'esercizio ${riga.esercizio}?`)) return
    await supabase.from('scadenze_bandi_clienti_esercizi').delete().eq('id', riga.id)
    await allineaCliente(righe.filter(r => r.id !== riga.id))
    await carica()
    onAggiornato?.()
  }

  const numero = (v: string) => v === '' ? null : Number(v)
  const { riconosciuta, perAnno } = calcolo

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">Storico per esercizio e regola dei due esercizi</h4>
        {modificabile && !modifica && (
          <button type="button" onClick={() => setModifica({ esercizio: (righe[0]?.esercizio || new Date().getFullYear() - 1) + (righe.length ? 1 : 0), fonte: 'bilancio' })}
            className="inline-flex items-center text-xs text-teal-700 border border-teal-300 rounded px-2 py-1 hover:bg-teal-50">
            <Plus className="w-3 h-3 mr-1" />Aggiungi esercizio
          </button>
        )}
      </div>

      <div className="text-sm">
        Dimensione riconosciuta:{' '}
        <strong>{riconosciuta.dimensione || 'non determinabile'}</strong>
        {riconosciuta.ultimoEsercizio && <span className="text-gray-500"> (ultimo esercizio {riconosciuta.ultimoEsercizio})</span>}
        {riconosciuta.messaggio && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">{riconosciuta.messaggio}</p>
        )}
        {righe.length === 1 && (
          <p className="text-xs text-gray-500 mt-1">Con un solo esercizio registrato la regola dei due esercizi non si può ancora applicare.</p>
        )}
      </div>

      {modifica && (
        <div className="border border-teal-200 bg-teal-50 rounded p-2 space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <input type="number" placeholder="Esercizio" value={modifica.esercizio || ''} onChange={e => setModifica({ ...modifica, esercizio: numero(e.target.value) || undefined })} className="input text-sm" />
            <input type="number" step="0.01" placeholder="ULA" value={modifica.ula ?? ''} onChange={e => setModifica({ ...modifica, ula: numero(e.target.value) })} className="input text-sm" />
            <input type="number" placeholder="Fatturato €" value={modifica.fatturato ?? ''} onChange={e => setModifica({ ...modifica, fatturato: numero(e.target.value) })} className="input text-sm" />
            <input type="number" placeholder="Attivo €" value={modifica.attivo ?? ''} onChange={e => setModifica({ ...modifica, attivo: numero(e.target.value) })} className="input text-sm" />
            <select value={modifica.fonte || 'altro'} onChange={e => setModifica({ ...modifica, fonte: e.target.value })} className="input text-sm">
              {Object.entries(FONTI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="text" placeholder="Note" value={modifica.note || ''} onChange={e => setModifica({ ...modifica, note: e.target.value })} className="input text-sm" />
          </div>
          {errore && <p className="text-xs text-red-700">{errore}</p>}
          <div className="flex space-x-2">
            <button type="button" onClick={salva} className="inline-flex items-center text-xs text-white bg-teal-600 rounded px-2 py-1 hover:bg-teal-700"><Save className="w-3 h-3 mr-1" />Salva</button>
            <button type="button" onClick={() => { setModifica(null); setErrore('') }} className="inline-flex items-center text-xs text-gray-700 border border-gray-300 rounded px-2 py-1"><X className="w-3 h-3 mr-1" />Annulla</button>
          </div>
        </div>
      )}

      {righe.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-1 pr-3">Esercizio</th><th className="py-1 pr-3">ULA</th><th className="py-1 pr-3">Fatturato</th>
                <th className="py-1 pr-3">Attivo</th><th className="py-1 pr-3">Fonte</th><th className="py-1 pr-3">Calcolata</th>
                <th className="py-1 pr-3">Riconosciuta</th>{modificabile && <th></th>}
              </tr>
            </thead>
            <tbody>
              {righe.map(r => {
                const anno = perAnno.find(p => p.esercizio === r.esercizio)
                const passo = riconosciuta.passi.find(p => p.esercizio === r.esercizio)
                return (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="py-1 pr-3 font-medium">{r.esercizio}</td>
                    <td className="py-1 pr-3">{r.ula ?? '-'}</td>
                    <td className="py-1 pr-3">{euro(r.fatturato)}</td>
                    <td className="py-1 pr-3">{euro(r.attivo)}</td>
                    <td className="py-1 pr-3" title={r.note || ''}>{FONTI[r.fonte] || r.fonte}{r.note ? ' *' : ''}</td>
                    <td className="py-1 pr-3">
                      {anno?.dimensione || 'n.d.'}
                      {anno && anno.legamiAltroEsercizio.length > 0 && (
                        <span className="block text-[10px] text-amber-700">con dati di altri esercizi: {anno.legamiAltroEsercizio.join(', ')}</span>
                      )}
                    </td>
                    <td className="py-1 pr-3 font-medium">{passo?.riconosciuta || '-'}</td>
                    {modificabile && (
                      <td className="py-1 whitespace-nowrap">
                        <button type="button" onClick={() => setModifica(r)} className="text-gray-500 hover:text-teal-700 mr-2" title="Modifica"><Pencil className="w-3 h-3" /></button>
                        <button type="button" onClick={() => elimina(r)} className="text-gray-500 hover:text-red-600" title="Elimina"><Trash2 className="w-3 h-3" /></button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-500 mt-1">* passa sulla fonte per leggere la nota. I dati presenti il 20/11/2026 sono stati attribuiti all&apos;esercizio 2025: verifica l&apos;anno.</p>
        </div>
      ) : (
        <p className="text-xs text-gray-500">Nessun esercizio registrato.</p>
      )}

      <div>
        <button type="button" onClick={() => setMostraRegistro(!mostraRegistro)} className="inline-flex items-center text-xs text-gray-600 hover:text-gray-900">
          <History className="w-3 h-3 mr-1" />{mostraRegistro ? 'Nascondi' : 'Mostra'} il registro delle modifiche ({registro.length})
        </button>
        {mostraRegistro && (
          <ul className="mt-2 space-y-1 text-xs text-gray-700 max-h-60 overflow-y-auto">
            {registro.length === 0 && <li className="text-gray-500">Nessuna modifica registrata dal 20/11/2026.</li>}
            {registro.map(v => (
              <li key={v.id} className="border-b border-gray-100 pb-1">
                <span className="text-gray-500">{new Date(v.modificato_il).toLocaleString('it-IT')}</span>
                {' · '}{v.modificato_da ? (utenti[v.modificato_da] || 'utente') : 'sistema'}
                {' · '}{v.origine === 'cliente' ? 'scheda cliente' : v.origine}
                {' · '}<strong>{CAMPI[v.campo] || v.campo}</strong>
                {v.valore_precedente !== null || v.valore_nuovo !== null ? `: ${v.valore_precedente ?? '-'} → ${v.valore_nuovo ?? '-'}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
