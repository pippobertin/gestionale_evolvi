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

// ---------------------------------------------------------------------------
// Storico per esercizio e regola dei due esercizi consecutivi (art. 4)
// ---------------------------------------------------------------------------

const ORDINE_DIMENSIONI: Dimensione[] = ['MICRO', 'PICCOLA', 'MEDIA', 'GRANDE']

export interface DatiEsercizio extends DatiImpresa {
  esercizio: number
}

export interface LegameConStorico {
  tipo: string | null | undefined
  percentuale?: Numero
  denominazione?: string
  esercizi: DatiEsercizio[]
}

export interface DimensioneEsercizio {
  esercizio: number
  dimensione: Dimensione | null
  datiIncompleti: boolean
  /** Imprese associate/collegate di cui si sono usati i dati di un altro esercizio */
  legamiAltroEsercizio: string[]
}

/**
 * Dimensione di ogni esercizio, sommando le imprese associate e collegate.
 * Per ciascuna si usano i dati dello stesso esercizio; se mancano, l'ultimo
 * esercizio disponibile (segnalato in legamiAltroEsercizio).
 */
export function dimensioniPerEsercizio(base: DatiEsercizio[], legami: LegameConStorico[] = []): DimensioneEsercizio[] {
  return [...base]
    .sort((a, b) => a.esercizio - b.esercizio)
    .map(e => {
      const legamiAltroEsercizio: string[] = []
      const legamiAnno: LegameImpresa[] = legami.map(l => {
        const stesso = l.esercizi.find(x => x.esercizio === e.esercizio)
        const scelto = stesso || [...l.esercizi].sort((a, b) => b.esercizio - a.esercizio)[0]
        if (!stesso && scelto) legamiAltroEsercizio.push(`${l.denominazione || 'impresa legata'} (${scelto.esercizio})`)
        return { tipo: l.tipo, percentuale: l.percentuale, ula: scelto?.ula, fatturato: scelto?.fatturato, attivo: scelto?.attivo }
      })
      const r = dimensioneAggregata(e, legamiAnno)
      return { esercizio: e.esercizio, dimensione: r.dimensione, datiIncompleti: r.datiIncompleti, legamiAltroEsercizio }
    })
}

export interface PassoDimensione {
  esercizio: number
  calcolata: Dimensione | null
  riconosciuta: Dimensione | null
}

export interface DimensioneRiconosciuta {
  /** Dimensione da usare: cambia solo se le soglie sono superate (o rientrate) per due esercizi consecutivi */
  dimensione: Dimensione | null
  /** Dimensione calcolata sull'ultimo esercizio disponibile */
  ultimaCalcolata: Dimensione | null
  ultimoEsercizio: number | null
  /** true se l'ultimo esercizio indica una categoria diversa, non ancora confermata */
  inAttesaDiConferma: boolean
  messaggio: string | null
  passi: PassoDimensione[]
}

/**
 * Regola dei due esercizi consecutivi (Racc. 2003/361/CE, allegato, art. 4):
 * la categoria cambia solo se le soglie risultano superate, o non più
 * raggiunte, per due esercizi consecutivi. Al primo esercizio disponibile si
 * usa la categoria calcolata (per le imprese nuove l'art. 4, par. 3 ammette
 * anche stime). Se tra due esercizi manca un anno, il cambio non è confermato.
 * Quando i due esercizi indicano categorie diverse nella stessa direzione si
 * passa alla più vicina a quella attuale (esempio: MICRO, poi PICCOLA e MEDIA
 * -> PICCOLA, perché solo le soglie della micro sono superate due volte).
 */
export function applicaDueEsercizi(esercizi: Array<{ esercizio: number; dimensione: Dimensione | null }>): DimensioneRiconosciuta {
  const validi = esercizi.filter(e => e.dimensione !== null).sort((a, b) => a.esercizio - b.esercizio)
  if (validi.length === 0) {
    return { dimensione: null, ultimaCalcolata: null, ultimoEsercizio: null, inAttesaDiConferma: false, messaggio: null, passi: [] }
  }
  const peso = (d: Dimensione) => ORDINE_DIMENSIONI.indexOf(d)
  let riconosciuta = validi[0].dimensione as Dimensione
  const passi: PassoDimensione[] = [{ esercizio: validi[0].esercizio, calcolata: riconosciuta, riconosciuta }]

  for (let i = 1; i < validi.length; i++) {
    const prec = validi[i - 1]
    const corr = validi[i]
    const dCorr = corr.dimensione as Dimensione
    const dPrec = prec.dimensione as Dimensione
    const consecutivi = corr.esercizio === prec.esercizio + 1
    if (dCorr !== riconosciuta && consecutivi && dPrec !== riconosciuta) {
      const versoCorr = Math.sign(peso(dCorr) - peso(riconosciuta))
      const versoPrec = Math.sign(peso(dPrec) - peso(riconosciuta))
      if (versoCorr === versoPrec) {
        riconosciuta = Math.abs(peso(dCorr) - peso(riconosciuta)) <= Math.abs(peso(dPrec) - peso(riconosciuta)) ? dCorr : dPrec
      }
    }
    passi.push({ esercizio: corr.esercizio, calcolata: dCorr, riconosciuta })
  }

  const ultimo = validi[validi.length - 1]
  const ultimaCalcolata = ultimo.dimensione as Dimensione
  const inAttesaDiConferma = ultimaCalcolata !== riconosciuta
  const etichetta = (d: Dimensione) => d.toLowerCase()
  const messaggio = inAttesaDiConferma
    ? `Nell'esercizio ${ultimo.esercizio} i dati indicano un'impresa ${etichetta(ultimaCalcolata)}: resta ${etichetta(riconosciuta)} finché il dato non si conferma per due esercizi consecutivi.`
    : null

  return { dimensione: riconosciuta, ultimaCalcolata, ultimoEsercizio: ultimo.esercizio, inAttesaDiConferma, messaggio, passi }
}
