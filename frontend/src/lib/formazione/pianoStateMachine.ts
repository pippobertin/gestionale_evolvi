/**
 * State machine for Piano Formativo lifecycle.
 * Defines valid transitions and preconditions for each state change.
 */

export type StatoPiano =
  | 'BOZZA'
  | 'IN_PRESENTAZIONE'
  | 'PRESENTATO'
  | 'APPROVATO'
  | 'IN_EROGAZIONE'
  | 'CONCLUSO'
  | 'RENDICONTATO'
  | 'SALDATO'
  | 'RESPINTO'
  | 'ANNULLATO'

interface PianoFields {
  data_presentazione?: string | null
  data_approvazione?: string | null
  importo_approvato?: number | null
  data_inizio_attivita?: string | null
  data_fine_attivita?: string | null
  data_scadenza_rendicontazione?: string | null
  data_saldo?: string | null
  importo_saldato?: number | null
}

interface TransitionResult {
  valid: boolean
  error?: string
}

// Map of valid transitions: fromState -> array of toStates
const TRANSITIONS: Record<StatoPiano, StatoPiano[]> = {
  BOZZA: ['IN_PRESENTAZIONE', 'ANNULLATO'],
  IN_PRESENTAZIONE: ['PRESENTATO', 'ANNULLATO'],
  PRESENTATO: ['APPROVATO', 'RESPINTO'],
  APPROVATO: ['IN_EROGAZIONE', 'ANNULLATO'],
  IN_EROGAZIONE: ['CONCLUSO', 'ANNULLATO'],
  CONCLUSO: ['RENDICONTATO'],
  RENDICONTATO: ['SALDATO'],
  SALDATO: [],
  RESPINTO: [],
  ANNULLATO: [],
}

// Preconditions: fields required to enter a given state
const PRECONDITIONS: Partial<Record<StatoPiano, (fields: PianoFields) => string | null>> = {
  PRESENTATO: (f) => {
    if (!f.data_presentazione) return 'Data presentazione obbligatoria'
    return null
  },
  APPROVATO: (f) => {
    if (!f.data_approvazione) return 'Data approvazione obbligatoria'
    if (!f.importo_approvato && f.importo_approvato !== 0) return 'Importo approvato obbligatorio'
    return null
  },
  IN_EROGAZIONE: (f) => {
    if (!f.data_inizio_attivita) return 'Data inizio attività obbligatoria'
    return null
  },
  CONCLUSO: (f) => {
    if (!f.data_fine_attivita) return 'Data fine attività obbligatoria'
    return null
  },
  RENDICONTATO: (f) => {
    if (!f.data_scadenza_rendicontazione) return 'Data scadenza rendicontazione obbligatoria'
    return null
  },
  SALDATO: (f) => {
    if (!f.data_saldo) return 'Data saldo obbligatoria'
    if (!f.importo_saldato && f.importo_saldato !== 0) return 'Importo saldato obbligatorio'
    return null
  },
}

/**
 * Check if a state transition is valid and all preconditions are met.
 */
export function canTransition(
  fromState: StatoPiano,
  toState: StatoPiano,
  fields: PianoFields
): TransitionResult {
  const validTargets = TRANSITIONS[fromState]
  if (!validTargets || !validTargets.includes(toState)) {
    return {
      valid: false,
      error: `Transizione non consentita: ${fromState} → ${toState}`,
    }
  }

  const preconditionCheck = PRECONDITIONS[toState]
  if (preconditionCheck) {
    const error = preconditionCheck(fields)
    if (error) {
      return { valid: false, error }
    }
  }

  return { valid: true }
}

/**
 * Get the list of valid next states from a given state.
 */
export function getValidNextStates(fromState: StatoPiano): StatoPiano[] {
  return TRANSITIONS[fromState] || []
}

/**
 * Human-readable label for each state.
 */
export const STATO_PIANO_LABELS: Record<StatoPiano, string> = {
  BOZZA: 'Bozza',
  IN_PRESENTAZIONE: 'In presentazione',
  PRESENTATO: 'Presentato',
  APPROVATO: 'Approvato',
  IN_EROGAZIONE: 'In erogazione',
  CONCLUSO: 'Concluso',
  RENDICONTATO: 'Rendicontato',
  SALDATO: 'Saldato',
  RESPINTO: 'Respinto',
  ANNULLATO: 'Annullato',
}

/**
 * Color classes for each state (Tailwind).
 */
export const STATO_PIANO_COLORS: Record<StatoPiano, string> = {
  BOZZA: 'bg-gray-100 text-gray-700',
  IN_PRESENTAZIONE: 'bg-blue-100 text-blue-700',
  PRESENTATO: 'bg-indigo-100 text-indigo-700',
  APPROVATO: 'bg-green-100 text-green-700',
  IN_EROGAZIONE: 'bg-teal-100 text-teal-700',
  CONCLUSO: 'bg-cyan-100 text-cyan-700',
  RENDICONTATO: 'bg-purple-100 text-purple-700',
  SALDATO: 'bg-emerald-100 text-emerald-700',
  RESPINTO: 'bg-red-100 text-red-700',
  ANNULLATO: 'bg-gray-200 text-gray-500',
}
