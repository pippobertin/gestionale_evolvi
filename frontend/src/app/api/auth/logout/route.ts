import { NextResponse } from 'next/server'

/**
 * POST /api/auth/logout
 *
 * Cancella il cookie di sessione `auth_token`. Le righe di
 * scadenze_bandi_sessioni non vengono eliminate: restano come
 * registro degli accessi (utente, data, IP, user agent).
 *
 * Nota: il JWT resta crittograficamente valido fino alla scadenza;
 * la revoca lato server è prevista con la chiusura del database (fase 3).
 */
export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Logout effettuato con successo'
  })

  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  })

  return response
}
