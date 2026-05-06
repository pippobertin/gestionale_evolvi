import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * POST /api/notes/ingest
 *
 * Riceve da n8n una nota cliente prodotta dal pipeline (transcript + Gemini).
 * Inserisce il record in scadenze_bandi_clienti_note e propone collegamenti
 * automatici (forward link) verso bandi e progetti citati nel campo entita.
 *
 * Auth: header `x-ingest-secret` con il valore di INGEST_SECRET.
 *
 * Idempotenza: se esiste gia' una nota con lo stesso drive_file_id,
 * non duplica e ritorna il record esistente con flag already_existed=true.
 *
 * Body JSON di esempio:
 *   {
 *     "cliente_id": "uuid o null",
 *     "data_riunione": "2026-04-21",
 *     "data_caricamento": "2026-04-21",
 *     "durata_minuti_stimata": 40,
 *     "tipo": "riunione_cliente",
 *     "titolo": "Follow-up Gaggiotti: Metodo Evolvi e Bando Fiere",
 *     "sintesi_one_liner": "Discussione su...",
 *     "contenuto_markdown": "## Sintesi\n...",
 *     "entita": { "persone": [...], "bandi": ["..."], "progetti": [...], ... },
 *     "verifiche_suggerite": [...],
 *     "sorgente": "plaud",
 *     "drive_file_id": "1abc...",
 *     "drive_file_url": "https://drive.google.com/...",
 *     "filename_originale": "Gaggiotti 21_4_26-transcript.txt",
 *     "match_confidence": 1.0,
 *     "match_method": "filename",
 *     "stato": "pubblicata",   // opzionale, se omesso derivato da cliente_id
 *     "created_by": "info@blmproject.com"
 *   }
 *
 * Risposta:
 *   {
 *     "success": true,
 *     "nota_id": "...",
 *     "already_existed": false,
 *     "stato": "pubblicata",
 *     "link_bandi_suggeriti": 1,
 *     "link_progetti_suggeriti": 0,
 *     "dettagli_link": {
 *       "bandi": [{ "bando_id": "...", "score": 0.78 }],
 *       "progetti": []
 *     }
 *   }
 */

// Soglia minima word_similarity sotto cui non proponiamo link automatici
const SOGLIA_LINK = 0.4

interface NotaPayload {
  cliente_id?: string | null
  data_riunione?: string | null
  data_caricamento?: string | null
  durata_minuti_stimata?: number | null
  tipo?: string | null
  titolo: string
  sintesi_one_liner?: string | null
  contenuto_markdown: string
  entita?: Record<string, unknown>
  verifiche_suggerite?: unknown[]
  sorgente?: string
  drive_file_id?: string | null
  drive_file_url?: string | null
  filename_originale?: string | null
  match_confidence?: number | null
  match_method?: string | null
  stato?: string
  created_by?: string | null
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const ingestSecret = req.headers.get('x-ingest-secret')
    if (!ingestSecret || ingestSecret !== process.env.INGEST_SECRET) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse body
    const payload = (await req.json().catch(() => null)) as NotaPayload | null
    if (
      !payload ||
      typeof payload.titolo !== 'string' ||
      typeof payload.contenuto_markdown !== 'string'
    ) {
      return Response.json(
        {
          success: false,
          error:
            'Body invalido: "titolo" e "contenuto_markdown" sono obbligatori.',
        },
        { status: 400 }
      )
    }

    // 3. Idempotenza su drive_file_id
    if (payload.drive_file_id) {
      const { data: existing, error: existingErr } = await supabaseAdmin
        .from('scadenze_bandi_clienti_note')
        .select('id, stato')
        .eq('drive_file_id', payload.drive_file_id)
        .maybeSingle()

      if (existingErr) {
        console.error('[notes/ingest] Errore lookup idempotenza:', existingErr)
      }

      if (existing) {
        return Response.json({
          success: true,
          nota_id: existing.id,
          already_existed: true,
          stato: existing.stato,
          link_bandi_suggeriti: 0,
          link_progetti_suggeriti: 0,
          dettagli_link: { bandi: [], progetti: [] },
        })
      }
    }

    // 4. Stato derivato se non passato
    let stato = payload.stato
    if (!stato) {
      stato = payload.cliente_id ? 'pubblicata' : 'in_inbox'
    }

    // 5. Insert della nota
    const { data: nota, error: insertErr } = await supabaseAdmin
      .from('scadenze_bandi_clienti_note')
      .insert([
        {
          cliente_id: payload.cliente_id ?? null,
          data_riunione: payload.data_riunione ?? null,
          data_caricamento: payload.data_caricamento ?? null,
          durata_minuti_stimata: payload.durata_minuti_stimata ?? null,
          tipo: payload.tipo ?? null,
          titolo: payload.titolo,
          sintesi_one_liner: payload.sintesi_one_liner ?? null,
          contenuto_markdown: payload.contenuto_markdown,
          entita: payload.entita ?? {},
          verifiche_suggerite: payload.verifiche_suggerite ?? [],
          sorgente: payload.sorgente ?? 'plaud',
          drive_file_id: payload.drive_file_id ?? null,
          drive_file_url: payload.drive_file_url ?? null,
          filename_originale: payload.filename_originale ?? null,
          match_confidence: payload.match_confidence ?? null,
          match_method: payload.match_method ?? null,
          stato,
          created_by: payload.created_by ?? null,
        },
      ])
      .select('id')
      .single()

    if (insertErr || !nota) {
      console.error('[notes/ingest] Errore insert nota:', insertErr)
      return Response.json(
        { success: false, error: insertErr?.message ?? 'Insert failed' },
        { status: 500 }
      )
    }

    const notaId = nota.id

    // 6. Forward link: bandi citati nelle entita
    const bandiCitati = extractStringArray(payload.entita, 'bandi')
    const linkBandi: Array<{ bando_id: string; score: number }> = []

    for (const bandoText of bandiCitati) {
      const { data: matches } = await supabaseAdmin.rpc('match_bandi', {
        query_text: bandoText,
        max_results: 1,
        soglia_minima: SOGLIA_LINK,
      })
      if (matches && matches.length > 0) {
        const m = matches[0]
        const { error: linkErr } = await supabaseAdmin
          .from('scadenze_bandi_note_bandi')
          .insert([
            {
              nota_id: notaId,
              bando_id: m.id,
              stato: 'suggerito',
              score: m.score,
              metodo: 'forward_ingest',
            },
          ])
          .select()
          .single()

        if (!linkErr) {
          linkBandi.push({ bando_id: m.id, score: m.score })
        }
      }
    }

    // 7. Forward link: progetti citati nelle entita
    const progettiCitati = extractStringArray(payload.entita, 'progetti')
    const linkProgetti: Array<{ progetto_id: string; score: number }> = []

    for (const progettoText of progettiCitati) {
      const { data: matches } = await supabaseAdmin.rpc('match_progetti', {
        query_text: progettoText,
        max_results: 1,
        soglia_minima: SOGLIA_LINK,
      })
      if (matches && matches.length > 0) {
        const m = matches[0]
        const { error: linkErr } = await supabaseAdmin
          .from('scadenze_bandi_note_progetti')
          .insert([
            {
              nota_id: notaId,
              progetto_id: m.id,
              stato: 'suggerito',
              score: m.score,
              metodo: 'forward_ingest',
            },
          ])
          .select()
          .single()

        if (!linkErr) {
          linkProgetti.push({ progetto_id: m.id, score: m.score })
        }
      }
    }

    return Response.json({
      success: true,
      nota_id: notaId,
      already_existed: false,
      stato,
      link_bandi_suggeriti: linkBandi.length,
      link_progetti_suggeriti: linkProgetti.length,
      dettagli_link: {
        bandi: linkBandi,
        progetti: linkProgetti,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[notes/ingest] Errore non gestito:', err)
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

/**
 * Estrae da un oggetto JSONB di entita un array di stringhe per la chiave
 * indicata. Sopporta sia array di stringhe sia array di oggetti con campo
 * "nome" o "titolo".
 */
function extractStringArray(
  entita: Record<string, unknown> | undefined,
  key: string
): string[] {
  if (!entita) return []
  const value = entita[key]
  if (!Array.isArray(value)) return []

  const result: string[] = []
  for (const item of value) {
    if (typeof item === 'string') {
      const s = item.trim()
      if (s.length > 0) result.push(s)
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      const candidate = obj.nome ?? obj.titolo ?? obj.title
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        result.push(candidate.trim())
      }
    }
  }
  return result
}
