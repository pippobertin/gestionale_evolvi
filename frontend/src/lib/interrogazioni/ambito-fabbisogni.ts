/**
 * Configurazione ambito "Fabbisogni Formativi".
 * Mappa filtri e colonne per la tabella scadenze_bandi_fabbisogno_rilevazioni.
 */

import type { DefinizioneAmbito } from './registry'

// ----------------------------------------------------------------
// Opzioni (replicate dal questionario)
// ----------------------------------------------------------------

const STATO_RILEVAZIONE_OPTS = [
  { value: 'BOZZA', label: 'Bozza' },
  { value: 'INVIATA', label: 'Inviata' },
  { value: 'IN_COMPILAZIONE', label: 'In compilazione' },
  { value: 'COMPLETATA', label: 'Completata' },
  { value: 'SCADUTA', label: 'Scaduta' },
  { value: 'ARCHIVIATA', label: 'Archiviata' },
]

const RUOLO_OPTS = [
  { value: 'TITOLARE_AMMINISTRATORE', label: 'Titolare / Amministratore' },
  { value: 'DIRETTORE_GENERALE', label: 'Direttore Generale' },
  { value: 'HR_MANAGER', label: 'HR Manager' },
  { value: 'RESPONSABILE_FUNZIONE', label: 'Resp. di funzione' },
  { value: 'RESPONSABILE_STABILIMENTO', label: 'Resp. di stabilimento' },
  { value: 'ALTRO', label: 'Altro' },
]

const PIANO_OPTS = [
  { value: 'SI_AGGIORNATO', label: 'Sì, aggiornato annualmente' },
  { value: 'SI_NON_AGGIORNATO', label: 'Sì, non aggiornato' },
  { value: 'NO_CASO_PER_CASO', label: 'No, caso per caso' },
  { value: 'NO_PRIMA_VOLTA', label: 'No, prima volta' },
]

const AREE_GAP_OPTS = [
  { value: 'TECNICHE_RUOLO', label: 'Tecniche di ruolo' },
  { value: 'DIGITALI_IA', label: 'Digitali / IA' },
  { value: 'LINGUE', label: 'Lingue straniere' },
  { value: 'LEADERSHIP', label: 'Leadership' },
  { value: 'COMUNICAZIONE', label: 'Comunicazione e teamwork' },
  { value: 'VENDITA', label: 'Vendita e gestione cliente' },
  { value: 'PROJECT_MGMT', label: 'Project management' },
  { value: 'LEAN_QUALITA', label: 'Qualità / Lean' },
  { value: 'CONTROLLO_GESTIONE', label: 'Controllo di gestione' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'BENESSERE', label: 'Benessere / stress' },
  { value: 'ALTRO', label: 'Altro' },
]

const FIGURE_OPTS = [
  { value: 'OPERAI', label: 'Operai' },
  { value: 'IMPIEGATI_AMM', label: 'Impiegati amm.' },
  { value: 'TECNICI', label: 'Tecnici specializzati' },
  { value: 'COMMERCIALI', label: 'Commerciali' },
  { value: 'QUADRI', label: 'Quadri' },
  { value: 'DIRIGENTI', label: 'Dirigenti' },
  { value: 'NEOASSUNTI', label: 'Neoassunti' },
  { value: 'TUTTE', label: 'Tutte le figure' },
]

const MODALITA_OPTS = [
  { value: 'AULA_SEDE', label: 'Aula in sede' },
  { value: 'AULA_ESTERNA', label: 'Aula esterna' },
  { value: 'WEBINAR', label: 'Webinar / FAD' },
  { value: 'BLENDED', label: 'Blended' },
  { value: 'ON_THE_JOB', label: 'On the job' },
  { value: 'COACHING', label: 'Coaching' },
]

const BUDGET_OPTS = [
  { value: 'FINO_3000', label: 'Fino a 3.000 €' },
  { value: '3001_10000', label: '3.001 — 10.000 €' },
  { value: '10001_30000', label: '10.001 — 30.000 €' },
  { value: 'OLTRE_30000', label: 'Oltre 30.000 €' },
  { value: 'NON_DEFINITO', label: 'Non definito' },
]

const ORIZZONTE_OPTS = [
  { value: 'ENTRO_3_MESI', label: 'Entro 3 mesi (urgente)' },
  { value: 'ENTRO_6_MESI', label: 'Entro 6 mesi' },
  { value: 'ENTRO_FINE_ANNO', label: 'Entro fine anno' },
  { value: 'PLURIENNALE', label: 'Pluriennale' },
]

const VINCOLI_OPTS = [
  { value: 'LIBERARE_PERSONE', label: 'Difficoltà a liberare persone' },
  { value: 'TURNI_RIGIDI', label: 'Turni rigidi' },
  { value: 'SEDI_DISTACCATE', label: 'Sedi distaccate' },
  { value: 'BUDGET', label: 'Budget limitato' },
  { value: 'MOTIVAZIONE', label: 'Scarsa motivazione' },
  { value: 'NESSUNO', label: 'Nessuno' },
]

const CAMBIAMENTI_OPTS = [
  { value: 'TECNOLOGIE', label: 'Nuove tecnologie / software' },
  { value: 'RIORGANIZZAZIONE', label: 'Riorganizzazione interna' },
  { value: 'COMMERCIALE', label: 'Espansione commerciale' },
  { value: 'NORMATIVE', label: 'Nuove normative' },
  { value: 'CRESCITA', label: 'Nuove assunzioni' },
  { value: 'NESSUNO', label: 'Nessuno' },
]

// ----------------------------------------------------------------
// Ambito
// ----------------------------------------------------------------

export const ambitoFabbisogni: DefinizioneAmbito = {
  id: 'fabbisogni',
  label: 'Fabbisogni Formativi',
  descrizione: 'Rilevazioni del questionario di fabbisogno formativo compilate dai clienti.',
  tabella: 'scadenze_bandi_fabbisogno_rilevazioni',
  join_cliente: true,
  ordinamento_default: { campo: 'data_completamento', direzione: 'desc' },
  sotto_ambiti: [
    {
      id: 'stato_periodo',
      label: 'Stato e periodo',
      filtri: [
        { campo: 'stato', label: 'Stato rilevazione', tipo: 'multiselect_scalar', opzioni: STATO_RILEVAZIONE_OPTS },
        { campo: 'anno_riferimento', label: 'Anno di riferimento', tipo: 'number_range' },
        { campo: 'data_completamento', label: 'Periodo di compilazione', tipo: 'date_range' },
      ],
    },
    {
      id: 'anagrafica',
      label: 'Anagrafica e referente',
      filtri: [
        { campo: 'referente_ruolo', label: 'Ruolo del referente', tipo: 'multiselect_scalar', opzioni: RUOLO_OPTS },
        { campo: 'ateco_dichiarato', label: 'ATECO (contiene)', tipo: 'text', placeholder: 'Es. C28' },
        { campo: 'ccnl_dichiarato', label: 'CCNL (contiene)', tipo: 'text', placeholder: 'Es. Metalmeccanica' },
        { campo: 'numero_dipendenti_dichiarato', label: 'N. dipendenti dichiarati', tipo: 'number_range' },
      ],
    },
    {
      id: 'strategia',
      label: 'Strategia formativa',
      filtri: [
        { campo: 'piano_formazione_esistente', label: 'Piano formazione esistente', tipo: 'multiselect_scalar', opzioni: PIANO_OPTS },
        { campo: 'cambiamenti_previsti', label: 'Cambiamenti previsti', tipo: 'multiselect_array', opzioni: CAMBIAMENTI_OPTS },
      ],
    },
    {
      id: 'fabbisogni',
      label: 'Fabbisogni dichiarati',
      filtri: [
        { campo: 'aree_gap_competenze', label: 'Aree di gap competenza', tipo: 'multiselect_array', opzioni: AREE_GAP_OPTS },
        { campo: 'figure_prioritarie', label: 'Figure prioritarie', tipo: 'multiselect_array', opzioni: FIGURE_OPTS },
        { campo: 'livello_competenze_attuali', label: 'Livello competenze attuali (1-5)', tipo: 'number_range' },
      ],
    },
    {
      id: 'modalita_budget',
      label: 'Modalità, budget, vincoli',
      filtri: [
        { campo: 'modalita_erogazione', label: 'Modalità di erogazione', tipo: 'multiselect_array', opzioni: MODALITA_OPTS },
        { campo: 'budget_annuo', label: 'Budget annuo', tipo: 'multiselect_scalar', opzioni: BUDGET_OPTS },
        { campo: 'vincoli_organizzativi', label: 'Vincoli organizzativi', tipo: 'multiselect_array', opzioni: VINCOLI_OPTS },
      ],
    },
    {
      id: 'priorita',
      label: 'Priorità',
      filtri: [
        { campo: 'orizzonte_temporale', label: 'Orizzonte temporale', tipo: 'multiselect_scalar', opzioni: ORIZZONTE_OPTS },
        { campo: 'strategicita_formazione', label: 'Strategicità (1-5)', tipo: 'number_range' },
      ],
    },
  ],
  colonne_risultati: [
    { campo: 'cliente.denominazione', label: 'Azienda', formato: 'testo', larghezza_excel: 35 },
    { campo: 'cliente.partita_iva', label: 'P. IVA', formato: 'testo', larghezza_excel: 14 },
    { campo: 'titolo', label: 'Titolo rilevazione', formato: 'testo', larghezza_excel: 30 },
    { campo: 'anno_riferimento', label: 'Anno', formato: 'numero', larghezza_excel: 8 },
    { campo: 'stato', label: 'Stato', formato: 'enum', enum_labels: Object.fromEntries(STATO_RILEVAZIONE_OPTS.map(o => [o.value, o.label])), larghezza_excel: 16 },
    { campo: 'referente_nome', label: 'Referente', formato: 'testo', larghezza_excel: 25 },
    { campo: 'numero_dipendenti_dichiarato', label: 'Dipendenti', formato: 'numero', larghezza_excel: 12 },
    { campo: 'aree_gap_competenze', label: 'Aree di gap', formato: 'array', enum_labels: Object.fromEntries(AREE_GAP_OPTS.map(o => [o.value, o.label])), larghezza_excel: 40 },
    { campo: 'budget_annuo', label: 'Budget', formato: 'enum', enum_labels: Object.fromEntries(BUDGET_OPTS.map(o => [o.value, o.label])), larghezza_excel: 18 },
    { campo: 'orizzonte_temporale', label: 'Orizzonte', formato: 'enum', enum_labels: Object.fromEntries(ORIZZONTE_OPTS.map(o => [o.value, o.label])), larghezza_excel: 18 },
    { campo: 'data_completamento', label: 'Compilato il', formato: 'data', larghezza_excel: 14 },
  ],
  azioni_bulk: ['export_excel', 'export_pdf', 'email', 'crea_scadenza'],
  azione_email: { campo_email: 'cliente.email', campo_email_fallback: 'cliente.pec', campo_nome: 'cliente.denominazione' },
  azione_scadenza: { campo_cliente_id: 'cliente_id', campo_nome: 'cliente.denominazione' },
}
