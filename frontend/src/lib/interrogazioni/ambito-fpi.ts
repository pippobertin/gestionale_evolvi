import type { DefinizioneAmbito } from './registry'

const STATO_ADESIONE_OPTS = [
  { value: 'ATTIVA', label: 'Attiva' },
  { value: 'CESSATA', label: 'Cessata' },
  { value: 'SOSPESA', label: 'Sospesa' },
]

export const ambitoFpi: DefinizioneAmbito = {
  id: 'fpi',
  label: 'Adesioni FPI',
  descrizione: 'Adesioni dei clienti ai fondi interprofessionali.',
  tabella: 'scadenze_bandi_clienti_adesioni_fpi',
  join_cliente: true,
  ordinamento_default: { campo: 'data_adesione', direzione: 'desc' },
  sotto_ambiti: [
    {
      id: 'stato',
      label: 'Stato adesione',
      filtri: [
        { campo: 'stato', label: 'Stato', tipo: 'multiselect_scalar', opzioni: STATO_ADESIONE_OPTS },
        { campo: 'data_adesione', label: 'Data adesione', tipo: 'date_range' },
        { campo: 'data_cessazione', label: 'Data cessazione', tipo: 'date_range' },
      ],
    },
    {
      id: 'identificazione',
      label: 'Identificazione',
      filtri: [
        { campo: 'codice_adesione', label: 'Codice adesione (contiene)', tipo: 'text' },
        { campo: 'ccnl_applicato', label: 'CCNL applicato (contiene)', tipo: 'text', placeholder: 'Es. Metalmeccanica' },
      ],
    },
    {
      id: 'dimensione',
      label: 'Dimensione',
      filtri: [
        { campo: 'dipendenti_aderenti', label: 'Dipendenti aderenti', tipo: 'number_range' },
      ],
    },
  ],
  colonne_risultati: [
    { campo: 'cliente.denominazione', label: 'Cliente', formato: 'testo', larghezza_excel: 32 },
    { campo: 'cliente.partita_iva', label: 'P. IVA', formato: 'testo', larghezza_excel: 14 },
    { campo: 'codice_adesione', label: 'Codice adesione', formato: 'testo', larghezza_excel: 18 },
    { campo: 'stato', label: 'Stato', formato: 'enum', enum_labels: Object.fromEntries(STATO_ADESIONE_OPTS.map(o => [o.value, o.label])), larghezza_excel: 12 },
    { campo: 'ccnl_applicato', label: 'CCNL', formato: 'testo', larghezza_excel: 28 },
    { campo: 'dipendenti_aderenti', label: 'Dipendenti aderenti', formato: 'numero', larghezza_excel: 14 },
    { campo: 'data_adesione', label: 'Data adesione', formato: 'data', larghezza_excel: 13 },
    { campo: 'data_cessazione', label: 'Data cessazione', formato: 'data', larghezza_excel: 13 },
  ],
  azioni_bulk: ['export_excel', 'export_pdf', 'email', 'crea_scadenza'],
  azione_email: { campo_email: 'cliente.email', campo_email_fallback: 'cliente.pec', campo_nome: 'cliente.denominazione' },
  azione_scadenza: { campo_cliente_id: 'cliente_id', campo_nome: 'cliente.denominazione' },
}
