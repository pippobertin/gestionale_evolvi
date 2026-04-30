import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * POST /api/clienti/match
 *
 * Fuzzy matching del nome cliente estratto da Gemini contro l'anagrafica.
 * Usa la funzione Postgres match_clienti (word_similarity di pg_trgm).
 *
 * Auth: header `x-ingest-secret` con il valore di INGEST_SECRET.
 *
 * Body JSON:
 *   {
 *     "nome": "Gaggiotti",
 *     "max_results": 5,        // opzionale, default 5
 *     "soglia_minima": 0.2     // opzionale, default 0.2
 *   }
 *
 * Risposta:
 *   {
 *     "matches": [
 *       { "id": "...", "denominazione": "...", "partita_iva": "...",
 *         "codice_fiscale": "...", "score": 0.95 },
 *       ...
 *     ],
 *     "decision": "auto" | "suggest" | "inbox",
 *     "cliente_id": "..." | null,    // valorizzato se decision=auto
 *     "best_score": 0.95 | null
 *   }
 */

// Soglie di decisione (tarate su word_similarity).
// Ridefinibili in futuro se serve.
const SOGLIA_AUTO = 0.7
const SOGLIA_SUGGEST = 0.4

// Forme giuridiche da rimuovere dal nome estratto prima del matching,
// per migliorare la similarity quando il nome contiene "Srl", "Spa", ecc.
const FORME_GIURIDICHE = [
  'srl',
  's.r.l.',
  's.r.l',
  'spa',
  's.p.a.',
  's.p.a',
  'srls',
  'snc',
  'sas',
  'sapa',
  'soc. coop.',
  'soc coop',
  'cooperativa',
  'onlus',
  'ets',
  'aps',
  'odv',
]

function normalizzaNome(nome: string): string {
  let n = nome.toLowerCase().trim()
  for (const forma of FORME_GIURIDICHE) {
    // Rimuove la forma giuridica come parola finale o intermedia
    const re = new RegExp(`\\b${forma.replace(/\./g, '\\.')}\\b`, 'gi')
    n = n.replace(re, '')
  }
  // Compatta spazi multipli
  n = n.replace(/\s+/g, ' ').trim()
  return n
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verifica auth via header
    const ingestSecret = req.headers.get('x-ingest-secret')
    if (!ingestSecret || ingestSecret !== process.env.INGEST_SECRET) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse body
    const body = await req.json().catch(() => null)
    if (!body || typeof body.nome !== 'string' || body.nome.trim() === '') {
      return Response.json(
        { success: false, error: 'Body must include non-empty "nome" string' },
        { status: 400 }
      )
    }

    const nomeOriginale = body.nome.trim()
    const nomeNormalizzato = normalizzaNome(nomeOriginale)
    const maxResults = typeof body.max_results === 'number' ? body.max_results : 5
    const sogliaMinima =
      typeof body.soglia_minima === 'number' ? body.soglia_minima : 0.2

    // 3. RPC alla funzione Postgres match_clienti
    const { data, error } = await supabaseAdmin.rpc('match_clienti', {
      query_text: nomeNormalizzato,
      max_results: maxResults,
      soglia_minima: sogliaMinima,
    })

    if (error) {
      console.error('[clienti/match] Errore RPC match_clienti:', error)
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    const matches = (data || []) as Array<{
      id: string
      denominazione: string
      partita_iva: string | null
      codice_fiscale: string | null
      score: number
    }>

    // 4. Decisione basata sulle soglie
    const bestScore = matches.length > 0 ? matches[0].score : null
    let decision: 'auto' | 'suggest' | 'inbox'
    let clienteId: string | null = null

    if (bestScore !== null && bestScore >= SOGLIA_AUTO) {
      decision = 'auto'
      clienteId = matches[0].id
    } else if (bestScore !== null && bestScore >= SOGLIA_SUGGEST) {
      decision = 'suggest'
    } else {
      decision = 'inbox'
    }

    return Response.json({
      success: true,
      query: {
        nome_originale: nomeOriginale,
        nome_normalizzato: nomeNormalizzato,
      },
      matches,
      best_score: bestScore,
      decision,
      cliente_id: clienteId,
    })
  } catch (err: any) {
    console.error('[clienti/match] Errore non gestito:', err)
    return Response.json(
      { success: false, error: err?.message ?? 'Internal error' },
      { status: 500 }
    )
  }
}
