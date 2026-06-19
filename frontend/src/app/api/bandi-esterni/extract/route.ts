import { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import Anthropic from '@anthropic-ai/sdk'
import {
  TIPOLOGIE_INVESTIMENTO,
  normalizzaCategorie,
} from '@/lib/tipologieInvestimento'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Estrae i campi strutturati di un bando esterno da testo libero
 * (corpo di un alert Agevolando o testo di una sintesi PDF).
 * Le "investimenti_spesati" vengono normalizzate sul vocabolario delle 14 voci.
 */
const SYSTEM_PROMPT = `Sei un estrattore di dati per uno studio di finanza agevolata. Ricevi il testo di un bando (alert o sintesi del servizio Agevolando) e restituisci SOLO un oggetto JSON valido, senza testo prima o dopo, senza markdown.

Campi da estrarre (usa null se l'informazione non c'e'):
- "titolo": string. Il nome del bando.
- "tipologia_aiuto": string|null. Es. "Contributi a fondo perduto", "Finanziamento agevolato".
- "investimenti_spesati": string[]. SOLO valori presi ESATTAMENTE da questa lista chiusa (copia la stringa identica, non inventare, non tradurre):
${TIPOLOGIE_INVESTIMENTO.map((t) => `  - "${t}"`).join('\n')}
- "stato": "attivo"|"scaduto"|"archiviato". Se il testo dice "Bando attivo" o non indica chiusura passata, usa "attivo".
- "data_apertura": string|null. Come scritto nel testo (es. "Bando attivo").
- "data_scadenza": string|null. In formato ISO "YYYY-MM-DD" se ricavabile da una data di chiusura, altrimenti null.
- "territorio": string|null. Es. "Tutto il territorio italiano".
- "destinatari": string|null. Es. "PMI e Micro Imprese".
- "settori": string|null.
- "url_dettagli": string|null. Un eventuale link al bando.

Mappa il concetto di spesa del bando sulle voci della lista chiusa: se il bando parla di "macchinari" usa "Attrezzature e Macchinari"; "fotovoltaico/efficienza energetica" -> "Risparmio energetico/Fonti rinnovabili"; "formazione" -> "Formazione"; "promozione/pubblicita" -> "Marketing"; ecc. Se nessuna voce e' pertinente, restituisci array vuoto.`

export async function POST(request: NextRequest) {
  try {
    const user = await verifyJWT(request)
    if (!user) {
      return Response.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const testo = typeof body?.testo === 'string' ? body.testo.trim() : ''

    if (!testo) {
      return Response.json(
        { success: false, error: 'Testo mancante' },
        { status: 400 }
      )
    }

    // Cap difensivo sulla lunghezza del testo passato al modello.
    const testoLimitato = testo.slice(0, 20000)

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Estrai i campi dal seguente testo:\n\n${testoLimitato}`,
        },
      ],
    })

    const raw =
      response.content[0]?.type === 'text' ? response.content[0].text : ''

    const parsed = parseJsonObject(raw)
    if (!parsed) {
      return Response.json(
        { success: false, error: 'Estrazione non riuscita (output non valido)' },
        { status: 502 }
      )
    }

    // Normalizzazione e sanitizzazione campi.
    const datiBando = {
      titolo: asString(parsed.titolo) ?? '',
      tipologia_aiuto: asString(parsed.tipologia_aiuto),
      investimenti_spesati: normalizzaCategorie(parsed.investimenti_spesati),
      stato: ['attivo', 'scaduto', 'archiviato'].includes(parsed.stato)
        ? parsed.stato
        : 'attivo',
      data_apertura: asString(parsed.data_apertura),
      data_scadenza: asIsoDate(parsed.data_scadenza),
      territorio: asString(parsed.territorio),
      destinatari: asString(parsed.destinatari),
      settori: asString(parsed.settori),
      url_dettagli: asString(parsed.url_dettagli),
    }

    return Response.json({ success: true, bando: datiBando })
  } catch (error) {
    console.error('[bandi-esterni/extract] Errore:', error)
    return Response.json(
      { success: false, error: 'Errore interno estrazione' },
      { status: 500 }
    )
  }
}

// --- helpers -----------------------------------------------------------

function parseJsonObject(text: string): Record<string, any> | null {
  if (!text) return null
  // Prova diretta, poi fallback estraendo il primo blocco { ... }.
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        return null
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
