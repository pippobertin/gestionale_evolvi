import type { DefinizioneAmbito } from './registry'

export const ambitoProgetti: DefinizioneAmbito = {
  id: 'progetti',
  label: 'Progetti',
  descrizione: 'Progetti collegati a bandi, con dati di rendicontazione e contributo.',
  tabella: 'scadenze_bandi_progetti',
  join_cliente: true,
  ordinamento_default: { campo: 'created_at', direzione: 'desc' },
  sotto_ambiti: [
    {
      id: 'anagrafica',
      label: 'Anagrafica progetto',
      filtri: [
        { campo: 'titolo_progetto', label: 'Titolo (contiene)', tipo: 'text' },
        { campo: 'codice_progetto', label: 'Codice (contiene)', tipo: 'text' },
        { campo: 'stato', label: 'Stato (contiene)', tipo: 'text', placeholder: 'Es. attivo, completato' },
      ],
    },
    {
      id: 'tempi',
      label: 'Tempistica',
      filtri: [
        { campo: 'data_avvio_progetto', label: 'Data avvio', tipo: 'date_range' },
        { campo: 'data_fine_progetto_prevista', label: 'Data fine prevista', tipo: 'date_range' },
        { campo: 'scadenza_rendicontazione_finale', label: 'Scadenza rendicontazione', tipo: 'date_range' },
      ],
    },
    {
      id: 'contributo',
      label: 'Contributo',
      filtri: [
        { campo: 'contributo_ammesso', label: 'Contributo ammesso (€)', tipo: 'number_range' },
        { campo: 'contributo_ottenuto', label: 'Contributo ottenuto (€)', tipo: 'number_range' },
        { campo: 'importo_totale_progetto', label: 'Importo totale (€)', tipo: 'number_range' },
        { campo: 'percentuale_contributo', label: '% contributo', tipo: 'number_range' },
      ],
    },
  ],
  colonne_risultati: [
    { campo: 'titolo_progetto', label: 'Titolo progetto', formato: 'testo', larghezza_excel: 38 },
    { campo: 'codice_progetto', label: 'Codice', formato: 'testo', larghezza_excel: 16 },
    { campo: 'cliente.denominazione', label: 'Cliente', formato: 'testo', larghezza_excel: 30 },
    { campo: 'stato', label: 'Stato', formato: 'testo', larghezza_excel: 16 },
    { campo: 'importo_totale_progetto', label: 'Importo totale', formato: 'numero', larghezza_excel: 16 },
    { campo: 'contributo_ammesso', label: 'Contributo ammesso', formato: 'numero', larghezza_excel: 18 },
    { campo: 'contributo_ottenuto', label: 'Contributo ottenuto', formato: 'numero', larghezza_excel: 18 },
    { campo: 'data_avvio_progetto', label: 'Avvio', formato: 'data', larghezza_excel: 12 },
    { campo: 'data_fine_progetto_prevista', label: 'Fine prevista', formato: 'data', larghezza_excel: 12 },
    { campo: 'created_at', label: 'Creato il', formato: 'data', larghezza_excel: 12 },
  ],
  azioni_bulk: ['export_excel', 'export_pdf', 'email', 'crea_scadenza'],
  azione_email: { campo_email: 'cliente.email', campo_email_fallback: 'cliente.pec', campo_nome: 'cliente.denominazione' },
  azione_scadenza: { campo_cliente_id: 'cliente_id', campo_nome: 'titolo_progetto' },
}
