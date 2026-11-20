import type { Permesso } from './ruoli'

/**
 * Permessi richiesti dalle API per le azioni che non si esauriscono nel
 * database (invio di email e contratti, file su Drive): il proxy li verifica
 * prima che l'azione parta. Le scritture nel database sono comunque controllate
 * anche dal database (fase 4C). Valgono per collaboratori e collaboratori
 * limitati; gli amministratori passano sempre.
 */

type Regola = { metodo: string; schema: RegExp; permesso: Permesso }

const ID = '[^/]+'

const REGOLE: Regola[] = [
  // Contratti: approvazione e invio
  { metodo: 'POST', schema: /^\/api\/contracts\/approve$/, permesso: 'contratti.approva' },
  { metodo: 'POST', schema: /^\/api\/contracts\/generate-and-send$/, permesso: 'contratti.approva' },
  { metodo: 'POST', schema: /^\/api\/contracts\/send-email$/, permesso: 'contratti.approva' },
  { metodo: 'POST', schema: /^\/api\/contracts\/evolvi\/approve$/, permesso: 'contratti.approva' },
  { metodo: 'POST', schema: /^\/api\/contracts\/evolvi\/send-email$/, permesso: 'contratti.approva' },
  { metodo: 'POST', schema: /^\/api\/contracts\/evolvi\/renew$/, permesso: 'contratti.approva' },
  { metodo: 'POST', schema: new RegExp(`^/api/contracts/tracking/${ID}/send-reminder$`), permesso: 'contratti.approva' },
  // Contratti: bozze
  { metodo: 'POST', schema: /^\/api\/contracts\/generate$/, permesso: 'contratti.genera' },
  { metodo: 'POST', schema: /^\/api\/contracts\/evolvi\/generate$/, permesso: 'contratti.genera' },
  { metodo: 'POST', schema: /^\/api\/contracts\/evolvi$/, permesso: 'contratti.genera' },
  // Contratti firmati
  { metodo: 'POST', schema: new RegExp(`^/api/contracts/tracking/${ID}/register-signed$`), permesso: 'contratti.registra_firmato' },
  { metodo: 'POST', schema: new RegExp(`^/api/contracts/tracking/${ID}/upload-signed$`), permesso: 'contratti.registra_firmato' },
  // Email
  { metodo: 'POST', schema: /^\/api\/gmail\/send$/, permesso: 'email.invia' },
  { metodo: 'POST', schema: /^\/api\/interrogazioni\/email-bulk$/, permesso: 'email.invia' },
  { metodo: 'POST', schema: new RegExp(`^/api/clienti/${ID}/formazione/fabbisogno/${ID}/(send-email|invia)$`), permesso: 'email.invia' },
  // Eliminazioni di entità principali che passano dal server
  { metodo: 'DELETE', schema: new RegExp(`^/api/prospect/${ID}$`), permesso: 'entita.elimina' },
  { metodo: 'DELETE', schema: new RegExp(`^/api/contracts/evolvi/${ID}$`), permesso: 'entita.elimina' },
  // Tabelle di riferimento
  { metodo: 'POST', schema: /^\/api\/formazione\/import-ccnl$/, permesso: 'riferimento.modifica' },
  { metodo: 'POST', schema: /^\/api\/prospect\/profiling-template$/, permesso: 'riferimento.modifica' },
  { metodo: 'PUT', schema: /^\/api\/prospect\/profiling-template$/, permesso: 'riferimento.modifica' }
]

/** Eliminazioni che non riguardano i dati del gestionale (la propria casella Gmail). */
const ELIMINAZIONI_PERSONALI = [new RegExp(`^/api/gmail/messages/${ID}$`)]

export function permessoRichiesto(metodo: string, percorso: string): Permesso | null {
  const regola = REGOLE.find(r => r.metodo === metodo && r.schema.test(percorso))
  if (regola) return regola.permesso
  // Ogni altra eliminazione: elementi collegati (documenti, formazione, contributi...)
  if (metodo === 'DELETE' && !percorso.startsWith('/api/admin/') && !ELIMINAZIONI_PERSONALI.some(s => s.test(percorso))) {
    return 'elementi.elimina'
  }
  return null
}

/** OdV: solo autenticazione e lettura dei registri (registro attività, backup). */
export function consentitoAllOdv(metodo: string, percorso: string): boolean {
  if (percorso.startsWith('/api/auth/')) return true
  if (metodo !== 'GET') return false
  return percorso === '/api/admin/registro' || percorso === '/api/backup'
}
