/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import { ultimiMesi } from '@/lib/rna/importer'

/**
 * Richieste di aggiornamento degli aiuti RNA.
 *
 * Il gestionale non può importare direttamente (rna.gov.it non risponde ai
 * server cloud): registra la richiesta e l'agente sul Mac la esegue entro
 * qualche minuto, se il Mac è acceso.
 *
 * GET  → { attiva, ultima_completata, agente }
 * POST → { mese_da: 'AAAA_MM', mese_a: 'AAAA_MM' } crea una richiesta
 *        (se ce n'è già una in attesa o in corso restituisce quella)
 */

const PRIMO_MESE_RNA = '2016_10' // primo file Open Data disponibile

const errMsg = (e: unknown, def: string) => e instanceof Error ? e.message : (e as any)?.message || def

async function stato() {
  const [attivaRes, okRes, agenteRes] = await Promise.all([
    supabase.from('scadenze_bandi_rna_richieste').select('*')
      .in('stato', ['IN_ATTESA', 'IN_CORSO']).order('created_at', { ascending: true }).limit(1),
    supabase.from('scadenze_bandi_rna_richieste').select('*')
      .in('stato', ['OK', 'ERRORE']).order('completata_at', { ascending: false, nullsFirst: false }).limit(1),
    supabase.from('scadenze_bandi_rna_agente').select('*')
      .order('ultimo_contatto_at', { ascending: false }).limit(1),
  ])
  if (attivaRes.error) throw attivaRes.error
  return {
    attiva: attivaRes.data?.[0] || null,
    ultima_completata: okRes.data?.[0] || null,
    agente: agenteRes.data?.[0] || null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    return Response.json({ success: true, data: await stato() })
  } catch (error: unknown) {
    const message = errMsg(error, 'Errore lettura richieste RNA')
    console.error('[API rna/richieste] GET Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const da = String(body.mese_da || '')
    const a = String(body.mese_a || '')
    const corrente = ultimiMesi(1)[0]
    if (!/^\d{4}_\d{2}$/.test(da) || !/^\d{4}_\d{2}$/.test(a)) {
      return Response.json({ success: false, error: 'Mesi non validi (formato AAAA_MM)' }, { status: 400 })
    }
    if (da > a) return Response.json({ success: false, error: 'Il mese iniziale è successivo a quello finale' }, { status: 400 })
    if (da < PRIMO_MESE_RNA) return Response.json({ success: false, error: 'I dati RNA partono da ottobre 2016' }, { status: 400 })
    if (a > corrente) return Response.json({ success: false, error: 'Il mese finale è nel futuro' }, { status: 400 })

    const attuale = await stato()
    if (attuale.attiva) {
      return Response.json({ success: true, data: { ...attuale, gia_in_coda: true } })
    }

    const { error } = await supabase.from('scadenze_bandi_rna_richieste')
      .insert({ mese_da: da, mese_a: a, origine: 'MANUALE', stato: 'IN_ATTESA', richiesta_da: auth.userId })
    if (error) throw error

    return Response.json({ success: true, data: { ...(await stato()), gia_in_coda: false } })
  } catch (error: unknown) {
    const message = errMsg(error, 'Errore creazione richiesta RNA')
    console.error('[API rna/richieste] POST Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
