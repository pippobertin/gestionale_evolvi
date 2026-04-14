import { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

let faqCache: string | null = null

function loadFAQ(): string {
  if (faqCache) return faqCache
  const faqPath = path.join(process.cwd(), '..', 'docs', 'chatbot', 'FAQ_GESTIONALE_EVOLVI.md')
  faqCache = fs.readFileSync(faqPath, 'utf-8')
  return faqCache
}

const SYSTEM_PROMPT = `Sei l'assistente interno del Gestionale Evolvi di BLM. Aiuti colleghi italiani a capire come usare la piattaforma. Rispondi in italiano, in tono discorsivo e professionale, senza elenchi puntati decorativi. Basa sempre le risposte sul contenuto della knowledge base fornita qui sotto, senza inventare funzioni inesistenti. Quando citi una sezione scrivi "Vedi sezione {nome sezione} della FAQ". Se la domanda non è coperta dalla knowledge base, dillo esplicitamente e invita l'utente a contattare un amministratore. Per funzioni riservate agli admin, segnalalo. Evita frasi conclusive stereotipate, non usare emoji, non usare triplette di aggettivi.

KNOWLEDGE BASE:
`

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
    const { messages } = body as {
      messages: { role: 'user' | 'assistant'; content: string }[]
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { success: false, error: 'Messaggi non validi' },
        { status: 400 }
      )
    }

    const faqContent = loadFAQ()

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT + faqContent,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    })

    const assistantMessage =
      response.content[0].type === 'text' ? response.content[0].text : ''

    return Response.json({
      success: true,
      message: { role: 'assistant', content: assistantMessage },
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[Chatbot API] Error:', errMsg)
    if (error && typeof error === 'object' && 'status' in error) {
      console.error('[Chatbot API] Status:', (error as { status: number }).status)
    }
    return Response.json(
      {
        success: false,
        error: 'Errore interno del servizio chatbot',
      },
      { status: 500 }
    )
  }
}
