import type { DefinizioneAmbito } from './registry'

const STATO_CORSO_OPTS = [
  { value: 'PIANIFICATO', label: 'Pianificato' },
  { value: 'IN_CORSO', label: 'In corso' },
  { value: 'CONCLUSO', label: 'Concluso' },
  { value: 'ANNULLATO', label: 'Annullato' },
]

const MODALITA_OPTS = [
  { value: 'AULA', label: 'Aula' },
  { value: 'ONLINE_SINCRONA', label: 'Online sincrona' },
  { value: 'ONLINE_ASINCRONA', label: 'Online asincrona' },
  { value: 'BLENDED', label: 'Blended' },
  { value: 'AFFIANCAMENTO', label: 'Affiancamento on the job' },
]

export const ambitoCorsi: DefinizioneAmbito = {
  id: 'corsi',
  label: 'Corsi ed Edizioni',
  descrizione: 'Corsi e edizioni formative collegate a piani o standalone.',
  tabella: 'scadenze_bandi_corsi_formativi',
  join_cliente: true,
  ordinamento_default: { campo: 'data_inizio', direzione: 'desc' },
  sotto_ambiti: [
    {
      id: 'identificazione',
      label: 'Identificazione',
      filtri: [
        { campo: 'titolo', label: 'Titolo (contiene)', tipo: 'text' },
        { campo: 'area_tematica', label: 'Area tematica (contiene)', tipo: 'text', placeholder: 'Es. Sicurezza, Digitale' },
        { campo: 'ente_erogatore', label: 'Ente erogatore (contiene)', tipo: 'text' },
        { campo: 'sede', label: 'Sede (contiene)', tipo: 'text' },
      ],
    },
    {
      id: 'classificazione',
      label: 'Classificazione',
      filtri: [
        { campo: 'stato', label: 'Stato', tipo: 'multiselect_scalar', opzioni: STATO_CORSO_OPTS },
        { campo: 'modalita', label: 'Modalita', tipo: 'multiselect_scalar', opzioni: MODALITA_OPTS },
      ],
    },
    {
      id: 'tempi',
      label: 'Tempistica',
      filtri: [
        { campo: 'data_inizio', label: 'Data inizio', tipo: 'date_range' },
        { campo: 'data_fine', label: 'Data fine', tipo: 'date_range' },
        { campo: 'ore_durata', label: 'Ore di durata', tipo: 'number_range' },
      ],
    },
  ],
  colonne_risultati: [
    { campo: 'cliente.denominazione', label: 'Cliente', formato: 'testo', larghezza_excel: 28 },
    { campo: 'titolo', label: 'Titolo corso', formato: 'testo', larghezza_excel: 35 },
    { campo: 'area_tematica', label: 'Area', formato: 'testo', larghezza_excel: 18 },
    { campo: 'stato', label: 'Stato', formato: 'enum', enum_labels: Object.fromEntries(STATO_CORSO_OPTS.map(o => [o.value, o.label])), larghezza_excel: 14 },
    { campo: 'modalita', label: 'Modalita', formato: 'enum', enum_labels: Object.fromEntries(MODALITA_OPTS.map(o => [o.value, o.label])), larghezza_excel: 16 },
    { campo: 'ore_durata', label: 'Ore', formato: 'numero', larghezza_excel: 8 },
    { campo: 'data_inizio', label: 'Inizio', formato: 'data', larghezza_excel: 12 },
    { campo: 'data_fine', label: 'Fine', formato: 'data', larghezza_excel: 12 },
    { campo: 'ente_erogatore', label: 'Ente erogatore', formato: 'testo', larghezza_excel: 25 },
    { campo: 'sede', label: 'Sede', formato: 'testo', larghezza_excel: 20 },
  ],
  azioni_bulk: ['export_excel', 'export_pdf', 'email', 'crea_scadenza'],
  azione_email: { campo_email: 'cliente.email', campo_email_fallback: 'cliente.pec', campo_nome: 'cliente.denominazione' },
  azione_scadenza: { campo_cliente_id: 'cliente_id', campo_nome: 'titolo' },
}
