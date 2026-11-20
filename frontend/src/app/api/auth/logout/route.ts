import { NextRequest, NextResponse } from 'next/server'
import { cancellaCookieSessione, revocaSessioneDaToken, tokenDallaRichiesta } from '@/lib/sessioni'

/**
 * POST /api/auth/logout
 *
 * Revoca la sessione nel database (il token non è più accettato da nessuna
 * route, al più entro 30 secondi sulle altre istanze del server) e cancella il
 * cookie. Le righe di scadenze_bandi_sessioni restano come registro degli
 * accessi (utente, data, IP, user agent, metodo, revoca).
 */
export async function POST(request: NextRequest) {
  try {
    await revocaSessioneDaToken(tokenDallaRichiesta(request))
  } catch (error) {
    console.error('Errore revoca sessione:', error)
  }

  const response = NextResponse.json({ success: true, message: 'Logout effettuato con successo' })
  cancellaCookieSessione(response)
  return response
}
