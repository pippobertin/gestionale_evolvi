import type { DefinizioneAmbito } from './registry'

const STATO_PROSPECT_OPTS = [
  { value: 'bozza', label: 'Bozza' },
  { value: 'qualificato', label: 'Qualificato' },
  { value: 'in_decisione', label: 'In decisione' },
  { value: 'preso_in_carico', label: 'Preso in carico' },
  { value: 'convertito', label: 'Convertito' },
  { value: 'congelato', label: 'Congelato' },
  { value: 'archiviato', label: 'Archiviato' },
]

const DECISIONE_OPTS = [
  { value: 'EVOLVI', label: 'Evolvi' },
  { value: 'SPOT', label: 'Spot' },
  { value: 'FPI', label: 'FPI' },
  { value: 'CONSULENTI', label: 'Consulenti' },
  { value: 'RIFIUTATO', label: 'Rifiutato' },
]

const FONTE_OPTS = [
  { value: 'referral', label: 'Referral' },
  { value: 'web', label: 'Sito web' },
  { value: 'evento', label: 'Evento' },
  { value: 'cold_call', label: 'Cold call' },
  { value: 'telefonata', label: 'Telefonata' },
  { value: 'email_inbound', label: 'Email inbound' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'altro', label: 'Altro' },
]

const DIMENSIONE_OPTS = [
  { value: 'MICRO', label: 'Micro' },
  { value: 'PICCOLA', label: 'Piccola' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'GRANDE', label: 'Grande' },
]

export const ambitoProspect: DefinizioneAmbito = {
  id: 'prospect',
  label: 'Prospect',
  descrizione: 'Aziende in fase di valutazione, decisione e qualificazione.',
  tabella: 'scadenze_bandi_prospect',
  ordinamento_default: { campo: 'created_at', direzione: 'desc' },
  sotto_ambiti: [
    {
      id: 'stato_decisione',
      label: 'Stato e decisione',
      filtri: [
        { campo: 'stato', label: 'Stato', tipo: 'multiselect_scalar', opzioni: STATO_PROSPECT_OPTS },
        { campo: 'decisione', label: 'Decisione', tipo: 'multiselect_scalar', opzioni: DECISIONE_OPTS },
        { campo: 'data_decisione', label: 'Data decisione', tipo: 'date_range' },
        { campo: 'data_conversione', label: 'Data conversione', tipo: 'date_range' },
      ],
    },
    {
      id: 'anagrafica',
      label: 'Anagrafica',
      filtri: [
        { campo: 'denominazione', label: 'Denominazione (contiene)', tipo: 'text' },
        { campo: 'partita_iva', label: 'P. IVA (contiene)', tipo: 'text' },
        { campo: 'ateco_2025', label: 'ATECO (contiene)', tipo: 'text' },
        { campo: 'provincia', label: 'Provincia', tipo: 'text' },
      ],
    },
    {
      id: 'dimensione',
      label: 'Dimensionamento',
      filtri: [
        { campo: 'dimensione', label: 'Dimensione UE', tipo: 'multiselect_scalar', opzioni: DIMENSIONE_OPTS },
        { campo: 'numero_dipendenti', label: 'N. dipendenti', tipo: 'number_range' },
        { campo: 'ultimo_fatturato', label: 'Ultimo fatturato (€)', tipo: 'number_range' },
        { campo: 'profiling_score', label: 'Profiling score', tipo: 'number_range' },
      ],
    },
    {
      id: 'acquisizione',
      label: 'Acquisizione e creazione',
      filtri: [
        { campo: 'fonte_acquisizione', label: 'Fonte', tipo: 'multiselect_scalar', opzioni: FONTE_OPTS },
        { campo: 'created_at', label: 'Data creazione', tipo: 'date_range' },
        { campo: 'data_contatto', label: 'Data contatto', tipo: 'date_range' },
      ],
    },
  ],
  colonne_risultati: [
    { campo: 'denominazione', label: 'Denominazione', formato: 'testo', larghezza_excel: 35 },
    { campo: 'partita_iva', label: 'P. IVA', formato: 'testo', larghezza_excel: 14 },
    { campo: 'stato', label: 'Stato', formato: 'enum', enum_labels: Object.fromEntries(STATO_PROSPECT_OPTS.map(o => [o.value, o.label])), larghezza_excel: 16 },
    { campo: 'decisione', label: 'Decisione', formato: 'enum', enum_labels: Object.fromEntries(DECISIONE_OPTS.map(o => [o.value, o.label])), larghezza_excel: 14 },
    { campo: 'dimensione', label: 'Dimensione', formato: 'enum', enum_labels: Object.fromEntries(DIMENSIONE_OPTS.map(o => [o.value, o.label])), larghezza_excel: 12 },
    { campo: 'numero_dipendenti', label: 'Dipendenti', formato: 'numero', larghezza_excel: 12 },
    { campo: 'profiling_score', label: 'Score', formato: 'numero', larghezza_excel: 10 },
    { campo: 'fonte_acquisizione', label: 'Fonte', formato: 'enum', enum_labels: Object.fromEntries(FONTE_OPTS.map(o => [o.value, o.label])), larghezza_excel: 14 },
    { campo: 'provincia', label: 'Prov.', formato: 'testo', larghezza_excel: 8 },
    { campo: 'created_at', label: 'Creato il', formato: 'data', larghezza_excel: 12 },
  ],
  azioni_bulk: ['export_excel', 'export_pdf', 'email'],
  azione_email: { campo_email: 'email', campo_email_fallback: 'pec', campo_nome: 'denominazione' },
}
