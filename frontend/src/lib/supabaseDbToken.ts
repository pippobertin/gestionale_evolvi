import jwt from 'jsonwebtoken'

/**
 * "Badge" per il database (fase 3).
 *
 * Token firmato con il segreto JWT del progetto Supabase che identifica
 * l'utente del gestionale presso il database. Il database lo usa nelle
 * regole di accesso (funzioni gestionale_utente_id / gestionale_is_admin).
 *
 * SOLO SERVER: richiede SUPABASE_JWT_SECRET, che non deve mai arrivare al browser.
 * Se la variabile manca il badge non viene rilasciato e il gestionale continua
 * a funzionare come prima (chiave pubblica): è l'interruttore di attivazione.
 */

export const DB_TOKEN_APP = 'gestionale_evolvi'
// 15 minuti, rinnovato automaticamente dal browser quando ne mancano meno di 5:
// dopo un logout o la disattivazione dell'utente un badge già rilasciato
// resta utilizzabile al più per questo tempo.
const DB_TOKEN_TTL_SECONDS = 15 * 60

export function isDbTokenEnabled(): boolean {
  return !!process.env.SUPABASE_JWT_SECRET
}

export function mintDbToken(user: { userId: string; email: string; livello_permessi: string }) {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET non configurata')
  }
  const now = Math.floor(Date.now() / 1000)
  const exp = now + DB_TOKEN_TTL_SECONDS
  const token = jwt.sign(
    {
      sub: user.userId,
      email: user.email,
      role: 'authenticated', // ruolo Postgres usato da PostgREST
      aud: 'authenticated',
      app: DB_TOKEN_APP, // distingue il gestionale dalle altre app del progetto
      gestionale_ruolo: user.livello_permessi,
      // Ambiente (preview, production): il controllo dei permessi nel database
      // può essere attivato prima sull'anteprima (fase 4C)
      amb: process.env.VERCEL_ENV || 'development',
      iat: now,
      exp
    },
    secret,
    { algorithm: 'HS256' }
  )
  return { token, expiresAt: exp }
}
