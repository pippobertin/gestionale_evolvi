import type { DefinizioneAmbito } from './registry'

const STATO_PIANO_OPTS = [
  { value: 'BOZZA', label: 'Bozza' },
  { value: 'IN_PRESENTAZIONE', label: 'In presentazione' },
  { value: 'PRESENTATO', label: 'Presentato' },
  { value: 'APPROVATO', label: 'Approvato' },
  { value: 'IN_EROGAZIONE', label: 'In erogazione' },
  { value: 'RENDICONTAZIONE', label: 'In rendicontazione' },
  { value: 'CONCLUSO', label: 'Concluso' },
  { value: 'SALDATO', label: 'Saldato' },
  { value: 'RESPINTO', label: 'Respinto' },
  { value: 'ANNULLATO', label: 'Annullato' },
]

const TIPOLOGIA_OPTS = [
  { value: 'AZIENDALE', label: 'Aziendale' },
  { value: 'PLURIAZIENDALE', label: 'Pluriaziendale' },
  { value: 'SETTORIALE', label: 'Settoriale' },
  { value: 'TERRITORIALE', label: 'Territoriale' },
  { value: 'PRIVATO', label: 'Privato' },
  { value: 'OBBLIGATORIO', label: 'Obbligatorio' },
]

const CANALE_OPTS = [
  { value: 'CONTO_FORMAZIONE', label: 'Conto Formazione' },
  { value: 'CONTO_SISTEMA', label: 'Conto di Sistema' },
  { value: 'AVVISO', label: 'Avviso' },
  { value: 'PRIVATO', label: 'Privato' },
  { value: 'NON_APPLICABILE', label: 'Non applicabile' },
]

export const ambitoPiani: DefinizioneAmbito = {
  id: 'piani',
  label: 'Piani Formativi',
  descrizione: 'Piani formativi presentati o in gestione, con dati di rendicontazione e contributo.',
  tabella: 'scadenze_bandi_piani_formativi',
  join_cliente: true,
  ordinamento_default: { campo: 'created_at', direzione: 'desc' },
  sotto_ambiti: [
    {
      id: 'identificazione',
      label: 'Identificazione',
      filtri: [
        { campo: 'titolo', label: 'Titolo (contiene)', tipo: 'text' },
        { campo: 'codice_piano', label: 'Codice piano (contiene)', tipo: 'text' },
        { campo: 'avviso_riferimento', label: 'Avviso di riferimento', tipo: 'text', placeholder: 'Es. Avviso 3/2024' },
      ],
    },
    {
      id: 'classificazione',
      label: 'Classificazione',
      filtri: [
        { campo: 'stato', label: 'Stato', tipo: 'multiselect_scalar', opzioni: STATO_PIANO_OPTS },
        { campo: 'tipologia', label: 'Tipologia', tipo: 'multiselect_scalar', opzioni: TIPOLOGIA_OPTS },
        { campo: 'canale_finanziamento', label: 'Canale finanziamento', tipo: 'multiselect_scalar', opzioni: CANALE_OPTS },
      ],
    },
    {
      id: 'tempi',
      label: 'Tempistica',
      filtri: [
        { campo: 'data_presentazione', label: 'Data presentazione', tipo: 'date_range' },
        { campo: 'data_approvazione', label: 'Data approvazione', tipo: 'date_range' },
        { campo: 'data_inizio_attivita', label: 'Data inizio attivita', tipo: 'date_range' },
        { campo: 'data_fine_attivita', label: 'Data fine attivita', tipo: 'date_range' },
        { campo: 'data_scadenza_rendicontazione', label: 'Scadenza rendicontazione', tipo: 'date_range' },
      ],
    },
    {
      id: 'economici',
      label: 'Dati economici',
      filtri: [
        { campo: 'importo_richiesto', label: 'Importo richiesto', tipo: 'number_range' },
        { campo: 'importo_approvato', label: 'Importo approvato', tipo: 'number_range' },
        { campo: 'importo_erogato', label: 'Importo erogato', tipo: 'number_range' },
        { campo: 'ore_previste', label: 'Ore previste', tipo: 'number_range' },
        { campo: 'num_partecipanti_previsti', label: 'Partecipanti previsti', tipo: 'number_range' },
      ],
    },
  ],
  colonne_risultati: [
    { campo: 'cliente.denominazione', label: 'Cliente', formato: 'testo', larghezza_excel: 30 },
    { campo: 'titolo', label: 'Titolo piano', formato: 'testo', larghezza_excel: 38 },
    { campo: 'codice_piano', label: 'Codice', formato: 'testo', larghezza_excel: 14 },
    { campo: 'stato', label: 'Stato', formato: 'enum', enum_labels: Object.fromEntries(STATO_PIANO_OPTS.map(o => [o.value, o.label])), larghezza_excel: 16 },
    { campo: 'tipologia', label: 'Tipologia', formato: 'enum', enum_labels: Object.fromEntries(TIPOLOGIA_OPTS.map(o => [o.value, o.label])), larghezza_excel: 14 },
    { campo: 'canale_finanziamento', label: 'Canale', formato: 'enum', enum_labels: Object.fromEntries(CANALE_OPTS.map(o => [o.value, o.label])), larghezza_excel: 16 },
    { campo: 'importo_richiesto', label: 'Richiesto', formato: 'numero', larghezza_excel: 14 },
    { campo: 'importo_approvato', label: 'Approvato', formato: 'numero', larghezza_excel: 14 },
    { campo: 'importo_erogato', label: 'Erogato', formato: 'numero', larghezza_excel: 14 },
    { campo: 'ore_previste', label: 'Ore prev.', formato: 'numero', larghezza_excel: 10 },
    { campo: 'data_scadenza_rendicontazione', label: 'Scad. rendic.', formato: 'data', larghezza_excel: 12 },
    { campo: 'created_at', label: 'Creato il', formato: 'data', larghezza_excel: 12 },
  ],
  azioni_bulk: ['export_excel', 'export_pdf', 'email', 'crea_scadenza'],
  azione_email: { campo_email: 'cliente.email', campo_email_fallback: 'cliente.pec', campo_nome: 'cliente.denominazione' },
  azione_scadenza: { campo_cliente_id: 'cliente_id', campo_nome: 'titolo' },
}
