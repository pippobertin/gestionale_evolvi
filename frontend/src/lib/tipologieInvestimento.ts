/**
 * Vocabolario controllato condiviso: le 14 voci "Tipologia di investimento"
 * usate da Agevolando.eu sia negli alert email sia nei PDF di sintesi.
 *
 * E' la SINGOLA fonte di verita' per:
 *  - la checklist della "lista della spesa" del cliente (esigenze)
 *  - il tag "investimenti spesati" dei bandi esterni
 *
 * Poiche' entrambi i lati usano queste stesse stringhe, il match e'
 * deterministico (intersezione di insiemi), non fuzzy. Se Agevolando
 * aggiunge/cambia una voce, va aggiornata SOLO qui.
 */
export const TIPOLOGIE_INVESTIMENTO = [
  'Assunzioni e Personale',
  'Attrezzature e Macchinari',
  'Avvio attività / StartUp',
  'Consulenze/Servizi',
  'Digitalizzazione',
  'Fiere e Internazionalizzazione',
  'Formazione',
  'Impiantistica/Opere edili',
  'Marchi, brevetti e design',
  'Marketing',
  'Ricerca e Sviluppo / Innovazione',
  'Risparmio energetico/Fonti rinnovabili',
  'Sostegni',
  'Spese vive / Magazzino',
] as const

export type TipologiaInvestimento = (typeof TIPOLOGIE_INVESTIMENTO)[number]

/** Set per validazione veloce (es. filtrare output LLM su voci ammesse). */
export const TIPOLOGIE_INVESTIMENTO_SET: ReadonlySet<string> = new Set(
  TIPOLOGIE_INVESTIMENTO
)

/**
 * Normalizza una lista arbitraria (es. output LLM) tenendo solo le voci
 * che fanno parte del vocabolario, deduplicate e nell'ordine canonico.
 */
export function normalizzaCategorie(input: unknown): TipologiaInvestimento[] {
  if (!Array.isArray(input)) return []
  const presenti = new Set(
    input.filter((v): v is string => typeof v === 'string')
  )
  return TIPOLOGIE_INVESTIMENTO.filter((t) => presenti.has(t))
}
