/**
 * Dimensione d'impresa secondo la Raccomandazione 2003/361/CE (allegato) e il
 * DM Attività produttive 18/04/2005 che la recepisce.
 *
 * Regola (art. 2): un'impresa rientra in una categoria se ha MENO effettivi
 * (ULA) della soglia E, in aggiunta, un fatturato annuo OPPURE un totale di
 * bilancio (attivo) NON SUPERIORE al massimale. Il limite sulle ULA è
 * obbligatorio; dei due massimali economici basta rispettarne uno.
 * Esempio: 5 ULA, fatturato 3 M€, attivo 1 M€ -> MICRO (ULA < 10 e attivo ≤ 2 M€).
 *
 * Imprese associate e collegate (art. 3 e 6):
 *  - ASSOCIATA: partecipazione dal 25% al 50% (senza controllo). I suoi dati si
 *    sommano in proporzione alla percentuale.
 *  - COLLEGATA: maggioranza dei diritti di voto (oltre il 50%) o influenza
 *    dominante. I suoi dati si sommano al 100%.
 *
 * Non applicata qui: la regola dei due esercizi consecutivi (art. 4), che
 * richiede i dati di più anni.
 *
 * Stesse soglie e stessa regola della colonna calcolata `dimensione` della
 * tabella scadenze_bandi_clienti (migrazione 20261120_dimensione_impresa).
 */

export type Dimensione = 'MICRO' | 'PICCOLA' | 'MEDIA' | 'GRANDE'
export type TipoCollegamento = 'COLLEGATA' | 'ASSOCIATA'

export const SOGLIE_DIMENSIONE: Array<{ dimensione: Dimensione; ula: number; fatturato: number; attivo: number }> = [
  { dimensione: 'MICRO', ula: 10, fatturato: 2_000_000, attivo: 2_000_000 },
  { dimensione: 'PICCOLA', ula: 50, fatturato: 10_000_000, attivo: 10_000_000 },
  { dimensione: 'MEDIA', ula: 250, fatturato: 50_000_000, attivo: 43_000_000 },
]

type Numero = number | string | null | undefined

function num(v: Numero): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Classifica una singola impresa (o un insieme già aggregato).
 * null se i dati non bastano: servono le ULA e almeno uno tra fatturato e attivo.
 */
export function classificaDimensione(ula: Numero, fatturato: Numero, attivo: Numero): Dimensione | null {
  const u = num(ula), f = num(fatturato), a = num(attivo)
  if (u === null || (f === null && a === null)) return null
  for (const s of SOGLIE_DIMENSIONE) {
    const economicoOk = (f !== null && f <= s.fatturato) || (a !== null && a <= s.attivo)
    if (u < s.ula && economicoOk) return s.dimensione
  }
  return 'GRANDE'
}

/** Quota dei dati dell'impresa legata da sommare: 100% se collegata, la percentuale se associata. */
export function quotaCollegamento(tipo: string | null | undefined, percentuale: Numero): number {
  if (tipo === 'COLLEGATA') return 1
  if (tipo === 'ASSOCIATA') return Math.min(Math.max((num(percentuale) || 0) / 100, 0), 1)
  return 0
}

/** Tipo previsto dalla norma per una partecipazione: collegata oltre il 50% o con influenza dominante. */
export function tipoCollegamentoPrevisto(percentuale: Numero, influenzaDominante?: boolean | null): TipoCollegamento {
  return influenzaDominante || (num(percentuale) || 0) > 50 ? 'COLLEGATA' : 'ASSOCIATA'
}

export interface DatiImpresa { ula?: Numero; fatturato?: Numero; attivo?: Numero }
export interface LegameImpresa extends DatiImpresa {
  tipo: string | null | undefined
  percentuale?: Numero
}

export interface DimensioneAggregata {
  dimensione: Dimensione | null
  ula: number | null
  fatturato: number | null
  attivo: number | null
  /** true se almeno un'impresa associata o collegata non ha i dati: il risultato può essere sottostimato */
  datiIncompleti: boolean
}

/** Somma i dati dell'impresa e delle sue associate/collegate e classifica il totale. */
export function dimensioneAggregata(base: DatiImpresa, legami: LegameImpresa[] = []): DimensioneAggregata {
  let ula = num(base.ula)
  let fatturato = num(base.fatturato)
  let attivo = num(base.attivo)
  let datiIncompleti = false

  for (const l of legami) {
    const q = quotaCollegamento(l.tipo, l.percentuale)
    if (q === 0) continue
    const u = num(l.ula), f = num(l.fatturato), a = num(l.attivo)
    if (u === null || (f === null && a === null)) datiIncompleti = true
    if (ula !== null && u !== null) ula += u * q
    if (fatturato !== null && f !== null) fatturato += f * q
    if (attivo !== null && a !== null) attivo += a * q
  }

  return { dimensione: classificaDimensione(ula, fatturato, attivo), ula, fatturato, attivo, datiIncompleti }
}

export const ETICHETTE_COLLEGAMENTO: Record<TipoCollegamento, { breve: string; descrizione: string }> = {
  ASSOCIATA: { breve: 'Associata', descrizione: 'dal 25% al 50%, somma in proporzione alla quota' },
  COLLEGATA: { breve: 'Collegata', descrizione: 'oltre il 50% o influenza dominante, somma al 100%' },
}
