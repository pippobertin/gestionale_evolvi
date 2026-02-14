import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabase } from './supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'

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

    // Verifica il token JWT
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload

    // Verifica che l'utente esista ancora e sia attivo
    const { data: user, error } = await supabase
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
    console.error('Errore verifica JWT:', error)
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
