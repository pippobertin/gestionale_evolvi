import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { isDbTokenEnabled, mintDbToken } from '@/lib/supabaseDbToken'

/**
 * GET /api/auth/db-token
 * Rilascia all'utente collegato il badge per il database (durata 1 ora).
 * 401 se non autenticato; 503 se il badge non è ancora attivato
 * (manca SUPABASE_JWT_SECRET): il browser in quel caso usa la chiave pubblica.
 */
export async function GET(request: NextRequest) {
  const user = await verifyJWT(request)
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }
  if (!isDbTokenEnabled()) {
    return NextResponse.json({ error: 'Badge database non attivo' }, { status: 503 })
  }
  const { token, expiresAt } = mintDbToken(user)
  return NextResponse.json(
    { token, expiresAt },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
