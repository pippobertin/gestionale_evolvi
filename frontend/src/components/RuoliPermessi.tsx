'use client'

import { useEffect, useState } from 'react'
import { KeySquare, Check, Lock } from 'lucide-react'
import { LoadingSpinner } from './shared'

/**
 * Ruoli e permessi (fase 4C): gli amministratori scelgono che cosa possono fare
 * collaboratori e collaboratori limitati. Ogni modifica è annotata nel registro.
 */

type Voce = { chiave: string; etichetta: string; descrizione: string }
type Ruolo = { ruolo: string; etichetta: string }

const SEMPRE_RISERVATI = [
  'Gestione di utenti, ruoli e permessi',
  'Registro attività e ripristino delle eliminazioni',
  'Backup e prove di ripristino',
  'Impostazioni di sistema (Gmail di sistema, pianificatore, notifiche)',
  'Riconversione di un cliente in prospect'
]

export default function RuoliPermessi() {
  const [catalogo, setCatalogo] = useState<Voce[]>([])
  const [ruoli, setRuoli] = useState<Ruolo[]>([])
  const [matrice, setMatrice] = useState<Record<string, Record<string, boolean>>>({})
  const [caricamento, setCaricamento] = useState(true)
  const [inSalvataggio, setInSalvataggio] = useState<string | null>(null)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/permessi')
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Permessi non disponibili')
        setCatalogo(d.catalogo)
        setRuoli(d.ruoli)
        setMatrice(d.matrice)
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Errore')
      } finally {
        setCaricamento(false)
      }
    })()
  }, [])

  const cambia = async (ruolo: string, permesso: string, consentito: boolean) => {
    const chiave = `${ruolo}:${permesso}`
    setInSalvataggio(chiave)
    setErrore('')
    const precedente = matrice
    setMatrice(m => ({ ...m, [ruolo]: { ...(m[ruolo] || {}), [permesso]: consentito } }))
    try {
      const r = await fetch('/api/admin/permessi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruolo, permesso, consentito })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Salvataggio non riuscito')
    } catch (e) {
      setMatrice(precedente)
      setErrore(e instanceof Error ? e.message : 'Errore')
    } finally {
      setInSalvataggio(null)
    }
  }

  if (caricamento) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-3 mb-2">
        <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center">
          <KeySquare className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Ruoli e permessi</h1>
          <p className="text-gray-600 text-sm">
            Scegli che cosa possono fare collaboratori e collaboratori limitati. Le modifiche valgono entro mezzo
            minuto e restano nel registro attività.
          </p>
        </div>
      </div>

      {errore && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errore}</div>}

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Permesso</th>
              <th className="px-3 py-2 text-center w-32">Amministratore</th>
              {ruoli.map(r => <th key={r.ruolo} className="px-3 py-2 text-center w-32">{r.etichetta}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {catalogo.map(v => (
              <tr key={v.chiave} className="align-top">
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-900">{v.etichetta}</div>
                  <div className="text-xs text-gray-500">{v.descrizione}</div>
                </td>
                <td className="px-3 py-2 text-center">
                  <Check className="w-4 h-4 text-green-600 inline" aria-label="sempre consentito" />
                </td>
                {ruoli.map(r => {
                  const valore = !!matrice[r.ruolo]?.[v.chiave]
                  const chiave = `${r.ruolo}:${v.chiave}`
                  return (
                    <td key={r.ruolo} className="px-3 py-2 text-center">
                      {inSalvataggio === chiave ? (
                        <LoadingSpinner size="small" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={valore}
                          onChange={e => cambia(r.ruolo, v.chiave, e.target.checked)}
                          className="w-4 h-4 accent-blue-600 cursor-pointer"
                          aria-label={`${v.etichetta}: ${r.etichetta}`}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-500" /> Sempre riservato agli amministratori
        </h3>
        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-0.5">
          {SEMPRE_RISERVATI.map(v => <li key={v}>{v}</li>)}
        </ul>
        <p className="text-xs text-gray-500 mt-3">
          Contratti: chi ha generato una bozza non può approvarla, nemmeno se è amministratore, salvo una deroga
          motivata che resta nel registro.
        </p>
      </div>
    </div>
  )
}
