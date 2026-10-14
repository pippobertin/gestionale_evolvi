import type { DefinizioneAmbito } from './registry'
import { FORMA_LABEL, STATO_LABEL } from '@/lib/contributi/types'

const toOpts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }))

const ORIGINE_LABEL: Record<string, string> = { DA_PROGETTO: 'Da progetto', MANUALE: 'Manuale' }
const CATEGORIA_LABEL: Record<string, string> = {
  CLIENTE_SPOT: 'Cliente spot', EVOLVI: 'Evolvi', FPI: 'FPI', CONSULENTI: 'Consulenti',
}
const DIMENSIONE_LABEL: Record<string, string> = {
  MICRO: 'Micro', PICCOLA: 'Piccola', MEDIA: 'Media', GRANDE: 'Grande',
}

export const ambitoContributi: DefinizioneAmbito = {
  id: 'contributi',
  label: 'Contributi ottenuti',
  descrizione: 'Agevolazioni ottenute dai clienti: bando, forma, importi, ESL e riferimenti RNA.',
  tabella: 'vista_contributi_ottenuti',
  join_cliente: false, // la vista contiene già i campi cliente
  ordinamento_default: { campo: 'anno_competenza', direzione: 'desc' },
  sotto_ambiti: [
    {
      id: 'cliente',
      label: 'Cliente',
      filtri: [
        { campo: 'cliente_denominazione', label: 'Azienda (contiene)', tipo: 'text' },
        { campo: 'cliente_provincia', label: 'Provincia (contiene)', tipo: 'text', placeholder: 'Es. VR' },
        { campo: 'cliente_categoria_evolvi', label: 'Categoria cliente', tipo: 'multiselect_scalar', opzioni: toOpts(CATEGORIA_LABEL) },
        { campo: 'cliente_dimensione', label: 'Dimensione', tipo: 'multiselect_scalar', opzioni: toOpts(DIMENSIONE_LABEL) },
      ],
    },
    {
      id: 'contributo',
      label: 'Contributo',
      filtri: [
        { campo: 'bando_nome', label: 'Bando (contiene)', tipo: 'text' },
        { campo: 'ente_erogatore', label: 'Ente erogatore (contiene)', tipo: 'text' },
        { campo: 'forma_contributo', label: 'Forma', tipo: 'multiselect_scalar', opzioni: toOpts(FORMA_LABEL) },
        { campo: 'stato', label: 'Stato', tipo: 'multiselect_scalar', opzioni: toOpts(STATO_LABEL) },
        { campo: 'origine', label: 'Origine', tipo: 'select', opzioni: toOpts(ORIGINE_LABEL) },
        { campo: 'regime_aiuto', label: 'Regime di aiuto (contiene)', tipo: 'text', placeholder: 'Es. de minimis' },
      ],
    },
    {
      id: 'importi_tempi',
      label: 'Importi e tempi',
      filtri: [
        { campo: 'anno_competenza', label: 'Anno', tipo: 'number_range' },
        { campo: 'importo_contributo', label: 'Contributo (€)', tipo: 'number_range' },
        { campo: 'esl', label: 'ESL (€)', tipo: 'number_range' },
        { campo: 'data_concessione', label: 'Data concessione', tipo: 'date_range' },
        { campo: 'data_erogazione', label: 'Data erogazione', tipo: 'date_range' },
      ],
    },
  ],
  colonne_risultati: [
    { campo: 'cliente_denominazione', label: 'Cliente', formato: 'testo', larghezza_excel: 30 },
    { campo: 'anno_competenza', label: 'Anno', formato: 'numero', larghezza_excel: 8 },
    { campo: 'bando_nome', label: 'Bando', formato: 'testo', larghezza_excel: 38 },
    { campo: 'ente_erogatore', label: 'Ente', formato: 'testo', larghezza_excel: 24 },
    { campo: 'forma_contributo', label: 'Forma', formato: 'enum', enum_labels: FORMA_LABEL, larghezza_excel: 20 },
    { campo: 'importo_progetto', label: 'Importo progetto', formato: 'valuta', larghezza_excel: 16 },
    { campo: 'importo_contributo', label: 'Contributo', formato: 'valuta', larghezza_excel: 16 },
    { campo: 'esl', label: 'ESL', formato: 'valuta', larghezza_excel: 14 },
    { campo: 'intensita_aiuto_pct', label: 'Intensità %', formato: 'numero', larghezza_excel: 11 },
    { campo: 'stato', label: 'Stato', formato: 'enum', enum_labels: STATO_LABEL, larghezza_excel: 16 },
    { campo: 'regime_aiuto', label: 'Regime', formato: 'testo', larghezza_excel: 24 },
    { campo: 'rna_codice_concessione', label: 'COR RNA', formato: 'testo', larghezza_excel: 14 },
    { campo: 'data_concessione', label: 'Concessione', formato: 'data', larghezza_excel: 12 },
    { campo: 'origine', label: 'Origine', formato: 'enum', enum_labels: ORIGINE_LABEL, larghezza_excel: 12 },
  ],
  azioni_bulk: ['export_excel', 'export_pdf', 'email', 'crea_scadenza'],
  azione_email: { campo_email: 'cliente_email', campo_email_fallback: 'cliente_pec', campo_nome: 'cliente_denominazione' },
  azione_scadenza: { campo_cliente_id: 'cliente_id', campo_nome: 'bando_nome' },
}
