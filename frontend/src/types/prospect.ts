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
  fonte_acquisizione?: 'referral' | 'web' | 'evento' | 'cold_call' | 'altro'
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
  note_valutazione?: string
  creato_da?: string
  created_at: string
  updated_at: string
}

export type ProspectStato = 'nuovo' | 'in_valutazione' | 'valutato' | 'approvato' | 'rifiutato' | 'convertito'

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
}

export const PROSPECT_STATI: Record<ProspectStato, { label: string; color: string; bgColor: string }> = {
  nuovo: { label: 'Nuovo', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  in_valutazione: { label: 'In Valutazione', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  valutato: { label: 'Valutato', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  approvato: { label: 'Approvato', color: 'text-green-700', bgColor: 'bg-green-100' },
  rifiutato: { label: 'Rifiutato', color: 'text-red-700', bgColor: 'bg-red-100' },
  convertito: { label: 'Convertito', color: 'text-emerald-700', bgColor: 'bg-emerald-100' }
}

export const FONTI_ACQUISIZIONE = [
  { value: 'referral', label: 'Passaparola / Referral' },
  { value: 'web', label: 'Web / Social Media' },
  { value: 'evento', label: 'Evento / Fiera' },
  { value: 'cold_call', label: 'Telefonata / Cold Call' },
  { value: 'altro', label: 'Altro' }
]

export const DIMENSIONI = [
  { value: 'MICRO', label: 'Micro Impresa' },
  { value: 'PICCOLA', label: 'Piccola Impresa' },
  { value: 'MEDIA', label: 'Media Impresa' },
  { value: 'GRANDE', label: 'Grande Impresa' }
]
