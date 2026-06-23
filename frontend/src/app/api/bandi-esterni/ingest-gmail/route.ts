import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getGmailClient } from '@/lib/gmail'
import { extractBandiFromText, type DatiBando } from '@/lib/bandiEsterniExtract'

/**
 * POST /api/bandi-esterni/ingest-gmail
 *
 * Fase B — alimenta il catalogo `scadenze_bandi_bandi_esterni` leggendo gli alert
 * del servizio Agevolando dalla casella Gmail del collega (default
 * paladini@blmproject.com), gia' collegata al gestionale (pagina email).
 *
 * Job server-side, NON la pagina email: gira anche se nessuno apre la webmail.
 * Riusa il refresh token gia' salvato in scadenze_bandi_utenti -> nessuna nuova
 * autorizzazione, nessun service account.
 *
 * Innesco: chiamata periodica (n8n o Vercel Cron) — stesso pattern di /api/notes/ingest.
 *
 * Auth: header `x-ingest-secret` con il valore di INGEST_SECRET (come le note).
 *
 * Body JSON (tutti opzionali):
 *   {
 *     "maxResults": 20,        // quante email scorrere (default 20)
 *     "q": "newer_than:30d",   // filtro Gmail aggiuntivo (oltre al mittente)
 *     "dryRun": false          // true = estrae e ritorna i bandi SENZA scrivere su DB
 *   }
 *
 * Idempotenza: dedup a livello email su `email_msg_id`. Se l'email e' gia' stata
 * ingerita (almeno un bando con quel msg id in tabella), la salta interamente.
 *
 * Vincolo legale: i contenuti Agevolando sono a uso interno. `raw_payload` tiene
 * solo metadati minimi (msg id, oggetto), MAI il testo verbatim da redistribuire.
 */

// Config (override via env). L'indirizzo del feed e il mittente sono i due "knob"
// previsti dal design: se Paladini lascia, si cambia solo qui / in env.
const FEED_EMAIL = process.env.AGEVOLANDO_FEED_EMAIL || 'paladini@blmproject.com'
const SENDER = process.env.AGEVOLANDO_SENDER || 'bandi@agevolando.eu'
const FONTE = 'agevolando'
const CREATED_BY = 'agevolando-ingest'
// Email elaborate in parallelo. Tetto basso: ogni email = 1 chiamata LLM, e non
// vogliamo saturare i rate limit Anthropic ne' le connessioni Gmail.
const CONCURRENCY = 4

interface IngestBody {
  maxResults?: number
  q?: string
  dryRun?: boolean
}

interface MsgResult {
  processed?: number
  skipped?: number
  empty?: number
  errored?: number
  inserted?: number
  detail?: Record<string, unknown>
}

// Tetto durata funzione: 60s e' il massimo del piano Vercel Hobby. Un giro a
// regime (poche email nuove) sta sotto; il backfill grosso va fatto a lotti manuali.
export const maxDuration = 60

interface IngestParams {
  maxResults: number
  q: string
  dryRun: boolean
}

/**
 * Auth: accetta DUE forme.
 *  - `x-ingest-secret: <INGEST_SECRET>`  -> n8n / chiamata manuale / curl
 *  - `Authorization: Bearer <CRON_SECRET>` -> Vercel Cron lo inietta in automatico
 *    quando la env CRON_SECRET e' impostata sul progetto.
 */
function isAuthorized(req: NextRequest): boolean {
  const ingest = req.headers.get('x-ingest-secret')
  if (ingest && process.env.INGEST_SECRET && ingest === process.env.INGEST_SECRET) {
    return true
  }
  const auth = req.headers.get('authorization')
  if (auth && process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) {
    return true
  }
  return false
}

// POST: n8n / chiamata manuale. Parametri dal body JSON.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const body = ((await req.json().catch(() => ({}))) || {}) as IngestBody
  return runIngestResponse({
    maxResults: clampInt(body.maxResults, 20, 1, 100),
    q: typeof body.q === 'string' ? body.q.trim() : '',
    dryRun: body.dryRun === true,
  })
}

// GET: usato da Vercel Cron (1 volta/giorno). Finestra stretta di default
// (newer_than:2d) cosi' il giro elabora solo le email recenti; il dedup salta
// quelle gia' viste. Parametri override-abili via query string.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const sp = new URL(req.url).searchParams
  return runIngestResponse({
    maxResults: clampInt(sp.get('maxResults'), 10, 1, 100),
    q: sp.get('q')?.trim() || 'newer_than:2d',
    dryRun: sp.get('dryRun') === 'true',
  })
}

// Esegue runIngest e impacchetta la Response (gestione errori comune).
async function runIngestResponse(params: IngestParams): Promise<Response> {
  try {
    const { status, payload } = await runIngest(params)
    return Response.json(payload, { status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[bandi-esterni/ingest-gmail] Errore non gestito:', err)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

// Core condiviso: legge la casella, estrae e (se non dryRun) inserisce.
async function runIngest({
  maxResults,
  q: extraQuery,
  dryRun,
}: IngestParams): Promise<{ status: number; payload: Record<string, unknown> }> {
  {
    // Risolvi l'utente proprietario della casella (per usare il suo token Gmail).
    const userId = await resolveFeedUserId()
    if (!userId) {
      return {
        status: 412,
        payload: {
          success: false,
          error: `Nessun utente con Gmail collegato per ${FEED_EMAIL}. ` +
            `Collega la casella dalla pagina email, oppure imposta AGEVOLANDO_GMAIL_USER_ID.`,
        },
      }
    }

    const gmail = await getGmailClient(userId)

    // Lista messaggi dal mittente Agevolando.
    const q = [`from:${SENDER}`, extraQuery].filter(Boolean).join(' ')
    const list = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults,
    })
    const ids = (list.data.messages || []).map((m) => m.id!).filter(Boolean)

    // Per ogni email, in parallelo con tetto di concorrenza (le chiamate LLM
    //    sequenziali sarebbero ~12s/email -> timeout sui backfill). Ogni email e'
    //    isolata: un errore singolo non fa fallire l'intero batch.
    const results = await mapLimit<string, MsgResult>(ids, CONCURRENCY, async (msgId) => {
      try {
        // Dedup a livello email (salta se gia' ingerita), salvo in dryRun.
        if (!dryRun && (await emailAlreadyIngested(msgId))) {
          return { skipped: 1 }
        }

        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msgId,
          format: 'full',
        })

        const subject = getHeader(full.data, 'Subject')
        const testo = extractEmailText(full.data?.payload)
        if (!testo.trim()) return { empty: 1, detail: { msgId, subject, bandi: 0 } }

        const bandi = await extractBandiFromText(testo)

        if (bandi.length === 0) {
          return { processed: 1, detail: { msgId, subject, bandi: 0 } }
        }

        if (dryRun) {
          return {
            processed: 1,
            inserted: bandi.length,
            detail: { msgId, subject, bandi: bandi.length, estratti: bandi },
          }
        }

        const rows = bandi.map((b: DatiBando) => ({
          fonte: FONTE,
          titolo: b.titolo,
          investimenti_spesati: b.investimenti_spesati,
          tipologia_aiuto: b.tipologia_aiuto,
          stato: b.stato,
          data_apertura: b.data_apertura,
          data_scadenza: b.data_scadenza,
          url_dettagli: b.url_dettagli,
          territorio: b.territorio,
          destinatari: b.destinatari,
          settori: b.settori,
          email_msg_id: msgId,
          // SOLO metadati interni: niente testo verbatim da redistribuire ai clienti.
          raw_payload: { source: 'gmail', email_msg_id: msgId, subject: subject || null },
          created_by: CREATED_BY,
        }))

        const { data: inserted, error: insErr } = await supabaseAdmin
          .from('scadenze_bandi_bandi_esterni')
          .insert(rows)
          .select('id')

        if (insErr) {
          console.error('[bandi-esterni/ingest-gmail] insert error:', insErr)
          return { processed: 1, detail: { msgId, subject, bandi: bandi.length, error: insErr.message } }
        }

        return {
          processed: 1,
          inserted: inserted?.length ?? 0,
          detail: { msgId, subject, bandi: inserted?.length ?? 0 },
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'errore elaborazione email'
        console.error(`[bandi-esterni/ingest-gmail] msg ${msgId}:`, e)
        return { errored: 1, detail: { msgId, error: msg } }
      }
    })

    const agg = results.reduce<{
      processed: number
      skipped: number
      empty: number
      errored: number
      inserted: number
    }>(
      (a, r) => ({
        processed: a.processed + (r.processed ?? 0),
        skipped: a.skipped + (r.skipped ?? 0),
        empty: a.empty + (r.empty ?? 0),
        errored: a.errored + (r.errored ?? 0),
        inserted: a.inserted + (r.inserted ?? 0),
      }),
      { processed: 0, skipped: 0, empty: 0, errored: 0, inserted: 0 }
    )
    const details = results
      .map((r) => r.detail)
      .filter((d): d is Record<string, unknown> => !!d)

    return {
      status: 200,
      payload: {
        success: true,
        dryRun,
        feed_email: FEED_EMAIL,
        query: q,
        emails_found: ids.length,
        emails_processed: agg.processed,
        emails_skipped_existing: agg.skipped,
        emails_empty: agg.empty,
        emails_errored: agg.errored,
        bandi_inserted: agg.inserted,
        details,
      },
    }
  }
}

// --- supporto ---------------------------------------------------------

/**
 * Trova l'id dell'utente la cui casella Gmail collegata e' quella del feed.
 * Priorita': env AGEVOLANDO_GMAIL_USER_ID (override esplicito) -> lookup per email.
 */
async function resolveFeedUserId(): Promise<string | null> {
  const explicit = process.env.AGEVOLANDO_GMAIL_USER_ID
  if (explicit) return explicit

  const { data, error } = await supabaseAdmin
    .from('scadenze_bandi_utenti')
    .select('id, gmail_refresh_token')
    .eq('gmail_email', FEED_EMAIL)
    .not('gmail_refresh_token', 'is', null)
    .maybeSingle()

  if (error) {
    console.error('[bandi-esterni/ingest-gmail] lookup utente feed:', error)
    return null
  }
  return data?.id ?? null
}

/** True se almeno un bando con questo email_msg_id e' gia' in tabella. */
async function emailAlreadyIngested(msgId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('scadenze_bandi_bandi_esterni')
    .select('id')
    .eq('email_msg_id', msgId)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[bandi-esterni/ingest-gmail] dedup lookup:', error)
    return false // in dubbio non saltiamo (meglio un duplicato che una perdita)
  }
  return !!data
}

/** Header case-insensitive dal messaggio Gmail. */
function getHeader(message: any, name: string): string | null {
  const headers = message?.payload?.headers as
    | Array<{ name?: string; value?: string }>
    | undefined
  if (!headers) return null
  const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase())
  return h?.value ?? null
}

/**
 * Estrae il testo dal payload MIME di Gmail. Preferisce text/plain; se manca,
 * converte la parte text/html in testo (preservando i link "Vedi dettagli").
 */
function extractEmailText(payload: any): string {
  if (!payload) return ''

  const plain = findPart(payload, 'text/plain')
  if (plain) return decodeBody(plain)

  const html = findPart(payload, 'text/html')
  if (html) return htmlToText(decodeBody(html))

  // Fallback: corpo diretto, eventualmente HTML.
  const direct = decodeBody(payload)
  if (!direct) return ''
  return /<[a-z][\s\S]*>/i.test(direct) ? htmlToText(direct) : direct
}

/** Cerca ricorsivamente la prima parte con il mimeType richiesto. */
function findPart(node: any, mimeType: string): any | null {
  if (!node) return null
  if (node.mimeType === mimeType && node.body?.data) return node
  if (Array.isArray(node.parts)) {
    for (const p of node.parts) {
      const found = findPart(p, mimeType)
      if (found) return found
    }
  }
  return null
}

/** Decodifica il body base64url di una parte Gmail. */
function decodeBody(node: any): string {
  const data = node?.body?.data
  if (!data) return ''
  try {
    return Buffer.from(data, 'base64url').toString('utf8')
  } catch {
    return ''
  }
}

/**
 * Converte HTML in testo leggibile dal modello, mantenendo gli URL degli anchor
 * (i link "Vedi dettagli" servono per url_dettagli) e i ritorni a capo dei blocchi.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<\s*(script|style|head)[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    // <a href="X">testo</a> -> "testo (X)".
    // NB: parentesi e non angolari, altrimenti lo strip generico dei tag piu'
    // sotto rimuoverebbe "<X>" scambiandolo per un tag HTML.
    .replace(
      /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_m, href, txt) => `${stripTags(txt)} (${href})`
    )
    // blocchi -> newline
    .replace(/<\s*(br|\/p|\/div|\/tr|\/li|\/h[1-6]|\/table)\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#3[49];|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * map con concorrenza limitata, preservando l'ordine. Un worker pool di `limit`
 * consuma gli item; `fn` non deve lanciare (gestisce gli errori al suo interno).
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const idx = next++
      results[idx] = await fn(items[idx])
    }
  }
  const n = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, Math.trunc(n)))
}
