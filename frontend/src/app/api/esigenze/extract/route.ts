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
 * Dato un testo libero (es. il contenuto di una nota di riunione o un appunto),
 * suggerisce quali delle 14 categorie di spesa spuntare per la "lista della spesa"
 * del cliente e propone una breve descrizione sintetica.
 */
const SYSTEM_PROMPT = `Sei un assistente per uno studio di finanza agevolata. Leggi un testo (note di riunione o appunti su un cliente) e individua le esigenze di investimento/spesa che il cliente manifesta. Restituisci SOLO un oggetto JSON valido, senza testo prima o dopo, senza markdown.

Campi:
- "categorie": string[]. SOLO valori presi ESATTAMENTE da questa lista chiusa (copia identica, non inventare):
${TIPOLOGIE_INVESTIMENTO.map((t) => `  - "${t}"`).join('\n')}
- "descrizione": string|null. Una sintesi in una/due frasi delle esigenze concrete del cliente, in italiano (es. "Vuole acquistare un tornio CNC e fare formazione del personale di produzione").

Esempi di mappatura: "comprare un macchinario" -> "Attrezzature e Macchinari"; "impianto fotovoltaico" / "ridurre i costi energetici" -> "Risparmio energetico/Fonti rinnovabili"; "sito web / campagne / pubblicita" -> "Marketing"; "assumere personale" -> "Assunzioni e Personale"; "corsi / formare i dipendenti" -> "Formazione"; "fiere / estero" -> "Fiere e Internazionalizzazione". Se nessuna esigenza e' chiara, "categorie" = [] e "descrizione" = null.`

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

    const testoLimitato = testo.slice(0, 20000)

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Individua le esigenze dal seguente testo:\n\n${testoLimitato}`,
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

    const descrizione =
      typeof parsed.descrizione === 'string' && parsed.descrizione.trim()
        ? parsed.descrizione.trim()
        : null

    return Response.json({
      success: true,
      categorie: normalizzaCategorie(parsed.categorie),
      descrizione,
    })
  } catch (error) {
    console.error('[esigenze/extract] Errore:', error)
    return Response.json(
      { success: false, error: 'Errore interno estrazione' },
      { status: 500 }
    )
  }
}

function parseJsonObject(text: string): Record<string, any> | null {
  if (!text) return null
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
