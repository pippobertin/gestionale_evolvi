import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Controllo giornaliero (Vercel Cron): integrazioni e rendiconti con la
 * scadenza superata senza invio vengono segnalati ad AU e OdV nel registro
 * attività, una volta per scadenza (PR.01 §4.3.6).
 */
export const dynamic = 'force-dynamic'

function autorizzato(request: NextRequest): boolean {
  const segreto = process.env.CRON_SECRET
  if (!segreto) return false
  const atteso = Buffer.from(`Bearer ${segreto}`)
  const dato = Buffer.from(request.headers.get('authorization') || '')
  return atteso.length === dato.length && crypto.timingSafeEqual(atteso, dato)
}

export async function GET(request: NextRequest) {
  if (!autorizzato(request)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  const { data, error } = await supabaseAdmin.rpc('gestionale_segnala_ritardi')
  if (error) return NextResponse.json({ ok: false, errore: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, segnalati: data })
}
