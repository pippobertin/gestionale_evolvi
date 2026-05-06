export interface ContrattoEvolvi {
  id: string
  cliente_id: string
  numero_contratto?: string
  tipo_contratto: string
  data_contratto?: string
  data_inizio?: string
  data_fine?: string
  importo_annuale?: number
  importo_totale?: number
  modalita_pagamento?: 'mensile' | 'trimestrale' | 'semestrale' | 'annuale'
  template_name: string
  contract_word_id?: string
  contract_word_url?: string
  contract_pdf_id?: string
  contract_pdf_url?: string
  stato: ContrattoEvolviStato
  approvato_da?: string
  approvato_il?: string
  inviato_a_email?: string
  inviato_il?: string
  firmato_il?: string
  rinnovo_automatico: boolean
  contratto_rinnovato_id?: string
  note?: string
  creato_da?: string
  created_at: string
  updated_at: string
  // Joined fields
  cliente_denominazione?: string
}

export type ContrattoEvolviStato = 'bozza' | 'in_revisione' | 'approvato' | 'inviato' | 'firmato' | 'attivo' | 'scaduto' | 'annullato'

export const CONTRATTO_EVOLVI_STATI: Record<ContrattoEvolviStato, { label: string; color: string; bgColor: string }> = {
  bozza: { label: 'Bozza', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  in_revisione: { label: 'In Revisione', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  approvato: { label: 'Approvato', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  inviato: { label: 'Inviato', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  firmato: { label: 'Firmato', color: 'text-green-700', bgColor: 'bg-green-100' },
  attivo: { label: 'Attivo', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  scaduto: { label: 'Scaduto', color: 'text-red-700', bgColor: 'bg-red-100' },
  annullato: { label: 'Annullato', color: 'text-gray-500', bgColor: 'bg-gray-50' }
}

export interface EvolviContractFormData {
  data_contratto: string
  data_inizio: string
  data_fine: string
  importo_annuale: number
  importo_totale: number
  modalita_pagamento: 'mensile' | 'trimestrale' | 'semestrale' | 'annuale'
  rinnovo_automatico: boolean
  note?: string
}

export interface EvolviFattura {
  id: string
  contratto_id: string
  cliente_id: string
  numero_fattura?: string
  data_fattura?: string
  data_scadenza_pagamento?: string
  importo_netto: number
  importo_iva: number
  importo_totale: number
  periodo_inizio?: string
  periodo_fine?: string
  stato_pagamento: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  data_pagamento?: string
  metodo_pagamento?: string
  riferimento_pagamento?: string
  note?: string
  created_at: string
  updated_at: string
  created_by?: string
  // Joined
  cliente_denominazione?: string
  numero_contratto?: string
}

export const FATTURA_STATI: Record<string, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: 'In Attesa', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  PAID: { label: 'Pagata', color: 'text-green-700', bgColor: 'bg-green-100' },
  OVERDUE: { label: 'Scaduta', color: 'text-red-700', bgColor: 'bg-red-100' },
  CANCELLED: { label: 'Annullata', color: 'text-gray-500', bgColor: 'bg-gray-50' }
}

export interface DocumentoAmministrativo {
  id: string
  cliente_id: string
  tipo_documento: string
  categoria: string
  nome_file: string
  nome_originale: string
  dimensione_bytes?: number
  mime_type?: string
  storage_path: string
  descrizione?: string
  data_documento?: string
  data_scadenza?: string
  verificato: boolean
  verificato_da?: string
  verificato_il?: string
  tags: string[]
  uploaded_at: string
  uploaded_by?: string
  updated_at: string
}

export const TIPI_DOCUMENTO = [
  { value: 'VISURA_CAMERALE', label: 'Visura Camerale', categoria: 'SOCIETARI' },
  { value: 'ATTO_COSTITUTIVO', label: 'Atto Costitutivo', categoria: 'SOCIETARI' },
  { value: 'STATUTO', label: 'Statuto', categoria: 'SOCIETARI' },
  { value: 'BILANCIO', label: 'Bilancio', categoria: 'BILANCI' },
  { value: 'DOCUMENTO_IDENTITA', label: "Documento d'Identità", categoria: 'IDENTITA' },
  { value: 'CODICE_FISCALE', label: 'Codice Fiscale', categoria: 'FISCALI' },
  { value: 'CERT_PARTITA_IVA', label: 'Certificato Partita IVA', categoria: 'FISCALI' },
  { value: 'CERT_ANTIMAFIA', label: 'Certificato Antimafia', categoria: 'CERTIFICAZIONI' },
  { value: 'DURC', label: 'DURC', categoria: 'CERTIFICAZIONI' },
  { value: 'ISCRIZIONE_RUNTS', label: 'Iscrizione RUNTS', categoria: 'CERTIFICAZIONI' },
  { value: 'ALTRO', label: 'Altro', categoria: 'ALTRO' }
]

export const CATEGORIE_DOCUMENTO = [
  { value: 'SOCIETARI', label: 'Societari' },
  { value: 'FISCALI', label: 'Fiscali' },
  { value: 'IDENTITA', label: 'Identità' },
  { value: 'CERTIFICAZIONI', label: 'Certificazioni' },
  { value: 'BILANCI', label: 'Bilanci' },
  { value: 'ALTRO', label: 'Altro' }
]

export interface ContractTracking {
  id: string
  entity_type: 'PROGETTO' | 'CONTRATTO_EVOLVI'
  entity_id: string
  cliente_id: string
  contract_document_url?: string
  email_sent: boolean
  email_sent_at?: string
  email_sent_to?: string
  email_message_id?: string
  email_delivery_status: 'PENDING' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'FAILED'
  email_delivery_error?: string
  signed_contract_received: boolean
  signed_contract_received_at?: string
  signed_contract_storage_path?: string
  signed_contract_notes?: string
  reminder_sent_count: number
  last_reminder_sent_at?: string
  reminder_interval_days: number
  overall_status: 'DRAFT' | 'SENT' | 'DELIVERED' | 'REMINDED' | 'SIGNED_RECEIVED' | 'COMPLETED' | 'FAILED'
  created_at: string
  updated_at: string
}

export const TRACKING_STATI: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Bozza', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  SENT: { label: 'Inviato', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  DELIVERED: { label: 'Consegnato', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  REMINDED: { label: 'Sollecitato', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  SIGNED_RECEIVED: { label: 'Firmato Ricevuto', color: 'text-green-700', bgColor: 'bg-green-100' },
  COMPLETED: { label: 'Completato', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  FAILED: { label: 'Errore', color: 'text-red-700', bgColor: 'bg-red-100' }
}

export interface ScadenzaContrattuale {
  id: string
  entity_type: 'CLIENTE' | 'CONTRATTO_EVOLVI' | 'GENERALE'
  entity_id?: string
  titolo: string
  descrizione?: string
  tipo_scadenza: 'CONTRATTUALE' | 'FISCALE' | 'AMMINISTRATIVA' | 'CERTIFICAZIONE' | 'PAGAMENTO' | 'REVISIONE' | 'ALTRO'
  categoria?: string
  data_scadenza: string
  data_promemoria?: string
  is_recurring: boolean
  recurrence_pattern?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  recurrence_interval?: number
  recurrence_end_date?: string
  stato: 'APERTA' | 'IN_CORSO' | 'COMPLETATA' | 'ANNULLATA'
  priorita: 'BASSA' | 'MEDIA' | 'ALTA' | 'CRITICA'
  responsabile_email?: string
  notifiche_attive: boolean
  notifica_giorni_prima: number[]
  data_completamento?: string
  completato_da?: string
  note_completamento?: string
  tags: string[]
  created_at: string
  created_by?: string
  updated_at: string
  // Joined
  cliente_denominazione?: string
}

export const TIPI_SCADENZA = [
  { value: 'CONTRATTUALE', label: 'Contrattuale' },
  { value: 'FISCALE', label: 'Fiscale' },
  { value: 'AMMINISTRATIVA', label: 'Amministrativa' },
  { value: 'CERTIFICAZIONE', label: 'Certificazione' },
  { value: 'PAGAMENTO', label: 'Pagamento' },
  { value: 'REVISIONE', label: 'Revisione' },
  { value: 'ALTRO', label: 'Altro' }
]

export const PRIORITA_SCADENZA: Record<string, { label: string; color: string; bgColor: string }> = {
  BASSA: { label: 'Bassa', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  MEDIA: { label: 'Media', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  ALTA: { label: 'Alta', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  CRITICA: { label: 'Critica', color: 'text-red-600', bgColor: 'bg-red-100' }
}
