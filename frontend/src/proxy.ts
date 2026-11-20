import { NextRequest, NextResponse } from 'next/server'
import { verificaSessione, tokenDallaRichiesta } from '@/lib/sessioni'

/**
 * Controllo centrale sulle API (fase 3, passaggio C).
 *
 * Ogni richiesta a /api/* deve portare una sessione valida del gestionale
 * (cookie httpOnly `auth_token` oppure header Authorization: Bearer).
 * Dal passaggio F si verifica anche che la sessione esista, non sia stata
 * revocata (logout) e che l'utente sia attivo. Chi deve ancora cambiare la
 * password temporanea può usare solo le route di autenticazione.
 * Il ruolo resta verificato dalle singole route (requireAdmin).
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBBLICHE.some(p => pathname === p.prefisso.replace(/\/$/, '') || pathname.startsWith(p.prefisso))) {
    return NextResponse.next()
  }

  if (!process.env.JWT_SECRET) {
    return NextResponse.json({ error: 'Configurazione server incompleta' }, { status: 500 })
  }

  const sessione = await verificaSessione(tokenDallaRichiesta(request))
  if (!sessione) return nonAutenticato()

  if (sessione.deve_cambiare_password) {
    return NextResponse.json(
      { error: 'Cambio password obbligatorio', code: 'PASSWORD_CHANGE_REQUIRED' },
      { status: 403 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
