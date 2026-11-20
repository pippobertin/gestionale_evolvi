/** Ruoli del gestionale (fase 4C). Usabile da server e interfaccia. */

export type Ruolo = 'admin' | 'collaboratore' | 'collaboratore_limitato' | 'odv'

export const RUOLI: Ruolo[] = ['admin', 'collaboratore', 'collaboratore_limitato', 'odv']

/** Ruoli con permessi configurabili dagli amministratori. */
export const RUOLI_CONFIGURABILI: Ruolo[] = ['collaboratore', 'collaboratore_limitato']

export const ETICHETTE_RUOLO: Record<Ruolo, string> = {
  admin: 'Amministratore',
  collaboratore: 'Collaboratore',
  collaboratore_limitato: 'Collaboratore limitato',
  odv: 'OdV (sola lettura dei registri)'
}

export function eRuolo(valore: unknown): valore is Ruolo {
  return typeof valore === 'string' && (RUOLI as string[]).includes(valore)
}

/** Chiavi dei permessi configurabili (il catalogo con etichette è nel database). */
export type Permesso =
  | 'dati.modifica'
  | 'dati_economici.modifica'
  | 'elementi.elimina'
  | 'entita.elimina'
  | 'contratti.genera'
  | 'contratti.approva'
  | 'contratti.registra_firmato'
  | 'email.invia'
  | 'riferimento.modifica'
