export interface Prospect {
  id: string
  numero_prospect?: string
  denominazione: string
  partita_iva?: string
  codice_fiscale?: string
  email?: string
  pec?: string
  telefono?: string
  sito_web?: string
  indirizzo?: string
  cap?: string
  citta?: string
  provincia?: string
  settore?: string
  ateco_2025?: string
  dimensione?: 'MICRO' | 'PICCOLA' | 'MEDIA' | 'GRANDE'
  numero_dipendenti?: number
  ultimo_fatturato?: number
  legale_rappresentante_nome?: string
  legale_rappresentante_cognome?: string
  legale_rappresentante_email?: string
  legale_rappresentante_telefono?: string
  profiling_data: Record<string, any>
  profiling_score: number
  fonte_acquisizione?: string
  fonte_dettaglio?: string
  assegnato_a?: string
  stato: ProspectStato
  decisione?: 'EVOLVI' | 'SPOT' | 'RIFIUTATO'
  motivo_rifiuto?: string
  data_decisione?: string
  deciso_da?: string
  cliente_id?: string
  data_conversione?: string
  convertito_da?: string
  note?: string
  creato_da?: string
  // Congelamento
  congelato_il?: string
  scongela_il?: string
  stato_pre_congelamento?: string
  motivo_congelamento?: string
  // Archiviazione
  archiviato_il?: string
  motivo_archiviazione?: string
  created_at: string
  updated_at: string
  // Prequalifica fields
  data_contatto?: string
  ricevuto_da?: string
  referente_nome?: string
  tipologia_soggetto?: TipologiaSoggetto
  area_interesse?: AreaInteresse
  natura_interesse?: NaturaInteresse
  bisogno_dichiarato?: string
  bisogno_interpretato?: string
  affidabilita_percepita?: Affidabilita
  potenziale_economico?: PotenzialeEconomico
  budget_dichiarato?: boolean
  tempi_decisione?: TempiDecisione
  note_qualitative?: string
  raccomandazione?: Raccomandazione
  motivazione_raccomandazione?: string
  responsabile_qualificazione?: string
  data_riunione_prevista?: string
}

export type ProspectStato = 'bozza' | 'qualificato' | 'in_decisione' | 'preso_in_carico' | 'convertito' | 'congelato' | 'archiviato'

export type TipologiaSoggetto = 'PROFIT' | 'NON_PROFIT' | 'ENTE_PUBBLICO' | 'SCUOLA'
export type AreaInteresse = 'EVOLVI_PROGETTAZIONE' | 'SEEDMIND_FORMAZIONE' | 'HUMETRICS_ESG' | 'NON_CHIARO'
export type NaturaInteresse = 'CONTINUATIVO' | 'PUNTUALE' | 'DA_DEFINIRE'
export type Affidabilita = 'ALTA' | 'MEDIA' | 'BASSA' | 'NON_VALUTABILE'
export type PotenzialeEconomico = 'SOTTO_5K' | 'DA_5K_A_15K' | 'DA_15K_A_50K' | 'OLTRE_50K' | 'NON_STIMABILE'
export type TempiDecisione = 'IMMEDIATO' | 'ENTRO_1_MESE' | 'ENTRO_3_MESI' | 'ENTRO_6_MESI' | 'OLTRE' | 'NON_NOTO'
export type Raccomandazione = 'PROCEDERE' | 'APPROFONDIRE' | 'SOSPENDERE' | 'SCARTARE'

export interface ProspectHistory {
  id: string
  prospect_id: string
  stato_precedente?: string
  stato_nuovo: string
  note?: string
  utente?: string
  created_at: string
}

export interface ProfilingTemplate {
  id: string
  domanda: string
  tipo: 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'textarea' | 'rating'
  opzioni: string[]
  punteggi: number[] // array parallelo a opzioni con valori 0-1 (se vuoto, fallback posizionale)
  peso: number
  categoria: string
  ordine: number
  attivo: boolean
  created_at: string
  updated_at: string
}

export interface ProspectFormData {
  denominazione: string
  partita_iva?: string
  codice_fiscale?: string
  email?: string
  pec?: string
  telefono?: string
  sito_web?: string
  indirizzo?: string
  cap?: string
  citta?: string
  provincia?: string
  settore?: string
  ateco_2025?: string
  dimensione?: 'MICRO' | 'PICCOLA' | 'MEDIA' | 'GRANDE'
  numero_dipendenti?: number
  ultimo_fatturato?: number
  legale_rappresentante_nome?: string
  legale_rappresentante_cognome?: string
  legale_rappresentante_email?: string
  legale_rappresentante_telefono?: string
  fonte_acquisizione?: string
  assegnato_a?: string
  note?: string
  // Prequalifica fields (in ProspectFormData)
  data_contatto?: string
  ricevuto_da?: string
  referente_nome?: string
  tipologia_soggetto?: string
  area_interesse?: string
  natura_interesse?: string
  bisogno_dichiarato?: string
  bisogno_interpretato?: string
  affidabilita_percepita?: string
  potenziale_economico?: string
  budget_dichiarato?: boolean
  tempi_decisione?: string
  note_qualitative?: string
  raccomandazione?: string
  motivazione_raccomandazione?: string
  responsabile_qualificazione?: string
  data_riunione_prevista?: string
}

export const PROSPECT_STATI: Record<ProspectStato, { label: string; color: string; bgColor: string }> = {
  bozza: { label: 'Bozza', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  qualificato: { label: 'Qualificato', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  in_decisione: { label: 'In Decisione', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  preso_in_carico: { label: 'Preso in Carico', color: 'text-green-700', bgColor: 'bg-green-100' },
  convertito: { label: 'Convertito', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  congelato: { label: 'Congelato', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  archiviato: { label: 'Archiviato', color: 'text-red-700', bgColor: 'bg-red-100' }
}

export const TERMINAL_STATES: ProspectStato[] = ['convertito', 'archiviato']

export const VALID_TRANSITIONS: Record<ProspectStato, ProspectStato[]> = {
  bozza: ['qualificato', 'congelato', 'archiviato'],
  qualificato: ['in_decisione', 'congelato', 'archiviato'],
  in_decisione: ['preso_in_carico', 'congelato', 'archiviato'],
  preso_in_carico: ['convertito', 'congelato', 'archiviato'],
  congelato: ['archiviato'], // + stato_pre_congelamento via scongela
  convertito: [],
  archiviato: []
}

export function isTransitionValid(from: ProspectStato, to: ProspectStato): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export const CONGELAMENTO_DURATE = [
  { value: 15, label: '15 giorni' },
  { value: 30, label: '30 giorni' },
  { value: 60, label: '60 giorni' },
  { value: 90, label: '90 giorni' },
  { value: 0, label: 'Data personalizzata' }
]

export const FONTI_ACQUISIZIONE = [
  { value: 'telefonata', label: 'Telefonata' },
  { value: 'email_inbound', label: 'Email in entrata' },
  { value: 'referral', label: 'Passaparola / Referral' },
  { value: 'evento', label: 'Evento / Fiera' },
  { value: 'web', label: 'Web / Social Media' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'altro', label: 'Altro' }
]

export const DIMENSIONI = [
  { value: 'MICRO', label: 'Micro Impresa' },
  { value: 'PICCOLA', label: 'Piccola Impresa' },
  { value: 'MEDIA', label: 'Media Impresa' },
  { value: 'GRANDE', label: 'Grande Impresa' }
]

export const TIPOLOGIE_SOGGETTO = [
  { value: 'PROFIT', label: 'Profit' },
  { value: 'NON_PROFIT', label: 'Non Profit' },
  { value: 'ENTE_PUBBLICO', label: 'Ente Pubblico' },
  { value: 'SCUOLA', label: 'Scuola' }
]

export const AREE_INTERESSE = [
  { value: 'EVOLVI_PROGETTAZIONE', label: 'Evolvi - Progettazione' },
  { value: 'SEEDMIND_FORMAZIONE', label: 'SeedMind - Formazione' },
  { value: 'HUMETRICS_ESG', label: 'Humetrics - ESG' },
  { value: 'NON_CHIARO', label: 'Non chiaro' }
]

export const NATURE_INTERESSE = [
  { value: 'CONTINUATIVO', label: 'Continuativo' },
  { value: 'PUNTUALE', label: 'Spot' },
  { value: 'DA_DEFINIRE', label: 'Da definire' }
]

export const AFFIDABILITA_OPTIONS = [
  { value: 'ALTA', label: 'Alta' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'BASSA', label: 'Bassa' },
  { value: 'NON_VALUTABILE', label: 'Non valutabile' }
]

export const POTENZIALI_ECONOMICI = [
  { value: 'SOTTO_5K', label: 'Sotto 5.000 EUR' },
  { value: 'DA_5K_A_15K', label: '5.000 - 15.000 EUR' },
  { value: 'DA_15K_A_50K', label: '15.000 - 50.000 EUR' },
  { value: 'OLTRE_50K', label: 'Oltre 50.000 EUR' },
  { value: 'NON_STIMABILE', label: 'Non stimabile' }
]

export const TEMPI_DECISIONE_OPTIONS = [
  { value: 'IMMEDIATO', label: 'Immediato' },
  { value: 'ENTRO_1_MESE', label: 'Entro 1 mese' },
  { value: 'ENTRO_3_MESI', label: 'Entro 3 mesi' },
  { value: 'ENTRO_6_MESI', label: 'Entro 6 mesi' },
  { value: 'OLTRE', label: 'Oltre 6 mesi' },
  { value: 'NON_NOTO', label: 'Non noto' }
]

export const RACCOMANDAZIONI = [
  { value: 'PROCEDERE', label: 'Procedere', color: 'text-green-700', bgColor: 'bg-green-100' },
  { value: 'APPROFONDIRE', label: 'Approfondire', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { value: 'SOSPENDERE', label: 'Sospendere', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  { value: 'SCARTARE', label: 'Scartare', color: 'text-red-700', bgColor: 'bg-red-100' }
]
