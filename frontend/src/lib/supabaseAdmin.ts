import { createClient } from '@supabase/supabase-js'
import { INTESTAZIONE_DATABASE, utenteDellaRichiesta } from './identitaRichiesta'

/**
 * Client Supabase con SERVICE ROLE KEY.
 *
 * IMPORTANTE: usare SOLO da codice server-side (API routes, server actions).
 * Bypassa Row Level Security. Mai importare da componenti client/browser.
 *
 * Richiede env var: SUPABASE_SERVICE_ROLE_KEY (NON con prefisso NEXT_PUBLIC_).
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL non configurata')
}

if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY non configurata')
}

/**
 * Ogni chiamata al database porta l'utente della richiesta in corso, se c'è:
 * il registro delle operazioni attribuisce così le modifiche alla persona e non
 * genericamente al "server" (fase 4A).
 */
async function fetchConUtente(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const utente = await utenteDellaRichiesta()
  if (!utente) return fetch(input, init)
  const intestazioni = new Headers(init?.headers)
  intestazioni.set(INTESTAZIONE_DATABASE, utente)
  return fetch(input, { ...init, headers: intestazioni })
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    fetch: fetchConUtente,
  },
})
