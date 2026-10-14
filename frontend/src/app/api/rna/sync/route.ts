import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { importaMeseRna, ultimiMesi } from '@/lib/rna/importer'

/**
 * /api/rna/sync — aggiornamento degli aiuti RNA dei clienti.
 *
 * RNA pubblica un file per mese di concessione e lo aggiorna ogni settimana;
 * le concessioni arrivano con ritardo, quindi si rileggono gli ultimi 4 mesi.
 * Per restare nei 60 secondi del piano Vercel Hobby si elabora UN mese per
 * chiamata: il cron giornaliero ruota sui 4 mesi (ognuno riletto ogni 4 giorni).
 *
 * Auth (come /api/bandi-esterni/ingest-gmail):
 *  - `Authorization: Bearer <CRON_SECRET>`  -> Vercel Cron
 *  - `x-ingest-secret: <INGEST_SECRET>`     -> chiamata manuale
 *
 * Query string opzionale: ?mese=AAAA_MM per forzare un mese specifico.
 */

export const maxDuration = 60
// rna.gov.it non risponde dalle regioni Vercel statunitensi (connessione in
// timeout): la funzione gira a Francoforte.
export const preferredRegion = 'fra1'

function isAuthorized(req: NextRequest): boolean {
  const ingest = req.headers.get('x-ingest-secret')
  if (ingest && process.env.INGEST_SECRET && ingest === process.env.INGEST_SECRET) return true
  const auth = req.headers.get('authorization')
  if (auth && process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true
  return false
}

function meseDelGiorno(oggi: Date = new Date()): string {
  const mesi = ultimiMesi(4, oggi)
  const inizioAnno = Date.UTC(oggi.getUTCFullYear(), 0, 1)
  const giorno = Math.floor((oggi.getTime() - inizioAnno) / 86400000)
  return mesi[giorno % mesi.length]
}

async function esegui(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const richiesto = new URL(req.url).searchParams.get('mese')
  if (richiesto && !/^\d{4}_\d{2}$/.test(richiesto)) {
    return Response.json({ success: false, error: 'Parametro mese non valido (AAAA_MM)' }, { status: 400 })
  }
  const mese = richiesto || meseDelGiorno()
  const esito = await importaMeseRna({ client: supabase, mese, origine: richiesto ? 'MANUALE' : 'CRON' })
  console.log('[RNA sync]', JSON.stringify(esito))
  return Response.json({ success: esito.esito === 'OK', data: esito }, { status: esito.esito === 'OK' ? 200 : 500 })
}

export async function GET(req: NextRequest) { return esegui(req) }
export async function POST(req: NextRequest) { return esegui(req) }
