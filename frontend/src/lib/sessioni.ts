import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import type { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from './supabaseAdmin'

/**
 * Sessioni del gestionale (fase 3, passaggio F).
 *
 * Ogni login crea una riga in scadenze_bandi_sessioni e il token porta il suo
 * identificativo (sid). Il token vive solo nel cookie httpOnly `auth_token`:
 * il codice del browser non lo vede. Il server lo accetta solo se la sessione
 * esiste, non è scaduta, non è stata revocata e l'utente è attivo.
 *
 * SOLO SERVER.
 */

export const COOKIE_SESSIONE = 'auth_token'
export const DURATA_SESSIONE_SECONDI = 7 * 24 * 60 * 60 // 7 giorni

export interface SessioneValida {
  userId: string
  email: string
  livello_permessi: 'admin' | 'collaboratore'
  sid: string
  deve_cambiare_password: boolean
}

function segretoJwt(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET non configurata')
  return secret
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function ipCliente(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || request.headers.get('x-real-ip') || ''
  // la colonna è di tipo inet: si salva solo un indirizzo plausibile
  return /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null
}

/** Crea la sessione nel database e restituisce il token da mettere nel cookie. */
export async function creaSessione(
  utente: { id: string; email: string; livello_permessi: string },
  request: NextRequest,
  metodo: 'password' | 'google'
): Promise<string> {
  const sid = crypto.randomUUID()
  const token = jwt.sign(
    { userId: utente.id, email: utente.email, livello_permessi: utente.livello_permessi, sid },
    segretoJwt(),
    { expiresIn: DURATA_SESSIONE_SECONDI }
  )
  const { error } = await supabaseAdmin.from('scadenze_bandi_sessioni').insert({
    id: sid,
    utente_id: utente.id,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + DURATA_SESSIONE_SECONDI * 1000).toISOString(),
    user_agent: request.headers.get('user-agent') || null,
    ip_address: ipCliente(request),
    metodo
  })
  if (error) throw error
  return token
}

export function impostaCookieSessione(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_SESSIONE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DURATA_SESSIONE_SECONDI,
    path: '/'
  })
}

export function cancellaCookieSessione(response: NextResponse) {
  response.cookies.set(COOKIE_SESSIONE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  })
}

/** Token dal cookie (o, per compatibilità con script e strumenti, dall'header Bearer). */
export function tokenDallaRichiesta(request: NextRequest): string | null {
  const daCookie = request.cookies.get(COOKIE_SESSIONE)?.value
  if (daCookie) return daCookie
  const header = request.headers.get('authorization')
  return header?.startsWith('Bearer ') ? header.substring(7) : null
}

// Piccola memoria per istanza: evita una lettura del database a ogni richiesta.
// Si conservano solo le sessioni pienamente valide e per 30 secondi: una revoca
// o la disattivazione di un utente hanno effetto al più entro 30 secondi.
const MEMORIA_MS = 30_000
const memoria = new Map<string, { sessione: SessioneValida; scade: number }>()

export function dimenticaToken(token: string | null | undefined) {
  if (token) memoria.delete(token)
}

/** Verifica firma, scadenza e stato della sessione. null se non valida. */
export async function verificaSessione(token: string | null | undefined): Promise<SessioneValida | null> {
  if (!token) return null

  const ora = Date.now()
  const inMemoria = memoria.get(token)
  if (inMemoria && inMemoria.scade > ora) return inMemoria.sessione

  let decoded: any
  try {
    decoded = jwt.verify(token, segretoJwt())
  } catch {
    return null
  }
  // I token emessi prima delle sessioni revocabili non hanno sid: non più accettati
  if (!decoded?.sid || !decoded?.userId) return null

  const [{ data: sessione }, { data: utente }] = await Promise.all([
    supabaseAdmin
      .from('scadenze_bandi_sessioni')
      .select('id, utente_id, expires_at, revoked_at')
      .eq('id', decoded.sid)
      .maybeSingle(),
    supabaseAdmin
      .from('scadenze_bandi_utenti')
      .select('id, email, livello_permessi, attivo, first_login_password_change')
      .eq('id', decoded.userId)
      .maybeSingle()
  ])

  if (!sessione || sessione.utente_id !== decoded.userId) return null
  if (sessione.revoked_at) return null
  if (new Date(sessione.expires_at).getTime() <= ora) return null
  if (!utente || !utente.attivo) return null

  const risultato: SessioneValida = {
    userId: utente.id,
    email: utente.email,
    livello_permessi: utente.livello_permessi,
    sid: sessione.id,
    deve_cambiare_password: !!utente.first_login_password_change
  }

  // Chi deve ancora cambiare la password non va in memoria: dopo il cambio
  // l'accesso completo deve partire subito, su qualunque istanza.
  if (!risultato.deve_cambiare_password) {
    if (memoria.size > 500) memoria.clear()
    memoria.set(token, { sessione: risultato, scade: ora + MEMORIA_MS })
  }
  return risultato
}

/** Revoca una sessione (logout). Accetta anche token scaduti, per chiudere comunque la riga. */
export async function revocaSessioneDaToken(token: string | null | undefined) {
  if (!token) return
  dimenticaToken(token)
  let decoded: any
  try {
    decoded = jwt.verify(token, segretoJwt(), { ignoreExpiration: true })
  } catch {
    return
  }
  if (!decoded?.sid) return
  await supabaseAdmin
    .from('scadenze_bandi_sessioni')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', decoded.sid)
    .is('revoked_at', null)
}

/** Revoca tutte le altre sessioni aperte di un utente (dopo il cambio password). */
export async function revocaAltreSessioni(utenteId: string, sidCorrente: string) {
  await supabaseAdmin
    .from('scadenze_bandi_sessioni')
    .update({ revoked_at: new Date().toISOString() })
    .eq('utente_id', utenteId)
    .neq('id', sidCorrente)
    .is('revoked_at', null)
}
