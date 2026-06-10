import type { DefinizioneAmbito } from './registry'

const STATO_CONTRATTO_OPTS = [
  { value: 'bozza', label: 'Bozza' },
  { value: 'inviato', label: 'Inviato' },
  { value: 'firmato', label: 'Firmato' },
  { value: 'attivo', label: 'Attivo' },
  { value: 'scaduto', label: 'Scaduto' },
  { value: 'annullato', label: 'Annullato' },
  { value: 'rinnovato', label: 'Rinnovato' },
]

export const ambitoContratti: DefinizioneAmbito = {
  id: 'contratti',
  label: 'Contratti Evolvi',
  descrizione: 'Contratti del Metodo Evolvi, scadenze e dati economici.',
  tabella: 'scadenze_bandi_contratti_evolvi',
  join_cliente: true,
  ordinamento_default: { campo: 'created_at', direzione: 'desc' },
  sotto_ambiti: [
    {
      id: 'identificazione',
      label: 'Identificazione',
      filtri: [
        { campo: 'numero_contratto', label: 'Numero contratto (contiene)', tipo: 'text' },
        { campo: 'stato', label: 'Stato', tipo: 'multiselect_scalar', opzioni: STATO_CONTRATTO_OPTS },
      ],
    },
    {
      id: 'tempi',
      label: 'Tempistica',
      filtri: [
        { campo: 'data_inizio', label: 'Data inizio', tipo: 'date_range' },
        { campo: 'data_fine', label: 'Data fine (scadenza)', tipo: 'date_range' },
        { campo: 'inviato_il', label: 'Data invio', tipo: 'date_range' },
      ],
    },
    {
      id: 'economici',
      label: 'Dati economici',
      filtri: [
        { campo: 'importo_annuale', label: 'Importo annuale', tipo: 'number_range' },
      ],
    },
  ],
  colonne_risultati: [
    { campo: 'cliente.denominazione', label: 'Cliente', formato: 'testo', larghezza_excel: 32 },
    { campo: 'numero_contratto', label: 'N. contratto', formato: 'testo', larghezza_excel: 18 },
    { campo: 'stato', label: 'Stato', formato: 'enum', enum_labels: Object.fromEntries(STATO_CONTRATTO_OPTS.map(o => [o.value, o.label])), larghezza_excel: 14 },
    { campo: 'data_inizio', label: 'Inizio', formato: 'data', larghezza_excel: 12 },
    { campo: 'data_fine', label: 'Scadenza', formato: 'data', larghezza_excel: 12 },
    { campo: 'importo_annuale', label: 'Importo annuale', formato: 'numero', larghezza_excel: 16 },
    { campo: 'inviato_il', label: 'Inviato il', formato: 'data', larghezza_excel: 12 },
    { campo: 'created_at', label: 'Creato il', formato: 'data', larghezza_excel: 12 },
  ],
  azioni_bulk: ['export_excel', 'export_pdf', 'email', 'crea_scadenza'],
  azione_email: { campo_email: 'cliente.email', campo_email_fallback: 'cliente.pec', campo_nome: 'cliente.denominazione' },
  azione_scadenza: { campo_cliente_id: 'cliente_id', campo_nome: 'cliente.denominazione' },
}
