import type { DefinizioneAmbito } from './registry'

const STATO_BANDO_OPTS = [
  { value: 'attivo', label: 'Attivo' },
  { value: 'archiviato', label: 'Archiviato' },
]

export const ambitoBandi: DefinizioneAmbito = {
  id: 'bandi',
  label: 'Bandi',
  descrizione: 'Bandi e avvisi gestiti dal gestionale.',
  tabella: 'scadenze_bandi_bandi',
  ordinamento_default: { campo: 'created_at', direzione: 'desc' },
  sotto_ambiti: [
    {
      id: 'anagrafica',
      label: 'Anagrafica bando',
      filtri: [
        { campo: 'nome', label: 'Nome (contiene)', tipo: 'text' },
        { campo: 'codice_bando', label: 'Codice (contiene)', tipo: 'text' },
        { campo: 'ente_erogatore', label: 'Ente erogatore (contiene)', tipo: 'text' },
      ],
    },
    {
      id: 'stato',
      label: 'Stato',
      filtri: [
        { campo: 'stato', label: 'Stato', tipo: 'multiselect_scalar', opzioni: STATO_BANDO_OPTS },
        { campo: 'created_at', label: 'Data creazione', tipo: 'date_range' },
      ],
    },
  ],
  colonne_risultati: [
    { campo: 'nome', label: 'Nome bando', formato: 'testo', larghezza_excel: 40 },
    { campo: 'codice_bando', label: 'Codice', formato: 'testo', larghezza_excel: 16 },
    { campo: 'ente_erogatore', label: 'Ente erogatore', formato: 'testo', larghezza_excel: 28 },
    { campo: 'stato', label: 'Stato', formato: 'enum', enum_labels: Object.fromEntries(STATO_BANDO_OPTS.map(o => [o.value, o.label])), larghezza_excel: 14 },
    { campo: 'created_at', label: 'Creato il', formato: 'data', larghezza_excel: 12 },
  ],
  azioni_bulk: ['export_excel', 'export_pdf'],
}
