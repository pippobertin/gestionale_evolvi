'use client'

import { useCallback, useEffect, useState } from 'react'

/** Aiuti comuni alle schermate dei registri del Modello 231. */

export const campo = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm'

export function dataIt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('it-IT') : ''
}

export function oggi() {
  return new Date().toISOString().slice(0, 10)
}

/** Lettura di un registro con ricarica, errori e invio di modifiche. */
export function useRegistro<T = any>(url: string) {
  const [dati, setDati] = useState<T | null>(null)
  const [errore, setErrore] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [inCorso, setInCorso] = useState(false)

  const carica = useCallback(async () => {
    try {
      const r = await fetch(url)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Registro non disponibile')
      setDati(d)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore')
    }
  }, [url])

  useEffect(() => { carica() }, [carica])

  const invia = async (indirizzo: string, metodo: string, corpo: BodyInit | object, ok: string) => {
    setInCorso(true); setErrore(''); setMessaggio('')
    try {
      const isForm = corpo instanceof FormData
      const r = await fetch(indirizzo, {
        method: metodo,
        headers: isForm ? undefined : { 'Content-Type': 'application/json' },
        body: isForm ? corpo : JSON.stringify(corpo)
      })
      const testo = await r.text()
      let d: any = {}
      try { d = JSON.parse(testo) } catch { throw new Error(`Il server non ha risposto correttamente (errore ${r.status})`) }
      if (!r.ok) throw new Error(d.error || 'Operazione non riuscita')
      setMessaggio(ok)
      await carica()
      return d
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore')
      return null
    } finally {
      setInCorso(false)
    }
  }

  return { dati, errore, messaggio, inCorso, invia, carica }
}

export function Avvisi({ errore, messaggio }: { errore: string; messaggio: string }) {
  return (
    <>
      {errore && <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{errore}</div>}
      {messaggio && <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">{messaggio}</div>}
    </>
  )
}
