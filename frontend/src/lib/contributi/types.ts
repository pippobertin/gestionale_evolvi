export type ContributoForma =
  | 'FONDO_PERDUTO'
  | 'CREDITO_IMPOSTA'
  | 'FINANZIAMENTO_AGEVOLATO'
  | 'GARANZIA'
  | 'CONTRIBUTO_INTERESSI'
  | 'MISTO'

export type ContributoStato =
  | 'AMMESSO'
  | 'CONCESSO'
  | 'EROGATO_PARZIALE'
  | 'EROGATO_TOTALE'
  | 'REVOCATO'
  | 'RINUNCIATO'

// DA_RNA = creato portando "tra i nostri" un aiuto del Registro Nazionale Aiuti;
// si comporta come MANUALE (tutti i campi modificabili).
export type ContributoOrigine = 'DA_PROGETTO' | 'MANUALE' | 'DA_RNA'

export interface Contributo {
  id: string
  cliente_id: string
  progetto_id: string | null
  anno_competenza: number
  bando_id: string | null
  bando_denominazione_manuale: string | null
  ente_erogatore: string | null
  forma_contributo: ContributoForma
  importo_progetto: number | null
  importo_contributo: number | null
  esl: number | null
  intensita_aiuto_pct: number | null
  regime_aiuto: string | null
  rna_codice_concessione: string | null
  rna_url: string | null
  data_concessione: string | null
  data_erogazione: string | null
  stato: ContributoStato
  note: string | null
  origine: ContributoOrigine
  created_at: string
  updated_at: string
  created_by_user_id: string | null
}

// Shape arricchita (con join bando) ritornata dall'API list
export interface ContributoWithJoins extends Contributo {
  bando?: { id: string; nome: string; codice_bando: string | null; ente_erogatore: string | null } | null
  progetto?: { id: string; codice_progetto: string | null; titolo_progetto: string | null; stato: string } | null
}

// Costanti label (usate anche da frontend)
export const FORMA_LABEL: Record<ContributoForma, string> = {
  FONDO_PERDUTO: 'Fondo perduto',
  CREDITO_IMPOSTA: 'Credito d\'imposta',
  FINANZIAMENTO_AGEVOLATO: 'Finanziamento agevolato',
  GARANZIA: 'Garanzia',
  CONTRIBUTO_INTERESSI: 'Contributo in c/interessi',
  MISTO: 'Misto',
}

export const STATO_LABEL: Record<ContributoStato, string> = {
  AMMESSO: 'Ammesso',
  CONCESSO: 'Concesso',
  EROGATO_PARZIALE: 'Erogato parziale',
  EROGATO_TOTALE: 'Erogato totale',
  REVOCATO: 'Revocato',
  RINUNCIATO: 'Rinunciato',
}

// Elenchi dei valori enum (stesso ordine delle label), per select e validazione
export const FORME_CONTRIBUTO = Object.keys(FORMA_LABEL) as ContributoForma[]
export const STATI_CONTRIBUTO = Object.keys(STATO_LABEL) as ContributoStato[]

// Stati che restano visibili nello storico ma non contano nei totali
export const STATI_ESCLUSI_DAI_TOTALI: ContributoStato[] = ['REVOCATO', 'RINUNCIATO']

export function isContributoForma(v: unknown): v is ContributoForma {
  return typeof v === 'string' && (FORME_CONTRIBUTO as string[]).includes(v)
}

export function isContributoStato(v: unknown): v is ContributoStato {
  return typeof v === 'string' && (STATI_CONTRIBUTO as string[]).includes(v)
}

// Campi che la sync dal progetto sovrascrive: su righe DA_PROGETTO non sono
// modificabili dall'API contributi (si cambiano dal progetto).
export const CAMPI_EREDITATI_DA_PROGETTO = [
  'cliente_id',
  'progetto_id',
  'importo_progetto',
  'importo_contributo',
  'data_concessione',
  'anno_competenza',
  'bando_id',
] as const
