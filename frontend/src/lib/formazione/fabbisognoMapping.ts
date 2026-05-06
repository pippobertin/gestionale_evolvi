/**
 * Mappatura tra le righe del questionario di rilevazione fabbisogno (sezione C)
 * e i tipo_obbligo granulari della tabella scadenze_bandi_certificazioni_obbligatorie.
 *
 * Il questionario presenta categorie aggregate (es. "Antincendio basso/medio/alto"
 * come singola riga). Quando si calcola lo stato pre-compilato leggiamo dalla
 * tabella certificazioni TUTTE le certificazioni granulari mappate sulla
 * categoria, e teniamo lo stato peggiore.
 */

export type TipoObbligo =
  | 'FORMAZIONE_LAVORATORI_RISCHIO_BASSO'
  | 'FORMAZIONE_LAVORATORI_RISCHIO_MEDIO'
  | 'FORMAZIONE_LAVORATORI_RISCHIO_ALTO'
  | 'RSPP'
  | 'DIRIGENTI_SSL'
  | 'PREPOSTI'
  | 'RLS'
  | 'ANTINCENDIO_BASSO'
  | 'ANTINCENDIO_MEDIO'
  | 'ANTINCENDIO_ALTO'
  | 'PRIMO_SOCCORSO'
  | 'HACCP'
  | 'PRIVACY_GDPR'
  | 'ANTIRICICLAGGIO'
  | 'RESPONSABILITA_AMMINISTRATIVA_231'
  | 'USO_ATTREZZATURE'
  | 'ALTRO'

export type StatoDichiarato =
  | 'ADEMPIUTO'
  | 'DA_RINNOVARE'
  | 'NON_SVOLTO'
  | 'NON_APPLICABILE'

/**
 * Categorie del questionario (sezione C).
 * Ogni categoria mappa su uno o piu' tipo_obbligo granulari.
 * La categoria id viene salvata in obblighi_dichiarati.tipo_obbligo
 * usando il "tipo_obbligo rappresentativo" (il primo della lista).
 */
export interface CategoriaQuestionario {
  id: string                          // identificativo logico nel form
  label: string                       // etichetta mostrata al cliente
  tipi_obbligo: TipoObbligo[]         // tipi granulari mappati (per pre-compilazione)
  rappresentante: TipoObbligo         // tipo da salvare in obblighi_dichiarati
}

export const CATEGORIE_QUESTIONARIO_C: CategoriaQuestionario[] = [
  {
    id: 'sicurezza_lavoratori',
    label: 'Sicurezza sul lavoro — Lavoratori (D.Lgs. 81/08)',
    tipi_obbligo: [
      'FORMAZIONE_LAVORATORI_RISCHIO_BASSO',
      'FORMAZIONE_LAVORATORI_RISCHIO_MEDIO',
      'FORMAZIONE_LAVORATORI_RISCHIO_ALTO',
    ],
    rappresentante: 'FORMAZIONE_LAVORATORI_RISCHIO_MEDIO',
  },
  {
    id: 'sicurezza_preposti',
    label: 'Sicurezza sul lavoro — Preposti',
    tipi_obbligo: ['PREPOSTI'],
    rappresentante: 'PREPOSTI',
  },
  {
    id: 'sicurezza_dirigenti',
    label: 'Sicurezza sul lavoro — Dirigenti / Datori di lavoro',
    tipi_obbligo: ['DIRIGENTI_SSL'],
    rappresentante: 'DIRIGENTI_SSL',
  },
  {
    id: 'rls',
    label: 'RLS — Rappresentante dei Lavoratori per la Sicurezza',
    tipi_obbligo: ['RLS'],
    rappresentante: 'RLS',
  },
  {
    id: 'antincendio',
    label: 'Antincendio (basso / medio / alto rischio)',
    tipi_obbligo: ['ANTINCENDIO_BASSO', 'ANTINCENDIO_MEDIO', 'ANTINCENDIO_ALTO'],
    rappresentante: 'ANTINCENDIO_MEDIO',
  },
  {
    id: 'primo_soccorso',
    label: 'Primo Soccorso',
    tipi_obbligo: ['PRIMO_SOCCORSO'],
    rappresentante: 'PRIMO_SOCCORSO',
  },
  {
    id: 'privacy_gdpr',
    label: 'Privacy / GDPR (D.Lgs. 196/03 e Reg. UE 679/16)',
    tipi_obbligo: ['PRIVACY_GDPR'],
    rappresentante: 'PRIVACY_GDPR',
  },
  {
    id: 'responsabilita_231',
    label: 'Responsabilità amministrativa (D.Lgs. 231/01)',
    tipi_obbligo: ['RESPONSABILITA_AMMINISTRATIVA_231'],
    rappresentante: 'RESPONSABILITA_AMMINISTRATIVA_231',
  },
  {
    id: 'uso_attrezzature',
    label: 'Uso di attrezzature / macchine (Accordo Stato-Regioni)',
    tipi_obbligo: ['USO_ATTREZZATURE'],
    rappresentante: 'USO_ATTREZZATURE',
  },
]

/**
 * Calcola lo stato pre-compilato per una categoria del questionario, dato l'elenco
 * delle certificazioni del cliente. Logica:
 *   - se il cliente ha almeno una cert tra i tipi mappati con scadenza > 90gg → ADEMPIUTO
 *   - se ha una cert con scadenza < 90gg o gia' scaduta → DA_RINNOVARE
 *   - se NON ha alcuna cert mappata → NON_SVOLTO
 *
 * Quando la categoria mappa su piu' tipi (es. antincendio basso/medio/alto)
 * tiene lo stato "peggiore" tra quelli rilevati.
 */
export function calcolaStatoPrecompilato(
  categoria: CategoriaQuestionario,
  certificazioni: Array<{ tipo_obbligo: string; data_scadenza: string | null }>
): StatoDichiarato | null {
  const certRilevanti = certificazioni.filter(c =>
    categoria.tipi_obbligo.includes(c.tipo_obbligo as TipoObbligo)
  )

  if (certRilevanti.length === 0) {
    return null  // nessun dato nel gestionale: non pre-compiliamo
  }

  // Calcola lo stato di ogni certificazione e tieni il peggiore
  const statiRilevati = certRilevanti.map(c => statoSingolaCert(c.data_scadenza))
  if (statiRilevati.includes('NON_SVOLTO')) return 'NON_SVOLTO'
  if (statiRilevati.includes('DA_RINNOVARE')) return 'DA_RINNOVARE'
  return 'ADEMPIUTO'
}

function statoSingolaCert(dataScadenza: string | null): StatoDichiarato {
  if (!dataScadenza) return 'NON_SVOLTO'
  const ora = Date.now()
  const scad = new Date(dataScadenza).getTime()
  const giorni = Math.ceil((scad - ora) / (1000 * 60 * 60 * 24))
  if (giorni < 0) return 'DA_RINNOVARE'
  if (giorni <= 90) return 'DA_RINNOVARE'
  return 'ADEMPIUTO'
}
