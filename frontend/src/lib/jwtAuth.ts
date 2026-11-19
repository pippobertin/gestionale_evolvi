import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from './supabaseAdmin'

/**
 * Segreto per firmare e verificare i JWT dell'applicazione.
 * Nessun valore di ripiego: se la variabile manca, l'operazione fallisce
 * invece di usare una chiave nota a chiunque legga il codice.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET non configurata')
  }
  return secret
}

export interface JWTPayload {
  userId: string
  email: string
  livello_permessi: 'admin' | 'collaboratore'
}

export async function verifyJWT(request: NextRequest): Promise<JWTPayload | null> {
  try {
    // Cerca il token nel cookie o nell'header Authorization
    const tokenFromCookie = request.cookies.get('auth_token')?.value
    const authHeader = request.headers.get('authorization')
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

    const token = tokenFromCookie || tokenFromHeader
    if (!token) {
      return null
    }

    const decoded = jwt.verify(token, getJwtSecret()) as JWTPayload

    // Verifica che l'utente esista ancora e sia attivo (ruolo sempre letto dal DB)
    const { data: user, error } = await supabaseAdmin
      .from('scadenze_bandi_utenti')
      .select('id, email, livello_permessi, attivo')
      .eq('id', decoded.userId)
      .eq('attivo', true)
      .single()

    if (error || !user) {
      return null
    }

    return {
      userId: user.id,
      email: user.email,
      livello_permessi: user.livello_permessi
    }
  } catch (error) {
    console.error('[verifyJWT] Token non valido o errore di verifica')
    return null
  }
}

export async function requireAdmin(request: NextRequest): Promise<JWTPayload | null> {
  const payload = await verifyJWT(request)

  if (!payload) {
    return null
  }

  if (payload.livello_permessi !== 'admin') {
    return null
  }

  return payload
}
