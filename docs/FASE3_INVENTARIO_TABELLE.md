# Fase 3: inventario degli accessi alle tabelle del gestionale

Generato automaticamente dal codice il 19/11/2026 (ricerca delle chiamate `.from(...)`). Serve a pianificare i gruppi del passaggio D: per ogni tabella indica dove viene letta o scritta.

Legenda: **browser** = componenti eseguiti nel browser (oggi con la chiave pubblica; con il badge porteranno l'identità dell'utente); **server-pubblico** = route API che usano la chiave pubblica (da sistemare nel passaggio C); **server-admin** = route API con chiave riservata; **server-misto** = route con entrambe; **lib** = librerie condivise (vanno controllate caso per caso: alcune girano nel browser, altre sul server).

| Tabella / vista | browser | server-pubblico | server-admin/misto | lib |
|---|---|---|---|---|
| `scadenze_bandi_additional_recipients` | 0 | 1 | 0 | 1 |
| `scadenze_bandi_ateco_2025` | 0 | 1 | 0 | 0 |
| `scadenze_bandi_bandi` | 6 | 6 | 0 | 0 |
| `scadenze_bandi_bandi_esterni` | 1 | 0 | 1 | 0 |
| `scadenze_bandi_calendar_events` | 0 | 0 | 0 | 1 |
| `scadenze_bandi_ccnl` | 0 | 2 | 0 | 0 |
| `scadenze_bandi_ccnl_sigle` | 0 | 2 | 0 | 0 |
| `scadenze_bandi_certificazioni_obbligatorie` | 0 | 7 | 0 | 1 |
| `scadenze_bandi_clienti` | 10 | 18 | 0 | 0 |
| `scadenze_bandi_clienti_adesioni_fpi` | 1 | 5 | 0 | 0 |
| `scadenze_bandi_clienti_bandi_esterni` | 1 | 0 | 0 | 0 |
| `scadenze_bandi_clienti_con_dimensione_aggregata` | 1 | 0 | 0 | 0 |
| `scadenze_bandi_clienti_documenti` | 1 | 0 | 0 | 0 |
| `scadenze_bandi_clienti_esigenze` | 1 | 0 | 0 | 0 |
| `scadenze_bandi_clienti_note` | 3 | 0 | 1 | 0 |
| `scadenze_bandi_clienti_note_full` | 1 | 0 | 0 | 0 |
| `scadenze_bandi_clienti_referenti` | 1 | 1 | 0 | 0 |
| `scadenze_bandi_collegamenti_aziendali` | 3 | 2 | 0 | 0 |
| `scadenze_bandi_consulenti_clienti` | 0 | 3 | 0 | 0 |
| `scadenze_bandi_contract_tracking` | 2 | 10 | 0 | 0 |
| `scadenze_bandi_contratti_evolvi` | 1 | 10 | 0 | 2 |
| `scadenze_bandi_contributi_ottenuti` | 0 | 6 | 0 | 2 |
| `scadenze_bandi_corsi_formativi` | 0 | 7 | 0 | 0 |
| `scadenze_bandi_documenti` | 2 | 0 | 0 | 0 |
| `scadenze_bandi_documenti_amministrativi` | 1 | 4 | 0 | 0 |
| `scadenze_bandi_documenti_formazione` | 1 | 0 | 0 | 0 |
| `scadenze_bandi_documenti_progetto` | 2 | 2 | 0 | 0 |
| `scadenze_bandi_email_queue` | 0 | 0 | 0 | 1 |
| `scadenze_bandi_eventi_catalogo` | 2 | 0 | 0 | 0 |
| `scadenze_bandi_evolvi_fatture` | 2 | 7 | 0 | 2 |
| `scadenze_bandi_fabbisogno_inserimenti_previsti` | 0 | 3 | 0 | 0 |
| `scadenze_bandi_fabbisogno_obblighi_dichiarati` | 0 | 3 | 0 | 0 |
| `scadenze_bandi_fabbisogno_popolazione` | 0 | 3 | 0 | 0 |
| `scadenze_bandi_fabbisogno_rilevazioni` | 0 | 8 | 0 | 0 |
| `scadenze_bandi_fatture_evolvi` | 0 | 1 | 0 | 0 |
| `scadenze_bandi_fondi_interprofessionali` | 0 | 1 | 0 | 0 |
| `scadenze_bandi_gruppi_utenti` | 3 | 0 | 0 | 0 |
| `scadenze_bandi_note_bandi` | 1 | 0 | 1 | 0 |
| `scadenze_bandi_note_progetti` | 1 | 0 | 1 | 0 |
| `scadenze_bandi_notification_log` | 0 | 0 | 0 | 1 |
| `scadenze_bandi_notification_settings` | 0 | 1 | 0 | 1 |
| `scadenze_bandi_partecipanti_formazione` | 0 | 2 | 0 | 0 |
| `scadenze_bandi_piani_formativi` | 0 | 6 | 0 | 1 |
| `scadenze_bandi_profiling_template` | 2 | 1 | 0 | 0 |
| `scadenze_bandi_progetti` | 6 | 7 | 0 | 2 |
| `scadenze_bandi_progetti_view` | 2 | 0 | 0 | 0 |
| `scadenze_bandi_prospect` | 5 | 6 | 0 | 0 |
| `scadenze_bandi_prospect_history` | 2 | 5 | 0 | 0 |
| `scadenze_bandi_responsabili_scadenze` | 2 | 0 | 0 | 0 |
| `scadenze_bandi_rna_agente` | 0 | 1 | 0 | 0 |
| `scadenze_bandi_rna_aiuti` | 0 | 2 | 0 | 1 |
| `scadenze_bandi_rna_import_log` | 0 | 1 | 0 | 1 |
| `scadenze_bandi_rna_richieste` | 0 | 1 | 0 | 0 |
| `scadenze_bandi_scadenze` | 7 | 3 | 0 | 2 |
| `scadenze_bandi_scadenze_contrattuali` | 3 | 15 | 0 | 2 |
| `scadenze_bandi_scadenze_contrattuali_log` | 0 | 5 | 0 | 1 |
| `scadenze_bandi_sessioni` | 0 | 0 | 1 | 0 |
| `scadenze_bandi_sigle_sindacali` | 0 | 2 | 0 | 0 |
| `scadenze_bandi_system_settings` | 0 | 0 | 4 | 3 |
| `scadenze_bandi_template` | 1 | 0 | 0 | 0 |
| `scadenze_bandi_template_scadenze` | 3 | 0 | 0 | 0 |
| `scadenze_bandi_tipologie_scadenze` | 1 | 0 | 0 | 0 |
| `scadenze_bandi_uffici_dipartimenti` | 1 | 0 | 0 | 0 |
| `scadenze_bandi_utenti` | 4 | 6 | 13 | 3 |

## Dettaglio dei file

### `scadenze_bandi_additional_recipients`
- server-pubblico: `app/api/notifications/additional-recipients/route.ts`
- lib: `lib/notifications/emailService.ts`

### `scadenze_bandi_ateco_2025`
- server-pubblico: `app/api/clienti/import-csv/route.ts`

### `scadenze_bandi_bandi`
- browser: `components/BandiContent.tsx`, `components/BandoForm.tsx`, `components/ContributoFormModal.tsx`, `components/ProgettiContent.tsx`, `components/ProgettoForm.tsx`, `components/ScadenzaForm.tsx`
- server-pubblico: `app/api/contracts/approve/route.ts`, `app/api/contracts/generate/route.ts`, `app/api/contracts/send-email/route.ts`, `app/api/notifications/recent/route.ts`, `app/api/search/global/route.ts`, `pages/api/drive/cleanup-legacy.ts`

### `scadenze_bandi_bandi_esterni`
- browser: `components/BandiEsterniManager.tsx`
- server-admin: `app/api/bandi-esterni/ingest-gmail/route.ts`

### `scadenze_bandi_calendar_events`
- lib: `lib/notifications/calendarService.ts`

### `scadenze_bandi_ccnl`
- server-pubblico: `app/api/formazione/ccnl/route.ts`, `app/api/formazione/import-ccnl/route.ts`

### `scadenze_bandi_ccnl_sigle`
- server-pubblico: `app/api/formazione/import-ccnl/route.ts`, `app/api/formazione/sigle-sindacali/route.ts`

### `scadenze_bandi_certificazioni_obbligatorie`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/clienti/[id]/formazione/certificazioni/[certId]/rinnova/route.ts`, `app/api/clienti/[id]/formazione/certificazioni/[certId]/route.ts`, `app/api/clienti/[id]/formazione/certificazioni/route.ts`, `app/api/clienti/[id]/formazione/panoramica/route.ts`, `app/api/fabbisogno/[token]/route.ts`, `app/api/formazione/stats/route.ts`
- lib: `lib/formazione/syncScadenze.ts`

### `scadenze_bandi_clienti`
- browser: `components/ClienteDettaglio.tsx`, `components/ClienteForm.tsx`, `components/ClientiContent.tsx`, `components/ConsulenteDettaglio.tsx`, `components/ConsulentiContent.tsx`, `components/NoteCollegateBox.tsx`, `components/NuovaAziendaCollegataModal.tsx`, `components/ProgettoForm.tsx`, `components/ProspectConversionModal.tsx`, `components/ScadenzaForm.tsx`
- server-pubblico: `app/api/clienti/[id]/contributi/export-pdf/route.ts`, `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/clienti/[id]/formazione/fabbisogno/[rilevazioneId]/export-pdf/route.ts`, `app/api/clienti/[id]/formazione/fabbisogno/[rilevazioneId]/send-email/route.ts`, `app/api/clienti/[id]/rna/route.ts`, `app/api/clienti/import-csv/route.ts`, `app/api/contracts/approve/route.ts`, `app/api/contracts/evolvi/[id]/route.ts`, `app/api/contracts/evolvi/approve/route.ts`, `app/api/contracts/evolvi/generate/route.ts`, `app/api/contracts/evolvi/route.ts`, `app/api/contracts/evolvi/send-email/route.ts`, `app/api/contracts/generate/route.ts`, `app/api/contracts/send-email/route.ts`, `app/api/contracts/tracking/[id]/send-reminder/route.ts`, `app/api/fabbisogno/[token]/route.ts`, `app/api/prospect/[id]/convert/route.ts`, `app/api/search/global/route.ts`

### `scadenze_bandi_clienti_adesioni_fpi`
- browser: `components/formazione/FormazioneManager.tsx`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/clienti/[id]/formazione/adesioni/[adesioneId]/route.ts`, `app/api/clienti/[id]/formazione/adesioni/route.ts`, `app/api/consulenti/[id]/stats/route.ts`, `app/api/fabbisogno/[token]/route.ts`

### `scadenze_bandi_clienti_bandi_esterni`
- browser: `components/ListaSpesa.tsx`

### `scadenze_bandi_clienti_con_dimensione_aggregata`
- browser: `components/ClientiContent.tsx`

### `scadenze_bandi_clienti_documenti`
- browser: `components/DocumentiManager.tsx`

### `scadenze_bandi_clienti_esigenze`
- browser: `components/ListaSpesa.tsx`

### `scadenze_bandi_clienti_note`
- browser: `components/NoteInboxContent.tsx`, `components/NoteTimeline.tsx`, `components/Sidebar.tsx`
- server-admin: `app/api/notes/ingest/route.ts`

### `scadenze_bandi_clienti_note_full`
- browser: `components/NoteTimeline.tsx`

### `scadenze_bandi_clienti_referenti`
- browser: `components/ReferentiManager.tsx`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`

### `scadenze_bandi_collegamenti_aziendali`
- browser: `components/ClienteDettaglio.tsx`, `components/ClienteForm.tsx`, `components/ClientiContent.tsx`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/clienti/[id]/rna/route.ts`

### `scadenze_bandi_consulenti_clienti`
- server-pubblico: `app/api/consulenti/[id]/clienti/[relId]/route.ts`, `app/api/consulenti/[id]/clienti/route.ts`, `app/api/consulenti/[id]/stats/route.ts`

### `scadenze_bandi_contract_tracking`
- browser: `components/ContractTrackingPanel.tsx`, `components/ContractTrackingWidget.tsx`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/contracts/approve/route.ts`, `app/api/contracts/evolvi/[id]/route.ts`, `app/api/contracts/evolvi/send-email/route.ts`, `app/api/contracts/send-email/route.ts`, `app/api/contracts/tracking/[id]/route.ts`, `app/api/contracts/tracking/[id]/send-reminder/route.ts`, `app/api/contracts/tracking/[id]/upload-signed/route.ts`, `app/api/contracts/tracking/check-deliveries/route.ts`, `app/api/contracts/tracking/route.ts`

### `scadenze_bandi_contratti_evolvi`
- browser: `components/ContrattiEvolviManager.tsx`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/consulenti/[id]/stats/route.ts`, `app/api/contracts/evolvi/[id]/route.ts`, `app/api/contracts/evolvi/approve/route.ts`, `app/api/contracts/evolvi/generate/route.ts`, `app/api/contracts/evolvi/renew/route.ts`, `app/api/contracts/evolvi/route.ts`, `app/api/contracts/evolvi/send-email/route.ts`, `app/api/evolvi/billing/process/route.ts`, `app/api/search/global/route.ts`
- lib: `lib/billing/billingScheduler.ts`, `lib/notifications/notificationService.ts`

### `scadenze_bandi_contributi_ottenuti`
- server-pubblico: `app/api/clienti/[id]/contributi/[contributoId]/route.ts`, `app/api/clienti/[id]/contributi/export-pdf/route.ts`, `app/api/clienti/[id]/contributi/riepilogo/route.ts`, `app/api/clienti/[id]/contributi/route.ts`, `app/api/clienti/[id]/rna/[aiutoId]/route.ts`, `app/api/clienti/[id]/rna/route.ts`
- lib: `lib/contributi/syncFromProgetto.ts`, `lib/rna/importer.ts`

### `scadenze_bandi_corsi_formativi`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/clienti/[id]/formazione/corsi/[corsoId]/partecipanti/route.ts`, `app/api/clienti/[id]/formazione/corsi/[corsoId]/route.ts`, `app/api/clienti/[id]/formazione/corsi/route.ts`, `app/api/clienti/[id]/formazione/panoramica/route.ts`, `app/api/consulenti/[id]/stats/route.ts`, `app/api/formazione/stats/route.ts`

### `scadenze_bandi_documenti`
- browser: `components/BandoForm.tsx`, `components/ProgettoForm.tsx`

### `scadenze_bandi_documenti_amministrativi`
- browser: `components/DocumentiAmministrativiManager.tsx`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/clienti/[id]/documenti-amministrativi/[docId]/download/route.ts`, `app/api/clienti/[id]/documenti-amministrativi/[docId]/route.ts`, `app/api/clienti/[id]/documenti-amministrativi/route.ts`

### `scadenze_bandi_documenti_formazione`
- browser: `components/formazione/DocumentiFormazioneManager.tsx`

### `scadenze_bandi_documenti_progetto`
- browser: `components/DocumentiProgettoPreview.tsx`, `components/ProgettoForm.tsx`
- server-pubblico: `app/api/contracts/approve/route.ts`, `app/api/drive/create-progetto/route.ts`

### `scadenze_bandi_email_queue`
- lib: `lib/notifications/emailService.ts`

### `scadenze_bandi_eventi_catalogo`
- browser: `components/BandoForm.tsx`, `components/ProgettoForm.tsx`

### `scadenze_bandi_evolvi_fatture`
- browser: `components/EvolviDashboardBilling.tsx`, `components/EvolviInvoicesContent.tsx`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/consulenti/[id]/stats/route.ts`, `app/api/evolvi/billing/process/route.ts`, `app/api/evolvi/fatture/[id]/mark-paid/route.ts`, `app/api/evolvi/fatture/[id]/route.ts`, `app/api/evolvi/fatture/route.ts`, `app/api/search/global/route.ts`
- lib: `lib/billing/billingScheduler.ts`, `lib/notifications/notificationService.ts`

### `scadenze_bandi_fabbisogno_inserimenti_previsti`
- server-pubblico: `app/api/clienti/[id]/formazione/fabbisogno/[rilevazioneId]/export-pdf/route.ts`, `app/api/clienti/[id]/formazione/fabbisogno/[rilevazioneId]/route.ts`, `app/api/fabbisogno/[token]/route.ts`

### `scadenze_bandi_fabbisogno_obblighi_dichiarati`
- server-pubblico: `app/api/clienti/[id]/formazione/fabbisogno/[rilevazioneId]/export-pdf/route.ts`, `app/api/clienti/[id]/formazione/fabbisogno/[rilevazioneId]/route.ts`, `app/api/fabbisogno/[token]/route.ts`

### `scadenze_bandi_fabbisogno_popolazione`
- server-pubblico: `app/api/clienti/[id]/formazione/fabbisogno/[rilevazioneId]/export-pdf/route.ts`, `app/api/clienti/[id]/formazione/fabbisogno/[rilevazioneId]/route.ts`, `app/api/fabbisogno/[token]/route.ts`

### `scadenze_bandi_fabbisogno_rilevazioni`
- server-pubblico: `app/api/clienti/[id]/formazione/fabbisogno/[rilevazioneId]/export-pdf/route.ts`, `app/api/clienti/[id]/formazione/fabbisogno/[rilevazioneId]/invia/route.ts`, `app/api/clienti/[id]/formazione/fabbisogno/[rilevazioneId]/route.ts`, `app/api/clienti/[id]/formazione/fabbisogno/[rilevazioneId]/send-email/route.ts`, `app/api/clienti/[id]/formazione/fabbisogno/route.ts`, `app/api/fabbisogno/[token]/route.ts`, `app/api/fabbisogno/[token]/submit/route.ts`, `app/api/notifications/recent/route.ts`

### `scadenze_bandi_fatture_evolvi`
- server-pubblico: `app/api/contracts/evolvi/[id]/route.ts`

### `scadenze_bandi_fondi_interprofessionali`
- server-pubblico: `app/api/formazione/fondi/route.ts`

### `scadenze_bandi_gruppi_utenti`
- browser: `components/GroupsManagement.tsx`, `components/UnifiedMultiResponsableSelector.tsx`, `components/UnifiedResponsableSelector.tsx`

### `scadenze_bandi_note_bandi`
- browser: `components/NoteTimeline.tsx`
- server-admin: `app/api/notes/ingest/route.ts`

### `scadenze_bandi_note_progetti`
- browser: `components/NoteTimeline.tsx`
- server-admin: `app/api/notes/ingest/route.ts`

### `scadenze_bandi_notification_log`
- lib: `lib/notifications/notificationService.ts`

### `scadenze_bandi_notification_settings`
- server-pubblico: `app/api/notifications/settings/route.ts`
- lib: `lib/notifications/notificationService.ts`

### `scadenze_bandi_partecipanti_formazione`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/clienti/[id]/formazione/corsi/[corsoId]/partecipanti/route.ts`

### `scadenze_bandi_piani_formativi`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/clienti/[id]/formazione/panoramica/route.ts`, `app/api/clienti/[id]/formazione/piani/[pianoId]/route.ts`, `app/api/clienti/[id]/formazione/piani/route.ts`, `app/api/consulenti/[id]/stats/route.ts`, `app/api/formazione/stats/route.ts`
- lib: `lib/formazione/syncScadenze.ts`

### `scadenze_bandi_profiling_template`
- browser: `components/PrequalificaForm.tsx`, `components/ProspectDettaglio.tsx`
- server-pubblico: `app/api/prospect/profiling-template/route.ts`

### `scadenze_bandi_progetti`
- browser: `components/BandiContent.tsx`, `components/ClientiContent.tsx`, `components/ProgettiContent.tsx`, `components/ProgettoForm.tsx`, `components/ReportsContent.tsx`, `components/ScadenzeContent.tsx`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/consulenti/[id]/stats/route.ts`, `app/api/contracts/approve/route.ts`, `app/api/contracts/generate/route.ts`, `app/api/contracts/send-email/route.ts`, `app/api/notifications/recent/route.ts`, `app/api/search/global/route.ts`
- lib: `lib/contributi/syncFromProgetto.ts`, `lib/notifications/notificationService.ts`

### `scadenze_bandi_progetti_view`
- browser: `components/ProgettiContent.tsx`, `components/ScadenzaForm.tsx`

### `scadenze_bandi_prospect`
- browser: `components/PrequalificaForm.tsx`, `components/ProspectContent.tsx`, `components/ProspectConversionModal.tsx`, `components/ProspectDettaglio.tsx`, `components/ProspectForm.tsx`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/prospect/[id]/convert/route.ts`, `app/api/prospect/[id]/route.ts`, `app/api/prospect/route.ts`, `app/api/prospect/thaw-check/route.ts`, `app/api/search/global/route.ts`

### `scadenze_bandi_prospect_history`
- browser: `components/ProspectConversionModal.tsx`, `components/ProspectDettaglio.tsx`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/prospect/[id]/convert/route.ts`, `app/api/prospect/[id]/route.ts`, `app/api/prospect/route.ts`, `app/api/prospect/thaw-check/route.ts`

### `scadenze_bandi_responsabili_scadenze`
- browser: `components/ScadenzaForm.tsx`, `components/ScadenzeContent.tsx`

### `scadenze_bandi_rna_agente`
- server-pubblico: `app/api/rna/richieste/route.ts`

### `scadenze_bandi_rna_aiuti`
- server-pubblico: `app/api/clienti/[id]/rna/[aiutoId]/route.ts`, `app/api/clienti/[id]/rna/route.ts`
- lib: `lib/rna/importer.ts`

### `scadenze_bandi_rna_import_log`
- server-pubblico: `app/api/clienti/[id]/rna/route.ts`
- lib: `lib/rna/importer.ts`

### `scadenze_bandi_rna_richieste`
- server-pubblico: `app/api/rna/richieste/route.ts`

### `scadenze_bandi_scadenze`
- browser: `components/BandiContent.tsx`, `components/ClientiContent.tsx`, `components/DashboardContent.tsx`, `components/ProgettiContent.tsx`, `components/ProgettoForm.tsx`, `components/ScadenzaForm.tsx`, `components/ScadenzeContent.tsx`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/notifications/recent/route.ts`, `app/api/search/global/route.ts`
- lib: `lib/notifications/calendarService.ts`, `lib/notifications/notificationService.ts`

### `scadenze_bandi_scadenze_contrattuali`
- browser: `components/DashboardContent.tsx`, `components/PrequalificaForm.tsx`, `components/ScadenzeContent.tsx`
- server-pubblico: `app/api/clienti/[id]/convert-to-prospect/route.ts`, `app/api/clienti/[id]/formazione/certificazioni/[certId]/route.ts`, `app/api/clienti/[id]/formazione/panoramica/route.ts`, `app/api/clienti/[id]/formazione/piani/[pianoId]/route.ts`, `app/api/contracts/evolvi/[id]/route.ts`, `app/api/contracts/evolvi/route.ts`, `app/api/interrogazioni/crea-scadenza/route.ts`, `app/api/notifications/recent/route.ts`, `app/api/prospect/thaw-check/route.ts`, `app/api/scadenze-contrattuali/[id]/complete/route.ts`, `app/api/scadenze-contrattuali/[id]/route.ts`, `app/api/scadenze-contrattuali/dashboard/route.ts`, `app/api/scadenze-contrattuali/notifications/process/route.ts`, `app/api/scadenze-contrattuali/reports/route.ts`, `app/api/scadenze-contrattuali/route.ts`
- lib: `lib/formazione/syncScadenze.ts`, `lib/notifications/notificationService.ts`

### `scadenze_bandi_scadenze_contrattuali_log`
- server-pubblico: `app/api/contracts/evolvi/route.ts`, `app/api/scadenze-contrattuali/[id]/complete/route.ts`, `app/api/scadenze-contrattuali/[id]/route.ts`, `app/api/scadenze-contrattuali/notifications/process/route.ts`, `app/api/scadenze-contrattuali/route.ts`
- lib: `lib/notifications/notificationService.ts`

### `scadenze_bandi_sessioni`
- server-admin: `app/api/auth/login/route.ts`

### `scadenze_bandi_sigle_sindacali`
- server-pubblico: `app/api/formazione/import-ccnl/route.ts`, `app/api/formazione/sigle-sindacali/route.ts`

### `scadenze_bandi_system_settings`
- server-admin: `app/api/auth/gmail/callback/route.ts`, `app/api/gmail/debug/route.ts`, `app/api/gmail/status/route.ts`, `app/api/gmail/test/route.ts`
- lib: `lib/gmail.ts`, `lib/googleAuth.ts`, `lib/notifications/emailService.ts`

### `scadenze_bandi_template`
- browser: `components/ProgettiContent.tsx`

### `scadenze_bandi_template_scadenze`
- browser: `components/BandiContent.tsx`, `components/BandoForm.tsx`, `components/ProgettoForm.tsx`

### `scadenze_bandi_tipologie_scadenze`
- browser: `components/ScadenzaForm.tsx`

### `scadenze_bandi_uffici_dipartimenti`
- browser: `components/ReferentiManager.tsx`

### `scadenze_bandi_utenti`
- browser: `components/GroupsManagement.tsx`, `components/ScadenzaForm.tsx`, `components/UnifiedMultiResponsableSelector.tsx`, `components/UnifiedResponsableSelector.tsx`
- server-pubblico: `app/api/clienti/[id]/formazione/fabbisogno/[rilevazioneId]/send-email/route.ts`, `app/api/contracts/approve/route.ts`, `app/api/contracts/evolvi/generate/route.ts`, `app/api/contracts/evolvi/send-email/route.ts`, `app/api/interrogazioni/crea-scadenza/route.ts`, `app/api/interrogazioni/email-bulk/route.ts`
- server-admin: `app/api/admin/users/[id]/route.ts`, `app/api/admin/users/route.ts`, `app/api/auth/change-password/route.ts`, `app/api/auth/google-jwt/route.ts`, `app/api/auth/login/route.ts`, `app/api/auth/verify/route.ts`, `app/api/bandi-esterni/ingest-gmail/route.ts`, `app/api/calendar/token/route.ts`, `app/api/gmail/debug/route.ts`, `app/api/user/email-signature/route.ts`, `app/api/user/gmail/callback/route.ts`, `app/api/user/gmail/disconnect/route.ts`, `app/api/user/gmail/status/route.ts`
- lib: `lib/auth.ts`, `lib/gmail.ts`, `lib/jwtAuth.ts`

