/**
 * Identità di chi sta operando, per il registro delle operazioni (fase 4A).
 *
 * Il proxy (src/proxy.ts) verifica la sessione e aggiunge alla richiesta
 * l'intestazione INTESTAZIONE_UTENTE, scartando sempre quella inviata dal browser.
 * Il client del server (lib/supabaseAdmin.ts) la legge con utenteDellaRichiesta()
 * e la inoltra al database come x-gestionale-utente; il trigger del registro la
 * accetta solo dalle richieste fatte con la chiave di servizio.
 */
export const INTESTAZIONE_UTENTE = 'x-gestionale-utente-id'
export const INTESTAZIONE_DATABASE = 'x-gestionale-utente'

const UUID = /^[0-9a-fA-F-]{36}$/

/** Utente della richiesta in corso, se la route gira dentro una richiesta autenticata. */
export async function utenteDellaRichiesta(): Promise<string | null> {
  try {
    const { headers } = await import('next/headers')
    const valore = (await headers()).get(INTESTAZIONE_UTENTE)
    return valore && UUID.test(valore) ? valore : null
  } catch {
    // Fuori da una richiesta (cron, script, proxy): nessun utente
    return null
  }
}
