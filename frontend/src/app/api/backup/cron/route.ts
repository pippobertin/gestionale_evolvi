import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { eseguiBackup } from '@/lib/backupGestionale'

/**
 * Esportazione mensile automatica (Vercel Cron, vedi vercel.json).
 * Vercel invia Authorization: Bearer <CRON_SECRET> quando la variabile è impostata.
 */
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function autorizzato(request: NextRequest): boolean {
  const segreto = process.env.CRON_SECRET
  const ricevuto = request.headers.get('authorization') || ''
  if (!segreto) return false
  const atteso = Buffer.from(`Bearer ${segreto}`)
  const dato = Buffer.from(ricevuto)
  return atteso.length === dato.length && crypto.timingSafeEqual(atteso, dato)
}

export async function GET(request: NextRequest) {
  if (!autorizzato(request)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }
  const esito = await eseguiBackup('automatica', null)
  return NextResponse.json(
    esito.ok
      ? { ok: true, file: esito.riga.file_nome, righe: esito.riga.conteggi }
      : { ok: false, errore: esito.errore },
    { status: esito.ok ? 200 : 500 }
  )
}
