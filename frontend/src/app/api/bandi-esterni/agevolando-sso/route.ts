import { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'

/**
 * GET /api/bandi-esterni/agevolando-sso?url=<pagina bando>
 *
 * "SSO" verso Agevolando (aMember Pro). Restituisce una pagina che si auto-invia
 * alla login di Agevolando con le credenziali del nostro account in abbonamento,
 * impostando come redirect post-login la pagina del bando richiesta. Risultato:
 * l'utente atterra sul dettaglio del bando gia' loggato, senza login manuale.
 *
 * Sicurezza:
 *  - Protetto da verifyJWT: solo gli utenti loggati al gestionale possono usarlo.
 *  - Credenziali SOLO da env (AGEVOLANDO_LOGIN/AGEVOLANDO_PASSWORD), mai in codice.
 *  - `url` validato: il redirect deve restare su *.agevolando.eu (no open-redirect).
 *  - no-store: la risposta (che contiene la password nel form) non va in cache.
 *
 * Limite noto (opzione "auto-login lato browser"): la password transita comunque
 * nel browser dell'utente (deve, per far ottenere AL SUO browser il cookie di
 * Agevolando). Account condiviso a uso interno. Se Agevolando dovesse rifiutare
 * i POST cross-origin (controllo header Origin), questa via non funziona e
 * serve un proxy server-side.
 */

const LOGIN_URL = 'https://dashboard.agevolando.eu/hd/login'
const DEFAULT_REDIRECT = 'https://dashboard.agevolando.eu/'

export async function GET(req: NextRequest) {
  const user = await verifyJWT(req)
  if (!user) {
    return new Response('Non autenticato', { status: 401 })
  }

  const login = process.env.AGEVOLANDO_LOGIN
  const pass = process.env.AGEVOLANDO_PASSWORD
  if (!login || !pass) {
    return new Response(
      'Credenziali Agevolando non configurate (AGEVOLANDO_LOGIN / AGEVOLANDO_PASSWORD).',
      { status: 412 }
    )
  }

  // Valida il redirect: deve restare su agevolando.eu (evita open-redirect e
  // l'uso delle nostre credenziali per POST verso login altrui).
  let redirect = DEFAULT_REDIRECT
  const target = new URL(req.url).searchParams.get('url')
  if (target) {
    try {
      const u = new URL(target)
      if (
        u.protocol === 'https:' &&
        (u.hostname === 'agevolando.eu' || u.hostname.endsWith('.agevolando.eu'))
      ) {
        redirect = u.toString()
      }
    } catch {
      /* url malformato: resta il default */
    }
  }

  const attemptId = Math.floor(Date.now() / 1000).toString()

  const html = `<!doctype html>
<html lang="it">
<head><meta charset="utf-8"><title>Accesso ad Agevolando…</title></head>
<body style="font-family:system-ui,sans-serif;color:#334155;padding:2rem" onload="document.forms[0].submit()">
  <p>Accesso ad Agevolando in corso…</p>
  <form method="post" action="${LOGIN_URL}">
    <input type="hidden" name="amember_login" value="${escapeHtml(login)}">
    <input type="hidden" name="amember_pass" value="${escapeHtml(pass)}">
    <input type="hidden" name="login_attempt_id" value="${attemptId}">
    <input type="hidden" name="amember_redirect_url" value="${escapeHtml(redirect)}">
    <noscript><button type="submit">Continua su Agevolando</button></noscript>
  </form>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
