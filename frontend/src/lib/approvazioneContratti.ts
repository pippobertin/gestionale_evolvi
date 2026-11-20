/**
 * Separazione dei compiti sui contratti (Modello 231, fase 4C): chi ha generato
 * la bozza non la approva, salvo deroga motivata che resta nel registro.
 */

export const MIN_DEROGA = 15

export type EsitoSeparazione =
  | { ok: true; deroga: string | null }
  | { ok: false; risposta: Response }

export function verificaSeparazione(
  generatoDa: string | null | undefined,
  approvatore: string | null | undefined,
  deroga: unknown
): EsitoSeparazione {
  // Bozze precedenti alla regola (autore sconosciuto): nessun vincolo
  if (!generatoDa || !approvatore || generatoDa !== approvatore) return { ok: true, deroga: null }
  const motivo = typeof deroga === 'string' ? deroga.trim() : ''
  if (motivo.length >= MIN_DEROGA) return { ok: true, deroga: motivo.slice(0, 1000) }
  return {
    ok: false,
    risposta: Response.json({
      success: false,
      code: 'DEROGA_RICHIESTA',
      message: `Hai generato tu questa bozza: per approvarla serve un'altra persona oppure una motivazione di deroga (almeno ${MIN_DEROGA} caratteri).`
    }, { status: 409 })
  }
}
