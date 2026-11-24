import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { controllaTuttiIBandi } from '@/lib/controlloBandi'

/**
 * Controllo giornaliero (Vercel Cron) delle pagine dei bandi con progetti in
 * attesa del decreto: segnala i collegamenti nuovi che sembrano graduatorie o
 * documenti e crea le scadenze "Controllare la graduatoria".
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function autorizzato(request: NextRequest): boolean {
  const segreto = process.env.CRON_SECRET
  if (!segreto) return false
  const atteso = Buffer.from(`Bearer ${segreto}`)
  const dato = Buffer.from(request.headers.get('authorization') || '')
  return atteso.length === dato.length && crypto.timingSafeEqual(atteso, dato)
}

export async function GET(request: NextRequest) {
  if (!autorizzato(request)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  const risultati = await controllaTuttiIBandi()
  return NextResponse.json({
    bandi: risultati.length,
    novita: risultati.reduce((s, r) => s + r.novita, 0),
    graduatorie: risultati.reduce((s, r) => s + r.graduatorie, 0),
    scadenze: risultati.reduce((s, r) => s + r.scadenze, 0),
    risultati
  })
}
