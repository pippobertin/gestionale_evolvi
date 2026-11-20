import { NextRequest, NextResponse } from 'next/server'
import { verificaSessione, tokenDallaRichiesta } from '@/lib/sessioni'
import { INTESTAZIONE_UTENTE } from '@/lib/identitaRichiesta'
import { consentitoAllOdv, permessoRichiesto } from '@/lib/permessiRoute'
import { etichettaPermesso, haPermesso } from '@/lib/permessi'
import { registraEvento } from '@/lib/registro'

/**
 * Controllo centrale sulle API (fase 3, passaggio C).
 *
 * Ogni richiesta a /api/* deve portare una sessione valida del gestionale
 * (cookie httpOnly `auth_token` oppure header Authorization: Bearer).
 * Dal passaggio F si verifica anche che la sessione esista, non sia stata
 * revocata (logout) e che l'utente sia attivo. Chi deve ancora cambiare la
 * password temporanea può usare solo le route di autenticazione.
 * Il ruolo resta verificato dalle singole route (requireAdmin). Dalla fase 4C
 * qui si verificano anche i permessi configurabili dei collaboratori per le
 * azioni che non si esauriscono nel database (lib/permessiRoute.ts) e la sola
 * lettura dell'OdV.
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
  { prefisso: '/api/backup/cron', motivo: 'cron Vercel: CRON_SECRET' },
  { prefisso: '/api/cron/scadenze-231', motivo: 'cron Vercel: CRON_SECRET' },
  { prefisso: '/api/rna/agente', motivo: 'agente RNA sul Mac: header x-rna-agent-secret' },
  { prefisso: '/api/user/gmail/callback', motivo: 'ritorno da Google OAuth' },
]

function nonAutenticato() {
  return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
}

/**
 * Identità per il registro delle operazioni (fase 4A): il proxy aggiunge alla
 * richiesta l'utente della sessione verificata, e il client del server la
 * inoltra al database (lib/supabaseAdmin.ts). Un valore inviato dal browser
 * viene sempre scartato.
 */

function prosegui(request: NextRequest, utenteId: string | null) {
  const intestazioni = new Headers(request.headers)
  intestazioni.delete(INTESTAZIONE_UTENTE)
  if (utenteId) intestazioni.set(INTESTAZIONE_UTENTE, utenteId)
  return NextResponse.next({ request: { headers: intestazioni } })
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBBLICHE.some(p => pathname === p.prefisso.replace(/\/$/, '') || pathname.startsWith(p.prefisso))) {
    // Route con autenticazione propria: se c'è comunque una sessione valida
    // (per esempio il cambio password), l'operazione viene attribuita alla persona.
    const token = tokenDallaRichiesta(request)
    const sessione = token && process.env.JWT_SECRET ? await verificaSessione(token) : null
    return prosegui(request, sessione?.userId ?? null)
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

  // Permessi (fase 4C): gli amministratori passano sempre
  if (sessione.livello_permessi !== 'admin') {
    const metodo = request.method.toUpperCase()
    if (sessione.livello_permessi === 'odv') {
      if (!consentitoAllOdv(metodo, pathname)) {
        // Senza registrazione né avviso: l'interfaccia dell'OdV non chiama altre API
        return NextResponse.json({ error: 'Il ruolo OdV consulta solo i registri', code: 'PERMESSO_NEGATO' }, { status: 403 })
      }
    } else {
      const permesso = permessoRichiesto(metodo, pathname)
      if (permesso && !(await haPermesso(sessione.livello_permessi, permesso))) {
        const etichetta = await etichettaPermesso(permesso)
        return negato(request, sessione.userId, `Permesso negato: ${etichetta.toLowerCase()}`, permesso)
      }
    }
  }

  return prosegui(request, sessione.userId)
}

async function negato(request: NextRequest, utenteId: string, messaggio: string, permesso: string | null) {
  await registraEvento({
    evento: 'permesso_negato', esito: 'negato', utenteId, request,
    descrizione: messaggio,
    dettagli: { metodo: request.method, percorso: request.nextUrl.pathname, permesso }
  })
  return NextResponse.json(
    { error: messaggio, code: 'PERMESSO_NEGATO', permesso },
    { status: 403, headers: { 'x-gestionale-negato': '1' } }
  )
}

export const config = {
  matcher: ['/api/:path*'],
}
