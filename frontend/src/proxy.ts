import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

/**
 * Controllo centrale sulle API (fase 3, passaggio C).
 *
 * Ogni richiesta a /api/* deve portare una sessione valida del gestionale
 * (cookie httpOnly `auth_token` oppure header Authorization: Bearer).
 * Qui si verifica solo firma e scadenza del token; ruolo e stato dell'utente
 * restano verificati dalle singole route (verifyJWT / requireAdmin).
 *
 * Eccezioni esplicite: route con un proprio meccanismo di autenticazione.
 */

const PUBBLICHE: { prefisso: string; motivo: string }[] = [
  { prefisso: '/api/auth/', motivo: 'login, logout, sessione Google, badge: verificano da sé' },
  { prefisso: '/api/fabbisogno/', motivo: 'questionario pubblico: accesso con token del questionario' },
  { prefisso: '/api/notes/ingest', motivo: 'n8n: header x-ingest-secret' },
  { prefisso: '/api/clienti/match', motivo: 'n8n: header x-ingest-secret' },
  { prefisso: '/api/bandi-esterni/ingest-gmail', motivo: 'cron Vercel: CRON_SECRET / x-ingest-secret' },
  { prefisso: '/api/rna/sync', motivo: 'CRON_SECRET / INGEST_SECRET' },
  { prefisso: '/api/rna/agente', motivo: 'agente RNA sul Mac: header x-rna-agent-secret' },
  { prefisso: '/api/user/gmail/callback', motivo: 'ritorno da Google OAuth' },
]

function nonAutenticato() {
  return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBBLICHE.some(p => pathname === p.prefisso.replace(/\/$/, '') || pathname.startsWith(p.prefisso))) {
    return NextResponse.next()
  }

  const segreto = process.env.JWT_SECRET
  if (!segreto) {
    return NextResponse.json({ error: 'Configurazione server incompleta' }, { status: 500 })
  }

  const daCookie = request.cookies.get('auth_token')?.value
  const header = request.headers.get('authorization')
  const daHeader = header?.startsWith('Bearer ') ? header.substring(7) : null
  const token = daCookie || daHeader
  if (!token) return nonAutenticato()

  try {
    jwt.verify(token, segreto)
  } catch {
    // Il cookie potrebbe essere scaduto ma l'header valido (o viceversa)
    if (daHeader && daHeader !== daCookie) {
      try {
        jwt.verify(daHeader, segreto)
        return NextResponse.next()
      } catch {
        return nonAutenticato()
      }
    }
    return nonAutenticato()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
