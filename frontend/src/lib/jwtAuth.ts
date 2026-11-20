import { NextRequest } from 'next/server'
import type { Ruolo } from '@/lib/ruoli'
import { verificaSessione, tokenDallaRichiesta } from './sessioni'

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
  livello_permessi: Ruolo
  /** Identificativo della sessione nel database (scadenze_bandi_sessioni.id) */
  sid?: string
  /** true finché l'utente non ha cambiato la password temporanea */
  deve_cambiare_password?: boolean
}

/**
 * Utente collegato, dal cookie di sessione (o dall'header Bearer).
 * Verifica firma e scadenza del token, che la sessione esista e non sia stata
 * revocata, e che l'utente sia attivo; il ruolo è sempre letto dal database.
 */
export async function verifyJWT(request: NextRequest): Promise<JWTPayload | null> {
  try {
    const sessione = await verificaSessione(tokenDallaRichiesta(request))
    if (!sessione) return null
    return {
      userId: sessione.userId,
      email: sessione.email,
      livello_permessi: sessione.livello_permessi,
      sid: sessione.sid,
      deve_cambiare_password: sessione.deve_cambiare_password
    }
  } catch (error) {
    console.error('[verifyJWT] Errore di verifica della sessione')
    return null
  }
}

/** Amministratori e OdV: per la sola lettura dei registri (fase 4C). */
export async function requireAdminOOdv(request: NextRequest): Promise<JWTPayload | null> {
  const payload = await verifyJWT(request)
  if (!payload) return null
  return payload.livello_permessi === 'admin' || payload.livello_permessi === 'odv' ? payload : null
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
