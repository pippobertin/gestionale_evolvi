import type { DefinizioneAmbito } from './registry'
import { FORMA_LABEL } from '@/lib/contributi/types'

/**
 * Ambito "Aiuti RNA": tutti gli aiuti del Registro Nazionale Aiuti ricevuti
 * dai clienti (nostri e altrui). Utile soprattutto per i fondi
 * interprofessionali (chi è iscritto a quale fondo e lo usa) e per la
 * capienza de minimis. Fonte: RNA Open Data, CC BY 4.0.
 */

const toOpts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }))

const AMBITO_LABEL: Record<string, string> = {
  FPI: 'Fondo interprofessionale', GARANZIA_PMI: 'Fondo garanzia PMI', ALTRO: 'Altro',
}
const SI_NO: Record<string, string> = { true: 'Sì', false: 'No' }
const CATEGORIA_LABEL: Record<string, string> = {
  CLIENTE_SPOT: 'Cliente spot', EVOLVI: 'Evolvi', FPI: 'FPI', CONSULENTI: 'Consulenti',
}
const DIMENSIONE_LABEL: Record<string, string> = {
  MICRO: 'Micro', PICCOLA: 'Piccola', MEDIA: 'Media', GRANDE: 'Grande',
}

export const ambitoRna: DefinizioneAmbito = {
  id: 'rna',
  label: 'Aiuti RNA',
  descrizione: 'Aiuti di Stato registrati nel Registro Nazionale Aiuti per i clienti (nostri e non). Fonte: RNA Open Data, CC BY 4.0.',
  tabella: 'vista_rna_aiuti',
  join_cliente: false, // la vista contiene già i campi cliente
  ordinamento_default: { campo: 'data_concessione', direzione: 'desc' },
  sotto_ambiti: [
    {
      id: 'cliente',
      label: 'Cliente',
      filtri: [
        { campo: 'cliente_denominazione', label: 'Azienda (contiene)', tipo: 'text' },
        { campo: 'cliente_provincia', label: 'Provincia (contiene)', tipo: 'text', placeholder: 'Es. AN' },
        { campo: 'cliente_categoria_evolvi', label: 'Categoria cliente', tipo: 'multiselect_scalar', opzioni: toOpts(CATEGORIA_LABEL) },
        { campo: 'cliente_dimensione', label: 'Dimensione', tipo: 'multiselect_scalar', opzioni: toOpts(DIMENSIONE_LABEL) },
      ],
    },
    {
      id: 'aiuto',
      label: 'Aiuto',
      filtri: [
        { campo: 'ambito', label: 'Ambito', tipo: 'multiselect_scalar', opzioni: toOpts(AMBITO_LABEL) },
        { campo: 'fondo_interprofessionale', label: 'Fondo interprofessionale (contiene)', tipo: 'text', placeholder: 'Es. Fonder' },
        { campo: 'titolo_misura', label: 'Misura (contiene)', tipo: 'text' },
        { campo: 'soggetto_concedente', label: 'Ente concedente (contiene)', tipo: 'text' },
        { campo: 'forma_proposta', label: 'Forma', tipo: 'multiselect_scalar', opzioni: toOpts(FORMA_LABEL) },
        { campo: 'de_minimis', label: 'De minimis', tipo: 'select', opzioni: toOpts(SI_NO) },
        { campo: 'nostro', label: 'Seguito da noi', tipo: 'select', opzioni: toOpts(SI_NO) },
      ],
    },
    {
      id: 'importi_tempi',
      label: 'Importi e tempi',
      filtri: [
        { campo: 'data_concessione', label: 'Data concessione', tipo: 'date_range' },
        { campo: 'anno_concessione', label: 'Anno', tipo: 'number_range' },
        { campo: 'elemento_aiuto', label: 'ESL (€)', tipo: 'number_range' },
        { campo: 'importo_nominale', label: 'Importo nominale (€)', tipo: 'number_range' },
      ],
    },
  ],
  colonne_risultati: [
    { campo: 'cliente_denominazione', label: 'Cliente', formato: 'testo', larghezza_excel: 30 },
    { campo: 'data_concessione', label: 'Concessione', formato: 'data', larghezza_excel: 12 },
    { campo: 'titolo_misura', label: 'Misura', formato: 'testo', larghezza_excel: 40 },
    { campo: 'soggetto_concedente', label: 'Ente', formato: 'testo', larghezza_excel: 26 },
    { campo: 'fondo_interprofessionale', label: 'Fondo', formato: 'testo', larghezza_excel: 14 },
    { campo: 'forma_proposta', label: 'Forma', formato: 'enum', enum_labels: FORMA_LABEL, larghezza_excel: 18 },
    { campo: 'importo_nominale', label: 'Nominale', formato: 'valuta', larghezza_excel: 14 },
    { campo: 'elemento_aiuto', label: 'ESL', formato: 'valuta', larghezza_excel: 13 },
    { campo: 'de_minimis', label: 'De minimis', formato: 'enum', enum_labels: SI_NO, larghezza_excel: 10 },
    { campo: 'nostro', label: 'Nostro', formato: 'enum', enum_labels: SI_NO, larghezza_excel: 8 },
    { campo: 'cor', label: 'COR', formato: 'testo', larghezza_excel: 11 },
  ],
  azioni_bulk: ['export_excel', 'export_pdf', 'email', 'crea_scadenza'],
  azione_email: { campo_email: 'cliente_email', campo_email_fallback: 'cliente_pec', campo_nome: 'cliente_denominazione' },
  azione_scadenza: { campo_cliente_id: 'cliente_id', campo_nome: 'titolo_misura' },
}
