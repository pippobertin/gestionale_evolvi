import type { DefinizioneAmbito } from './registry'

const CATEGORIA_OPTS = [
  { value: 'EVOLVI', label: 'Evolvi' },
  { value: 'CLIENTE_SPOT', label: 'Cliente Spot' },
  { value: 'FPI', label: 'FPI' },
  { value: 'CONSULENTI', label: 'Consulenti' },
]

const DIMENSIONE_OPTS = [
  { value: 'MICRO', label: 'Micro' },
  { value: 'PICCOLA', label: 'Piccola' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'GRANDE', label: 'Grande' },
]

export const ambitoClienti: DefinizioneAmbito = {
  id: 'clienti',
  label: 'Clienti',
  descrizione: 'Anagrafica clienti, dimensionamento, contatti, contratti.',
  tabella: 'scadenze_bandi_clienti',
  ordinamento_default: { campo: 'denominazione', direzione: 'asc' },
  sotto_ambiti: [
    {
      id: 'anagrafica',
      label: 'Anagrafica',
      filtri: [
        { campo: 'denominazione', label: 'Denominazione (contiene)', tipo: 'text', placeholder: 'Es. ACME' },
        { campo: 'partita_iva', label: 'Partita IVA (contiene)', tipo: 'text' },
        { campo: 'codice_fiscale', label: 'Codice fiscale (contiene)', tipo: 'text' },
        { campo: 'ateco_2025', label: 'ATECO (contiene)', tipo: 'text', placeholder: 'Es. C28' },
      ],
    },
    {
      id: 'categoria',
      label: 'Categoria e contratto',
      filtri: [
        { campo: 'categoria_evolvi', label: 'Categoria Evolvi', tipo: 'multiselect_scalar', opzioni: CATEGORIA_OPTS },
        { campo: 'scadenza_evolvi', label: 'Scadenza contratto Evolvi', tipo: 'date_range' },
      ],
    },
    {
      id: 'dimensionamento',
      label: 'Dimensionamento',
      filtri: [
        { campo: 'dimensione', label: 'Dimensione UE', tipo: 'multiselect_scalar', opzioni: DIMENSIONE_OPTS },
        { campo: 'numero_dipendenti', label: 'N. dipendenti', tipo: 'number_range' },
        { campo: 'ula', label: 'ULA', tipo: 'number_range' },
        { campo: 'ultimo_fatturato', label: 'Ultimo fatturato (€)', tipo: 'number_range' },
        { campo: 'attivo_bilancio', label: 'Attivo bilancio (€)', tipo: 'number_range' },
      ],
    },
    {
      id: 'localizzazione',
      label: 'Localizzazione',
      filtri: [
        { campo: 'provincia_fatturazione', label: 'Provincia', tipo: 'text', placeholder: 'Es. AN' },
        { campo: 'citta_fatturazione', label: 'Città (contiene)', tipo: 'text' },
        { campo: 'cap_fatturazione', label: 'CAP', tipo: 'text' },
      ],
    },
    {
      id: 'contatti',
      label: 'Contatti',
      filtri: [
        { campo: 'email', label: 'Email (contiene)', tipo: 'text' },
        { campo: 'pec', label: 'PEC (contiene)', tipo: 'text' },
        { campo: 'telefono', label: 'Telefono (contiene)', tipo: 'text' },
      ],
    },
    {
      id: 'rappresentante',
      label: 'Legale rappresentante',
      filtri: [
        { campo: 'legale_rappresentante_cognome', label: 'Cognome (contiene)', tipo: 'text' },
        { campo: 'legale_rappresentante_nome', label: 'Nome (contiene)', tipo: 'text' },
      ],
    },
    {
      id: 'creazione',
      label: 'Creazione',
      filtri: [
        { campo: 'created_at', label: 'Data creazione', tipo: 'date_range' },
      ],
    },
  ],
  colonne_risultati: [
    { campo: 'denominazione', label: 'Denominazione', formato: 'testo', larghezza_excel: 35 },
    { campo: 'partita_iva', label: 'P. IVA', formato: 'testo', larghezza_excel: 14 },
    { campo: 'categoria_evolvi', label: 'Categoria', formato: 'enum', enum_labels: Object.fromEntries(CATEGORIA_OPTS.map(o => [o.value, o.label])), larghezza_excel: 16 },
    { campo: 'dimensione', label: 'Dimensione', formato: 'enum', enum_labels: Object.fromEntries(DIMENSIONE_OPTS.map(o => [o.value, o.label])), larghezza_excel: 12 },
    { campo: 'numero_dipendenti', label: 'Dipendenti', formato: 'numero', larghezza_excel: 12 },
    { campo: 'ula', label: 'ULA', formato: 'numero', larghezza_excel: 10 },
    { campo: 'ultimo_fatturato', label: 'Ultimo fatturato', formato: 'numero', larghezza_excel: 18 },
    { campo: 'ateco_2025', label: 'ATECO', formato: 'testo', larghezza_excel: 12 },
    { campo: 'provincia_fatturazione', label: 'Prov.', formato: 'testo', larghezza_excel: 8 },
    { campo: 'citta_fatturazione', label: 'Città', formato: 'testo', larghezza_excel: 20 },
    { campo: 'email', label: 'Email', formato: 'testo', larghezza_excel: 30 },
    { campo: 'telefono', label: 'Telefono', formato: 'testo', larghezza_excel: 16 },
    { campo: 'created_at', label: 'Creato il', formato: 'data', larghezza_excel: 12 },
  ],
  azioni_bulk: ['export_excel', 'export_pdf', 'email', 'crea_scadenza'],
  azione_email: { campo_email: 'email', campo_email_fallback: 'pec', campo_nome: 'denominazione' },
  azione_scadenza: { campo_cliente_id: 'id', campo_nome: 'denominazione' },
}
