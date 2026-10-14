// Helper condivisi dalle route API /api/clienti/[id]/contributi/*

// Select con join su bando e progetto, usata da lista e dettaglio
export const CONTRIBUTO_SELECT = `
  *,
  bando:scadenze_bandi_bandi!bando_id(id, nome, codice_bando, ente_erogatore),
  progetto:scadenze_bandi_progetti!progetto_id(id, codice_progetto, titolo_progetto, stato)
`

// Codici Postgres da restituire come 400 invece che 500:
// 23503 = FK (bando inesistente), 23514 = CHECK, 22P02 = formato (es. uuid), 22003 = overflow numerico
export const PG_CODICI_ERRORE_CLIENT = ['23503', '23514', '22P02', '22003']

export class ValidationError extends Error {}

/** null/undefined/'' -> null; numero valido (entro i limiti) -> number; altrimenti ValidationError */
export function parseNumero(
  v: unknown,
  campo: string,
  limiti?: { min?: number; max?: number }
): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) throw new ValidationError(`${campo}: valore numerico non valido`)
  if (limiti?.min !== undefined && n < limiti.min) throw new ValidationError(`${campo}: deve essere almeno ${limiti.min}`)
  if (limiti?.max !== undefined && n > limiti.max) throw new ValidationError(`${campo}: deve essere al massimo ${limiti.max}`)
  return n
}

/** null/undefined/'' (anche solo spazi) -> null; stringa -> trim */
export function parseTesto(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** null/undefined/'' -> null; 'YYYY-MM-DD' -> stringa; altrimenti ValidationError */
export function parseData(v: unknown, campo: string): string | null {
  const s = parseTesto(v)
  if (s === null) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
    throw new ValidationError(`${campo}: data non valida (formato atteso YYYY-MM-DD)`)
  }
  return s
}

/** Intero 1990-2100 oppure ValidationError */
export function parseAnno(v: unknown): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1990 || n > 2100) {
    throw new ValidationError('anno_competenza obbligatorio (intero tra 1990 e 2100)')
  }
  return n
}
