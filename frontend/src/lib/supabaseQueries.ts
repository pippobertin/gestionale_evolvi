/**
 * Utility di lettura per evitare richieste ripetute al database.
 */

type PageResult<T> = PromiseLike<{ data: T[] | null; error: any }>

/**
 * Legge tutte le righe di una query paginando a blocchi.
 * PostgREST (Supabase) restituisce al massimo 1000 righe per richiesta:
 * senza paginazione le righe oltre il limite verrebbero perse senza avvisi.
 *
 * Esempio:
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase.from('tabella').select('id').order('id').range(from, to))
 */
export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PageResult<T>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildPage(from, from + pageSize - 1)
    if (error) throw error
    const rows = data || []
    all.push(...rows)
    if (rows.length < pageSize) break
  }
  return all
}

/**
 * Conta le occorrenze di un valore di colonna (es. progetti per cliente)
 * a partire da un elenco di righe già letto con una sola query.
 */
export function countByKey<T extends Record<string, any>>(rows: T[], key: keyof T): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const value = row[key]
    if (value === null || value === undefined) continue
    const k = String(value)
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  return counts
}
