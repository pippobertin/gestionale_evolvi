import Anthropic from '@anthropic-ai/sdk'
import {
  TIPOLOGIE_INVESTIMENTO,
  normalizzaCategorie,
} from '@/lib/tipologieInvestimento'

/**
 * Logica condivisa di estrazione bandi esterni (alert Agevolando).
 *
 * - estrazione SINGOLA  -> usata da /api/bandi-esterni/extract (ingest manuale,
 *   un alert incollato a mano = un bando)
 * - estrazione MULTIPLA -> usata da /api/bandi-esterni/ingest-gmail (Fase B:
 *   una email Agevolando contiene piu' card / piu' bandi)
 *
 * I campi di spesa ("investimenti_spesati") vengono normalizzati sul vocabolario
 * chiuso delle 14 voci (frontend/src/lib/tipologieInvestimento.ts): se Agevolando
 * cambia le voci si aggiorna solo li'.
 */

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = 'claude-haiku-4-5-20251001'

export interface DatiBando {
  titolo: string
  tipologia_aiuto: string | null
  investimenti_spesati: string[]
  stato: 'attivo' | 'in_apertura' | 'scaduto' | 'archiviato'
  data_apertura: string | null
  data_scadenza: string | null
  territorio: string | null
  destinatari: string | null
  settori: string | null
  url_dettagli: string | null
}

// Descrizione dei campi, condivisa fra prompt singolo e multiplo.
const CAMPI = `Campi di ogni bando (usa null se l'informazione non c'e'):
- "titolo": string. Il nome del bando.
- "tipologia_aiuto": string|null. Es. "Contributi a fondo perduto", "Finanziamento agevolato".
- "investimenti_spesati": string[]. SOLO valori presi ESATTAMENTE da questa lista chiusa (copia la stringa identica, non inventare, non tradurre):
${TIPOLOGIE_INVESTIMENTO.map((t) => `  - "${t}"`).join('\n')}
- "stato": "attivo"|"in_apertura"|"scaduto"|"archiviato". Se "Apertura: Bando attivo" usa "attivo". Se "Apertura: Aprirà il <data>" (bando non ancora aperto) usa "in_apertura". Usa "scaduto" solo se il testo indica chiusura passata.
- "data_apertura": string|null. Come scritto nel testo (es. "Bando attivo", "Aprirà il 08/06/2026").
- "data_scadenza": string|null. In formato ISO "YYYY-MM-DD" se ricavabile da una data di chiusura, altrimenti null.
- "territorio": string|null. Es. "Tutto il territorio italiano".
- "destinatari": string|null. Es. "PMI e Micro Imprese".
- "settori": string|null.
- "url_dettagli": string|null. Il link "Vedi dettagli" del bando.

Mappa il concetto di spesa del bando sulle voci della lista chiusa: se il bando parla di "macchinari" usa "Attrezzature e Macchinari"; "fotovoltaico/efficienza energetica" -> "Risparmio energetico/Fonti rinnovabili"; "formazione" -> "Formazione"; "promozione/pubblicita" -> "Marketing"; ecc. Se nessuna voce e' pertinente, restituisci array vuoto.`

const SYSTEM_PROMPT_SINGLE = `Sei un estrattore di dati per uno studio di finanza agevolata. Ricevi il testo di un bando (alert o sintesi del servizio Agevolando) e restituisci SOLO un oggetto JSON valido, senza testo prima o dopo, senza markdown.

${CAMPI}`

const SYSTEM_PROMPT_MULTI = `Sei un estrattore di dati per uno studio di finanza agevolata. Ricevi il testo di UNA email del servizio Agevolando ("Segnalazione bandi"), che elenca PIU' bandi (una "card" per bando). Restituisci SOLO un array JSON valido, un oggetto per ogni bando presente nel testo, senza testo prima o dopo, senza markdown. Se nel testo non c'e' alcun bando, restituisci [].

Non inventare bandi: estrai solo quelli effettivamente elencati. Ignora intestazioni, piè di pagina, link di disiscrizione e testo promozionale del servizio.

${CAMPI}`

// Cap difensivo sulla lunghezza del testo passato al modello.
const MAX_INPUT_SINGLE = 20000
const MAX_INPUT_MULTI = 40000

/**
 * Estrae i campi di UN bando da testo libero (alert incollato a mano).
 * Ritorna null se l'output del modello non e' interpretabile.
 */
export async function extractBandoFromText(
  testo: string
): Promise<DatiBando | null> {
  const input = testo.trim().slice(0, MAX_INPUT_SINGLE)
  if (!input) return null

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT_SINGLE,
    messages: [
      {
        role: 'user',
        content: `Estrai i campi dal seguente testo:\n\n${input}`,
      },
    ],
  })

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const parsed = parseJsonValue(raw)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return null
  return sanitizeBando(parsed as Record<string, unknown>)
}

/**
 * Estrae i campi di PIU' bandi dal corpo di una singola email Agevolando.
 * Ritorna sempre un array (vuoto se nulla di valido).
 */
export async function extractBandiFromText(
  testo: string
): Promise<DatiBando[]> {
  const input = testo.trim().slice(0, MAX_INPUT_MULTI)
  if (!input) return []

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT_MULTI,
    messages: [
      {
        role: 'user',
        content: `Estrai i bandi dalla seguente email:\n\n${input}`,
      },
    ],
  })

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const parsed = parseJsonValue(raw)
  const arr = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? [parsed] // tolleranza: il modello ha restituito un singolo oggetto
      : []

  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map(sanitizeBando)
    .filter((b) => b.titolo.length > 0)
}

// --- normalizzazione --------------------------------------------------

function sanitizeBando(parsed: Record<string, unknown>): DatiBando {
  const stato = parsed.stato
  return {
    titolo: asString(parsed.titolo) ?? '',
    tipologia_aiuto: asString(parsed.tipologia_aiuto),
    investimenti_spesati: normalizzaCategorie(parsed.investimenti_spesati),
    stato:
      stato === 'attivo' ||
      stato === 'in_apertura' ||
      stato === 'scaduto' ||
      stato === 'archiviato'
        ? stato
        : 'attivo',
    data_apertura: asString(parsed.data_apertura),
    data_scadenza: asIsoDate(parsed.data_scadenza),
    territorio: asString(parsed.territorio),
    destinatari: asString(parsed.destinatari),
    settori: asString(parsed.settori),
    url_dettagli: asString(parsed.url_dettagli),
  }
}

// --- helpers ----------------------------------------------------------

/** Parse tollerante: prova diretto, poi estrae il primo blocco [ ... ] o { ... }. */
function parseJsonValue(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    // Cerca il primo array o oggetto bilanciato nel testo.
    const candidates: Array<[number, number]> = []
    const firstArr = text.indexOf('[')
    const lastArr = text.lastIndexOf(']')
    if (firstArr !== -1 && lastArr > firstArr) candidates.push([firstArr, lastArr])
    const firstObj = text.indexOf('{')
    const lastObj = text.lastIndexOf('}')
    if (firstObj !== -1 && lastObj > firstObj) candidates.push([firstObj, lastObj])
    // Preferisci il blocco che inizia prima (array o oggetto piu' esterno).
    candidates.sort((a, b) => a[0] - b[0])
    for (const [start, end] of candidates) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        continue
      }
    }
    return null
  }
}

function asString(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

function asIsoDate(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = v.trim().match(/^\d{4}-\d{2}-\d{2}/)
  return m ? m[0] : null
}
