/**
 * Accesso a termine (Modello 231): un utente con accesso_fino_al valorizzato può
 * entrare fino a quel giorno compreso, in ora italiana. Lo stesso controllo è
 * nella funzione SQL gestionale_utente_id(), così il database lo applica anche
 * a chi ha già un badge.
 */

/** Data odierna in Italia nel formato AAAA-MM-GG. */
export function oggiItalia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

/** true se l'accesso è scaduto (il giorno indicato è già passato). */
export function accessoScaduto(accessoFinoAl?: string | null): boolean {
  if (!accessoFinoAl) return false
  return accessoFinoAl.slice(0, 10) < oggiItalia()
}

/** Valida il valore inviato dall'amministratore: data AAAA-MM-GG, stringa vuota o null. */
export function normalizzaAccessoFinoAl(valore: unknown): { ok: true; valore: string | null } | { ok: false } {
  if (valore === null || valore === undefined || valore === '') return { ok: true, valore: null }
  if (typeof valore !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valore)) return { ok: false }
  const d = new Date(`${valore}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valore) return { ok: false }
  return { ok: true, valore }
}
