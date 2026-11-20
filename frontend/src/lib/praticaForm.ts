import { NextResponse } from 'next/server'
import { caricaAllegatoPratica } from './allegatiPratica'

/** Aiuti comuni alle API della pratica che ricevono moduli con allegati. */

export function campo(form: FormData, chiave: string): string {
  return String(form.get(chiave) || '').trim()
}

export function dataValida(valore: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valore)
}

/** Carica il file del modulo, se presente, nella sottocartella indicata del progetto. */
export async function allegatoDalModulo(form: FormData, chiave: string, progettoId: string, sottocartella: string, prefisso: string) {
  const file = form.get(chiave)
  if (!(file instanceof File) || file.size === 0) return { id: null as string | null, url: null as string | null }
  const caricato = await caricaAllegatoPratica(progettoId, file, sottocartella, prefisso)
  return { id: caricato.id, url: caricato.url }
}

/** Risposta di errore del database: requisiti mancanti e permessi diventano messaggi chiari. */
export function erroreDatabase(error: { message: string; code?: string; hint?: string }) {
  return NextResponse.json(
    { error: error.message, code: error.hint === 'REQUISITI_MANCANTI' ? 'REQUISITI_MANCANTI' : undefined },
    { status: error.code === '42501' ? 403 : 400 }
  )
}
