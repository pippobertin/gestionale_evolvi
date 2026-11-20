/** Etichette leggibili per il registro delle operazioni (usate da server e interfaccia). */

export const ETICHETTE_EVENTO: Record<string, string> = {
  inserimento: 'Creazione',
  modifica: 'Modifica',
  eliminazione: 'Eliminazione',
  accesso: 'Accesso',
  accesso_negato: 'Accesso negato',
  uscita: 'Uscita',
  cambio_password: 'Cambio password',
  reimpostazione_password: 'Reimpostazione password',
  email_inviata: 'Email inviata',
  esportazione_registro: 'Esportazione del registro'
}

/** Gruppi di eventi per il filtro. */
export const GRUPPI_EVENTO: Record<string, { etichetta: string; eventi: string[] }> = {
  dati: { etichetta: 'Modifiche ai dati', eventi: ['inserimento', 'modifica', 'eliminazione'] },
  eliminazioni: { etichetta: 'Solo eliminazioni', eventi: ['eliminazione'] },
  accessi: { etichetta: 'Accessi e uscite', eventi: ['accesso', 'accesso_negato', 'uscita'] },
  negati: { etichetta: 'Accessi negati', eventi: ['accesso_negato'] },
  password: { etichetta: 'Password', eventi: ['cambio_password', 'reimpostazione_password'] },
  email: { etichetta: 'Email inviate', eventi: ['email_inviata'] }
}

export const ETICHETTE_CANALE: Record<string, string> = {
  interfaccia: 'Interfaccia',
  server: 'Server',
  sistema: 'Automatico',
  database: 'Database'
}

const ETICHETTE_TABELLA: Record<string, string> = {
  scadenze_bandi_clienti: 'Clienti',
  scadenze_bandi_clienti_esercizi: 'Esercizi di bilancio',
  scadenze_bandi_clienti_note: 'Note cliente',
  scadenze_bandi_clienti_referenti: 'Referenti cliente',
  scadenze_bandi_clienti_documenti: 'Documenti cliente',
  scadenze_bandi_clienti_esigenze: 'Esigenze cliente',
  scadenze_bandi_clienti_adesioni_fpi: 'Adesioni ai fondi interprofessionali',
  scadenze_bandi_clienti_bandi_esterni: 'Bandi esterni del cliente',
  scadenze_bandi_collegamenti_aziendali: 'Collegamenti aziendali',
  scadenze_bandi_legali_rappresentanti: 'Legali rappresentanti',
  scadenze_bandi_contatti: 'Contatti',
  scadenze_bandi_consulenti_clienti: 'Consulenti dei clienti',
  scadenze_bandi_documenti_cliente: 'Documenti cliente',
  scadenze_bandi_documenti_amministrativi: 'Documenti amministrativi',
  scadenze_bandi_contributi_ottenuti: 'Contributi ottenuti',
  scadenze_bandi_prospect: 'Prospect',
  scadenze_bandi_bandi: 'Bandi',
  scadenze_bandi_note_bandi: 'Note bando',
  scadenze_bandi_documenti_bando: 'Documenti bando',
  scadenze_bandi_documenti: 'Documenti bando',
  scadenze_bandi_bandi_esterni: 'Bandi esterni',
  scadenze_bandi_tipologie_bando: 'Tipologie di bando',
  scadenze_bandi_progetti: 'Progetti',
  scadenze_bandi_note_progetti: 'Note progetto',
  scadenze_bandi_documenti_progetto: 'Documenti progetto',
  scadenze_bandi_progetti_eventi: 'Eventi di progetto',
  scadenze_bandi_eventi_catalogo: 'Catalogo eventi',
  scadenze_bandi_scadenze: 'Scadenze',
  scadenze_bandi_responsabili_scadenze: 'Responsabili delle scadenze',
  scadenze_bandi_tipologie_scadenze: 'Tipologie di scadenza',
  scadenze_bandi_template_scadenze: 'Modelli di scadenza',
  scadenze_bandi_scadenze_contrattuali: 'Scadenze contrattuali',
  scadenze_bandi_contract_tracking: 'Contratti di progetto',
  scadenze_bandi_contratti_evolvi: 'Contratti Metodo Evolvi',
  scadenze_bandi_evolvi_fatture: 'Fatture Evolvi',
  scadenze_bandi_calendar_events: 'Eventi di calendario',
  scadenze_bandi_utenti: 'Utenti',
  scadenze_bandi_gruppi_utenti: 'Gruppi di utenti',
  scadenze_bandi_uffici_dipartimenti: 'Uffici',
  scadenze_bandi_notification_settings: 'Impostazioni notifiche',
  scadenze_bandi_additional_recipients: 'Destinatari aggiuntivi',
  scadenze_bandi_piani_formativi: 'Piani formativi',
  scadenze_bandi_corsi_formativi: 'Corsi',
  scadenze_bandi_partecipanti_formazione: 'Partecipanti alla formazione',
  scadenze_bandi_documenti_formazione: 'Documenti formazione',
  scadenze_bandi_certificazioni_obbligatorie: 'Certificazioni obbligatorie',
  scadenze_bandi_fondi_interprofessionali: 'Fondi interprofessionali',
  scadenze_bandi_fabbisogno_rilevazioni: 'Rilevazioni del fabbisogno',
  scadenze_bandi_fabbisogno_popolazione: 'Fabbisogno: popolazione',
  scadenze_bandi_fabbisogno_obblighi_dichiarati: 'Fabbisogno: obblighi',
  scadenze_bandi_fabbisogno_inserimenti_previsti: 'Fabbisogno: inserimenti',
  scadenze_bandi_profiling_template: 'Modelli di profilazione',
  scadenze_bandi_backup_registro: 'Backup',
  scadenze_bandi_sessioni: 'Sessioni'
}

export function etichettaTabella(tabella: string | null | undefined): string {
  if (!tabella) return ''
  return ETICHETTE_TABELLA[tabella] || tabella.replace(/^scadenze_bandi_/, '').replace(/_/g, ' ')
}

/** Aree per il filtro: un'etichetta può raggruppare più tabelle. */
export function areeRegistro(): string[] {
  return Array.from(new Set(Object.values(ETICHETTE_TABELLA))).sort((a, b) => a.localeCompare(b, 'it'))
}

export function tabellePerArea(area: string): string[] {
  return Object.entries(ETICHETTE_TABELLA).filter(([, e]) => e === area).map(([t]) => t)
}
