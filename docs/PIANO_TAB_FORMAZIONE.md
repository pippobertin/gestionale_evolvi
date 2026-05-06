# Piano di sviluppo — Tab "Formazione" nella scheda cliente

> Documento da passare a Claude Code in VS Code come base per l'implementazione.
> Contesto: da qualche settimana BLM offre anche la gestione dei fondi interprofessionali per la formazione continua (FPI). Serve aggiungere alla scheda cliente un tab dedicato alla formazione che copra sia il perimetro FPI sia la formazione "privata" o obbligatoria, mantenendo coerenza con l'architettura esistente.

---

## 1. Obiettivo

Aggiungere un nuovo tab "Formazione" alla scheda cliente del gestionale Evolvi. Il tab deve permettere di:

- Registrare e storicizzare l'adesione del cliente a uno o più fondi paritetici interprofessionali.
- Gestire i piani formativi (FPI e privati) con il loro ciclo di vita.
- Tracciare corsi, edizioni, partecipanti, ore erogate.
- Monitorare le certificazioni obbligatorie (sicurezza, antincendio, primo soccorso, HACCP, dirigenti, preposti, RLS e simili) con alert sulle scadenze di rinnovo.
- Archiviare i documenti di formazione (registri presenze, attestati, verbali, rendicontazioni, fatture docenti, contratti con enti attuatori).
- Produrre una panoramica sintetica (ore annue erogate, partecipanti formati, piani in corso, certificazioni scadute o in scadenza, importi FPI richiesti/approvati/erogati).

Il tab deve riutilizzare per quanto possibile i pattern architetturali esistenti (modale fullscreen, sotto-componenti manager, Supabase client diretto per letture semplici, API route per upload e azioni specifiche) e integrarsi con il sistema scadenze/notifiche già in uso.

---

## 2. Contesto di dominio (FPI in pillole)

I fondi paritetici interprofessionali per la formazione continua sono enti di natura associativa, promossi dalle parti sociali, che finanziano piani formativi aziendali, pluriaziendali, settoriali o territoriali. Il meccanismo di finanziamento è lo 0,30% di contribuzione INPS (conto disoccupazione involontaria) che l'azienda aderente dirotta al fondo di competenza. Il fondo restituisce all'azienda queste risorse tramite due canali principali: Conto Formazione (accumulo aziendale, utilizzabile su propri piani) e Conto di Sistema/Avvisi (partecipazione a bandi competitivi).

Dati minimi che contano nel nostro gestionale: fondo di adesione, codice adesione, data adesione, CCNL applicato, matricola INPS dell'azienda, tipologia conto utilizzata, piani formativi attivi con stato e importi, scadenze di presentazione e rendicontazione, partecipanti formati con ruolo e qualifica.

Esistono anche corsi obbligatori (D.Lgs. 81/2008 per sicurezza e figure correlate, HACCP, privacy e GDPR, antiriciclaggio in alcuni settori) che non passano necessariamente da FPI ma vanno monitorati perché soggetti a scadenza di validità.

---

## 3. Posizionamento nell'interfaccia

Il nuovo tab si chiama **"Formazione"** (icona `GraduationCap` di lucide-react) e va inserito nella lista `baseTabs` di `ClienteDettaglio.tsx` subito dopo `doc_amministrativi`, quindi come ottavo tab base. L'id interno è `'formazione'`. Deve apparire per tutti i clienti, non solo EVOLVI: anche i clienti SPOT possono fare formazione.

All'interno del tab si apre una seconda barra di navigazione orizzontale (sotto-tab, stile secondario, più compatta del tab principale) con sei sezioni:

1. **Panoramica** — cruscotto sintetico del cliente sul tema formazione.
2. **Adesione FPI** — anagrafica del fondo di riferimento (o elenco storico se più adesioni).
3. **Piani Formativi** — CRUD dei piani, sia FPI sia privati.
4. **Corsi ed Edizioni** — singoli corsi erogati, anche fuori da un piano.
5. **Certificazioni Obbligatorie** — tracciamento adempimenti di legge con scadenze.
6. **Documenti Formazione** — archivio documentale specifico.

Una settima pagina potenziale, "Partecipanti", non merita un sotto-tab dedicato: l'elenco partecipanti è contestuale al singolo corso/edizione e va esposto dentro quella scheda. Avremo però una vista cumulativa "Partecipanti formati (ultimo anno)" dentro Panoramica.

### Rendering condizionale FPI

Se il cliente non ha ancora nessuna adesione registrata, tutti i sotto-tab tranne "Adesione FPI" mostrano un info box che dice "Nessuna adesione al fondo registrata. Si può comunque registrare formazione privata o corsi obbligatori". Le sezioni FPI-specifiche (dettagli piano con conto formazione, importi, rendicontazioni) restano disabilitate finché non viene creata un'adesione.

---

## 4. Schema dati proposto

Cinque nuove tabelle (più eventuale seed) seguendo il naming convention del progetto.

### 4.1 `scadenze_bandi_fondi_interprofessionali`

Tabella di anagrafica preseedata, modificabile solo da admin. Serve come lookup.

Colonne: `id UUID PRIMARY KEY`, `codice VARCHAR(30) UNIQUE` (es. FONDIMPRESA), `nome VARCHAR(200)`, `sigla VARCHAR(30)`, `settori_ccnl TEXT[]` (array di CCNL tipicamente associati), `url_area_riservata VARCHAR(500)`, `note TEXT`, `attivo BOOLEAN DEFAULT TRUE`, `created_at TIMESTAMPTZ`.

Seed iniziale (file `sql/seed_fondi_interprofessionali.sql`): Fondimpresa, Fondirigenti, FondER, For.Te., Fondartigianato, Fondoprofessioni, Fon.Coop, Fondo Banche Assicurazioni (FBA), Fondolavoro, Fonservizi, Fonditalia, Formazienda, Fondo Dirigenti PMI, FonARCom, Fonter.

### 4.2 `scadenze_bandi_clienti_adesioni_fpi`

Storico delle adesioni del cliente ai fondi. Un cliente può averne più di una nel tempo (cambi di fondo o adesioni multiple contemporanee per categorie diverse di lavoratori, es. dirigenti + operai).

Colonne principali: `id UUID PRIMARY KEY`, `cliente_id UUID FK ON DELETE CASCADE`, `fondo_id UUID FK scadenze_bandi_fondi_interprofessionali`, `codice_adesione VARCHAR(100)`, `data_adesione DATE`, `data_cessazione DATE` (null se attiva), `ccnl_applicato VARCHAR(200)`, `matricole_inps_associate TEXT[]`, `dipendenti_aderenti INTEGER`, `stato VARCHAR(30) DEFAULT 'ATTIVA'` (valori ATTIVA, CESSATA, SOSPESA), `note TEXT`, `created_at`, `updated_at`, `created_by UUID FK utenti`.

Indice: `(cliente_id, stato)` per query rapide sulle adesioni attive.

### 4.3 `scadenze_bandi_piani_formativi`

Cuore del modulo. Un piano può essere FPI (collegato a un'adesione) oppure privato (azienda finanzia internamente o un cliente paga BLM per erogare formazione a proprio personale).

Colonne: `id UUID PRIMARY KEY`, `cliente_id UUID FK ON DELETE CASCADE`, `adesione_fpi_id UUID FK NULL` (se NULL il piano è privato), `fondo_id UUID FK NULL` (ridondante ma utile per report), `codice_piano VARCHAR(100)`, `titolo VARCHAR(500) NOT NULL`, `descrizione TEXT`, `tipologia VARCHAR(50)` (AZIENDALE, PLURIAZIENDALE, SETTORIALE, TERRITORIALE, PRIVATO, OBBLIGATORIO), `canale_finanziamento VARCHAR(50)` (CONTO_FORMAZIONE, CONTO_SISTEMA, AVVISO, PRIVATO, NON_APPLICABILE), `avviso_riferimento VARCHAR(200)` (es. "Avviso 3/2024"), `stato VARCHAR(30)` (BOZZA, IN_PRESENTAZIONE, PRESENTATO, APPROVATO, IN_EROGAZIONE, CONCLUSO, RENDICONTATO, SALDATO, RESPINTO, ANNULLATO), `data_presentazione DATE`, `data_approvazione DATE`, `data_inizio_attivita DATE`, `data_fine_attivita DATE`, `data_scadenza_rendicontazione DATE`, `data_saldo DATE`, `importo_richiesto NUMERIC(15,2)`, `importo_approvato NUMERIC(15,2)`, `importo_erogato NUMERIC(15,2)`, `importo_saldato NUMERIC(15,2)`, `ore_previste INTEGER`, `ore_erogate INTEGER`, `num_partecipanti_previsti INTEGER`, `num_partecipanti_effettivi INTEGER`, `progetto_collegato_id UUID FK scadenze_bandi_progetti NULL` (se il piano nasce da un progetto gestionale), `bando_collegato_id UUID FK scadenze_bandi_bandi NULL`, `drive_folder_id VARCHAR(200)`, `drive_folder_url VARCHAR(500)`, `responsabile_piano JSONB` (array `{tipo, id, nome}` come già usato altrove per responsabili multipli), `note TEXT`, `created_at`, `updated_at`, `created_by`.

Indici: `(cliente_id, stato)`, `(fondo_id)`, `(data_scadenza_rendicontazione)`.

### 4.4 `scadenze_bandi_corsi_formativi`

Singolo corso o edizione. Un piano contiene N corsi; un corso può anche esistere standalone (tipicamente formazione obbligatoria).

Colonne: `id UUID PRIMARY KEY`, `cliente_id UUID FK ON DELETE CASCADE`, `piano_formativo_id UUID FK NULL`, `titolo VARCHAR(500)`, `area_tematica VARCHAR(200)` (es. Sicurezza, Gestionale, Linguistica, Digitale, Soft Skills), `modalita VARCHAR(50)` (AULA, ONLINE_SINCRONA, ONLINE_ASINCRONA, BLENDED, AFFIANCAMENTO), `ore_durata NUMERIC(5,1)`, `data_inizio DATE`, `data_fine DATE`, `sede VARCHAR(500)`, `ente_erogatore VARCHAR(300)`, `docente VARCHAR(300)`, `numero_partecipanti INTEGER`, `stato VARCHAR(30)` (PIANIFICATO, IN_CORSO, CONCLUSO, ANNULLATO), `attestato_rilasciato BOOLEAN DEFAULT FALSE`, `costo_totale NUMERIC(10,2)`, `note TEXT`, `created_at`, `updated_at`.

Indice: `(cliente_id, data_inizio DESC)`, `(piano_formativo_id)`.

### 4.5 `scadenze_bandi_partecipanti_formazione`

Elenco partecipanti per singolo corso. Il lookup sul cliente avviene via corso.

Colonne: `id UUID PRIMARY KEY`, `corso_id UUID FK ON DELETE CASCADE`, `cognome VARCHAR(100)`, `nome VARCHAR(100)`, `codice_fiscale VARCHAR(16)`, `qualifica VARCHAR(200)` (es. dirigente, quadro, impiegato, operaio, apprendista), `ruolo_sicurezza VARCHAR(100)` (RSPP, RLS, preposto, dirigente, lavoratore, addetto antincendio, addetto primo soccorso), `presente BOOLEAN DEFAULT TRUE`, `ore_frequentate NUMERIC(5,1)`, `esito VARCHAR(30)` (SUPERATO, NON_SUPERATO, NON_APPLICABILE), `note TEXT`, `created_at`.

Indice: `(corso_id)`, `(codice_fiscale)` per individuare la storia formativa di una persona.

### 4.6 `scadenze_bandi_certificazioni_obbligatorie`

Specifico per adempimenti di legge. Separato dai corsi perché la logica di scadenza e rinnovo è diversa e sono di solito ricorrenti.

Colonne: `id UUID PRIMARY KEY`, `cliente_id UUID FK ON DELETE CASCADE`, `tipo_obbligo VARCHAR(100)` (es. FORMAZIONE_LAVORATORI_RISCHIO_BASSO, RSPP, DIRIGENTI_SSL, PREPOSTI, RLS, ANTINCENDIO_MEDIO, PRIMO_SOCCORSO, HACCP, PRIVACY_GDPR, ANTIRICICLAGGIO, ALTRO), `normativa_riferimento VARCHAR(300)` (es. "D.Lgs. 81/08 art. 37"), `persona_nome VARCHAR(200)` (se riferita a singola persona, altrimenti azienda), `persona_codice_fiscale VARCHAR(16)`, `data_conseguimento DATE`, `data_scadenza DATE`, `validita_mesi INTEGER`, `stato VARCHAR(30)` (VALIDA, IN_SCADENZA, SCADUTA, DA_RINNOVARE), `corso_collegato_id UUID FK scadenze_bandi_corsi_formativi NULL`, `file_attestato_storage_path VARCHAR(500)`, `note TEXT`, `created_at`, `updated_at`.

Indici: `(cliente_id, data_scadenza)`, `(stato)`.

### 4.7 Integrazione con tabella scadenze

Per ogni piano formativo e per ogni certificazione obbligatoria, alla creazione/modifica viene creata (o aggiornata) una riga in `scadenze_bandi_scadenze_contrattuali` con `entity_type = FORMAZIONE`, `entity_id = id del piano o certificazione`, campo `tipo` configurabile (SCADENZA_PRESENTAZIONE, SCADENZA_RENDICONTAZIONE, RINNOVO_CERTIFICAZIONE), `giorni_notifica_prima = [60, 30, 15, 7, 1]` di default. Non reinventare ruote: riusa il modello esistente e il suo scheduler.

---

## 5. Componenti React da creare

Tutti dentro `frontend/src/components/`, pattern simile a `ReferentiManager` e `DocumentiAmministrativiManager` (stand-alone, ricevono `clienteId` come prop).

1. **`FormazioneManager.tsx`** — componente orchestratore del tab. Contiene la sotto-tab bar con i sei sotto-tab e fa render del sotto-componente corrispondente. Riceve `clienteId: string` e `cliente: Cliente` (per leggere `categoria_evolvi`, `matricola_inps`, ecc.).
2. **`FormazionePanoramica.tsx`** — cruscotto. Card con: ore formazione ultimi 12 mesi, partecipanti formati ultimi 12 mesi, numero piani attivi, prossime scadenze (max 5), certificazioni in scadenza entro 90 giorni, importi FPI richiesti/approvati/erogati.
3. **`AdesioneFpiManager.tsx`** — CRUD adesioni. Tabella con colonne Fondo, Codice, Data adesione, Stato, CCNL. Form modale per creare/modificare. Il dropdown Fondo popola da `scadenze_bandi_fondi_interprofessionali`.
4. **`PianiFormativiManager.tsx`** — CRUD piani. Lista filtrabile per stato e fondo. Click su riga apre modale dettaglio piano con sezioni Dati Generali, Importi, Date, Corsi collegati, Documenti.
5. **`CorsiFormativiManager.tsx`** — CRUD corsi. Include gestione partecipanti nel dettaglio corso (tab interno o drawer laterale).
6. **`CertificazioniObbligatorieManager.tsx`** — CRUD certificazioni con indicatori di stato, badge colorato per scadenza e pulsante rapido "Segna rinnovata" che crea automaticamente nuova certificazione con data scadenza ricalcolata.
7. **`DocumentiFormazioneManager.tsx`** — molto simile a `DocumentiAmministrativiManager` ma con `entity_type = FORMAZIONE` e categoria arricchita (REGISTRO_PRESENZE, ATTESTATO, VERBALE, RENDICONTAZIONE, FATTURA_DOCENTE, CONTRATTO_ENTE_ATTUATORE, ALTRO). Può riutilizzare il componente esistente parametrizzandolo, oppure crearne uno dedicato se la logica di metadati diverge troppo.

Per ridurre duplicazione, è possibile estrarre in `components/shared/` una utility `<SecondaryTabsBar />` per la sotto-navigazione interna al tab.

---

## 6. API routes da creare

Sotto `frontend/src/app/api/clienti/[id]/formazione/`:

- `adesioni/route.ts` con GET (lista) e POST (crea). `adesioni/[adesioneId]/route.ts` con PUT e DELETE.
- `piani/route.ts` e `piani/[pianoId]/route.ts` (stessa struttura).
- `corsi/route.ts` e `corsi/[corsoId]/route.ts`, più `corsi/[corsoId]/partecipanti/route.ts` per l'elenco nested.
- `certificazioni/route.ts` e `certificazioni/[certId]/route.ts`, più `certificazioni/[certId]/rinnova/route.ts` come shortcut POST che crea la nuova certificazione e chiude la vecchia.
- `documenti/route.ts` e `documenti/[docId]/route.ts` per l'upload/download.

Aggiungere inoltre in `frontend/src/app/api/formazione/`:

- `fondi/route.ts` GET elenco fondi interprofessionali (usato come lookup).
- `stats/route.ts` GET statistiche aggregate globali (per dashboard futura di BLM, non solo del singolo cliente).

Autenticazione: riusare il middleware JWT usato dalle altre route `/api/clienti/[id]/...`. Permessi: admin può tutto, collaboratore può CRUD solo sui clienti di cui è creatore (seguire lo schema `canEdit`/`canDelete` del contesto).

Per i piani formativi con `drive_folder_id`, alla creazione il backend crea automaticamente la cartella Drive `BANDI E PROGETTI > {anno} > FORMAZIONE > {Nome Cliente} > {Codice Piano}` con sottocartelle `PROGETTAZIONE`, `EROGAZIONE`, `PARTECIPANTI`, `RENDICONTAZIONE`. Riusare il modulo `lib/googleDrive.ts`.

---

## 7. Integrazioni con il resto del sistema

**Scadenze e notifiche.** Ogni volta che un piano cambia stato o date, un hook server-side (funzione helper `syncFormazioneScadenze(planId)` in `lib/formazione/syncScadenze.ts`) rigenera le righe in `scadenze_bandi_scadenze_contrattuali` collegate. Stesso meccanismo per le certificazioni: quando ne salvi una con `data_scadenza`, viene creato un record contrattuale con `giorni_notifica_prima = [90, 60, 30, 7]`.

**Drive.** Quando si carica un documento con categoria rendicontazione, il file viene salvato anche su Drive nella sottocartella corrispondente del piano.

**Reports.** Aggiungere a `ReportsContent.tsx` una nuova sezione "Formazione" con: ore totali erogate per periodo, importi FPI per fondo, tasso di completamento piani, certificazioni scadute/in regola per cliente, top 10 aziende clienti per volume formazione.

**Dashboard.** Nel widget principale della dashboard aggiungere un contatore "Piani FPI in rendicontazione" che apra la lista filtrata.

**Bandi e Progetti.** Un piano formativo che nasce da un avviso FPI può essere collegato opzionalmente a un bando esistente (campo `bando_collegato_id`) per mantenere la linea di business. Un progetto cliente può generare un piano formativo "figlio" (campo `progetto_collegato_id`).

---

## 8. Permessi

**Admin.** Accesso completo a tutte le operazioni CRUD su tutte le tabelle. Unica figura che può aggiungere/modificare/disattivare fondi nella tabella anagrafica `scadenze_bandi_fondi_interprofessionali`.

**Collaboratore.** Può creare e modificare adesioni, piani, corsi, partecipanti e certificazioni sui clienti a cui è assegnato o di cui è creatore. Può caricare documenti. Non può eliminare piani/corsi creati da altri senza passare da admin.

Seguire le funzioni `canEdit(createdBy)` e `canDelete(createdBy)` già presenti in `AuthContext`.

---

## 9. Validazioni e regole di business

Un'adesione FPI non può avere `data_cessazione` precedente a `data_adesione`. Lo stato `ATTIVA` richiede `data_cessazione` nulla.

Un piano formativo FPI (tipologia diversa da PRIVATO e OBBLIGATORIO) deve avere un `adesione_fpi_id` valido e coerente col `fondo_id`.

Le transizioni di stato del piano seguono un automa: BOZZA può andare in IN_PRESENTAZIONE o ANNULLATO; IN_PRESENTAZIONE in PRESENTATO; PRESENTATO in APPROVATO o RESPINTO; APPROVATO in IN_EROGAZIONE; IN_EROGAZIONE in CONCLUSO; CONCLUSO in RENDICONTATO; RENDICONTATO in SALDATO. Il cambio stato richiede conferma esplicita e, per alcuni passaggi, la presenza di campi valorizzati (es. per passare a APPROVATO serve `data_approvazione` e `importo_approvato`).

Una certificazione obbligatoria con `data_scadenza` nel passato passa automaticamente a stato SCADUTA; tra i 90 e 0 giorni alla scadenza è IN_SCADENZA; oltre è VALIDA. Il calcolo può avvenire via trigger PostgreSQL oppure lato applicazione al momento della lettura.

Le ore erogate di un piano non possono superare le ore previste di oltre il 20% senza flag di alert.

---

## 10. Specifiche UI dettagliate

### Panoramica

Griglia 2x2 di card KPI (ore formazione 12 mesi, partecipanti 12 mesi, piani attivi, importo FPI erogato). Sotto, due colonne: "Prossime scadenze formazione" (lista di massimo 5 record ordinata per data crescente con badge colorato) e "Certificazioni in scadenza" (entro 90 giorni). In fondo, grafico a barre orizzontali "Ore per area tematica ultimi 12 mesi" (usare `recharts` già presente nelle dipendenze del progetto).

### Adesione FPI

Titolo "Adesioni ai fondi interprofessionali" con pulsante "+ Nuova adesione". Tabella con colonne Fondo (logo/sigla + nome), Codice adesione, Data adesione, CCNL, Dipendenti aderenti, Stato (badge colorato: verde ATTIVA, grigio CESSATA, arancio SOSPESA), Azioni. Click su riga apre modal dettaglio con tutti i campi e storico modifiche.

Se non esiste nessuna adesione, mostrare empty state con icona `Award`, frase "Nessuna adesione registrata" e CTA "Registra la prima adesione".

### Piani Formativi

In alto, toolbar con filtri Stato (dropdown multi-select), Fondo (dropdown), Canale di finanziamento, anno. Pulsante "+ Nuovo piano". Tabella con colonne: Codice, Titolo, Fondo, Canale, Stato, Date (inizio-fine), Importo approvato, Ore previste/erogate, Responsabile, Azioni.

Dettaglio piano in modale full-screen a sua volta (o drawer laterale 70% larghezza) con sotto-tab interni: Dati Generali, Importi e Finanziamento, Date e Scadenze, Corsi collegati (lista nested con pulsante "+ Corso"), Partecipanti (aggregati da corsi), Documenti, Timeline modifiche di stato.

### Corsi ed Edizioni

Lista con filtri Area tematica, Modalità, Stato, Piano di appartenenza. Ogni riga mostra titolo, date, ente, ore, partecipanti (X/Y se era previsto numero diverso). Dettaglio corso in modale con tab Dati, Partecipanti (lista modificabile inline), Documenti, Attestati.

### Certificazioni Obbligatorie

Tabella con colorazione riga: rosso scaduta, arancio in scadenza entro 30 giorni, giallo in scadenza entro 90, verde valida. Colonne: Tipo obbligo, Persona (o "Azienda"), Data conseguimento, Data scadenza, Giorni rimanenti, Stato, Azioni (Rinnova, Modifica, Allegato, Elimina).

Pulsante "Rinnova" apre mini-modale precompilato (nuova data_conseguimento = oggi, nuova data_scadenza = oggi + `validita_mesi` del tipo_obbligo). Conferma e viene salvata la nuova certificazione, la vecchia finisce in stato DA_RINNOVARE → VALIDA → SCADUTA secondo la nuova logica.

### Documenti Formazione

Identico pattern al DocumentiAmministrativiManager, con tipi documento specifici: Registro presenze, Attestato, Verbale/Report, Rendicontazione, Fattura docente, Contratto ente attuatore, Materiale didattico, Altro. Raggruppamento per piano se il documento è collegato a piano, altrimenti per tipo.

---

## 11. Istruzioni operative per Claude Code

### INIZIO PROMPT DA CONSEGNARE

Sei un ingegnere senior Next.js e Postgres. Lavoriamo nel progetto "Gestionale Evolvi" (cartella `gestionale_evolvi/`). Devi implementare un nuovo tab "Formazione" nella scheda cliente secondo le specifiche del documento `docs/PIANO_TAB_FORMAZIONE.md`. Leggilo integralmente prima di iniziare.

Prima di scrivere codice leggi anche: `frontend/src/components/ClienteDettaglio.tsx`, `frontend/src/components/ClienteForm.tsx`, `frontend/src/components/DocumentiAmministrativiManager.tsx`, `frontend/src/components/ReferentiManager.tsx` e `frontend/src/components/ContrattiEvolviManager.tsx` per assimilare i pattern esistenti.

Procedi in questo ordine, con un commit per ogni passo:

1. **Schema database.** Crea in `sql/formazione/` i file `001_create_fondi_interprofessionali.sql`, `002_create_adesioni_fpi.sql`, `003_create_piani_formativi.sql`, `004_create_corsi_formativi.sql`, `005_create_partecipanti_formazione.sql`, `006_create_certificazioni_obbligatorie.sql`, `007_seed_fondi_interprofessionali.sql`. Ogni file deve essere idempotente (IF NOT EXISTS). Aggiungi i commenti sui campi.

2. **Helper di sincronizzazione scadenze.** Crea `frontend/src/lib/formazione/syncScadenze.ts` con funzioni `syncPianoScadenze(pianoId)` e `syncCertificazioneScadenza(certId)` che creano/aggiornano record in `scadenze_bandi_scadenze_contrattuali` con `entity_type = 'FORMAZIONE'`.

3. **API routes.** Implementa tutte le route elencate al paragrafo 6 del piano. Usa JWT come le altre route clienti. Struttura risposte `{success, data, error}`. Usa transazioni Supabase dove una creazione implica più insert (es. piano + scadenze collegate).

4. **Lookup fondi.** Crea `frontend/src/app/api/formazione/fondi/route.ts` e un hook `useFondi()` in `frontend/src/hooks/useFondi.ts` con caching in memoria (non serve SWR se la lista è breve e cambia poco).

5. **Componente FormazioneManager e sotto-componenti.** Crea i sette componenti elencati al paragrafo 5. Dividi in file separati nella stessa cartella `frontend/src/components/formazione/`. Estrai `SecondaryTabsBar.tsx` in `components/shared/`.

6. **Integrazione in ClienteDettaglio.** Aggiungi il tab `'formazione'` in `baseTabs`, con icona `GraduationCap`, etichetta `Formazione`. Nel renderer aggiungi il case che restituisce `<FormazioneManager clienteId={cliente.id} cliente={cliente} />`.

7. **Integrazione Reports.** Aggiungi in `ReportsContent.tsx` un nuovo tab "Formazione" con i report descritti al paragrafo 7 del piano.

8. **Documentazione.** Aggiorna `docs/chatbot/FAQ_GESTIONALE_EVOLVI.md` aggiungendo una nuova sezione 18-bis "Formazione e Fondi Interprofessionali" (mantieni numerazione progressiva se preferisci, aggiornando l'indice). Segui lo stile discorsivo delle altre sezioni.

9. **Test manuali.** Fornisci in `docs/chatbot/TEST_TAB_FORMAZIONE.md` una lista di scenari di test manuale da eseguire (apertura tab, creazione adesione, creazione piano FPI, collegamento corso a piano, rinnovo certificazione, verifica che le scadenze appaiano nello scadenzario, verifica permessi admin vs collaboratore).

Regole generali:
- TypeScript stretto, niente `any`.
- Stile coerente con il resto del codebase (Tailwind, lucide-react, componenti esistenti).
- Niente nuove dipendenze senza giustificarle.
- Per la validazione delle transizioni di stato del piano usa una funzione pura in `lib/formazione/pianoStateMachine.ts` con test unitari.
- Commenti solo dove il perché non è ovvio dal codice.
- Log di errore centralizzati, non console.log sparsi.

Quando hai finito, riassumi cosa è stato creato e quali migrazioni SQL vanno eseguite in quale ordine.

### FINE PROMPT DA CONSEGNARE

---

## 12. Dopo l'implementazione

Lato database, esegui in ordine i file SQL nella cartella `sql/formazione/` con il seed dei fondi al termine.

Lato applicazione, in produzione su Vercel assicurati che le nuove variabili d'ambiente eventualmente introdotte (nessuna prevista se si resta su Supabase standard) siano configurate.

Lato knowledge base del chatbot, dopo l'aggiornamento di `FAQ_GESTIONALE_EVOLVI.md` serve un redeploy perché il file è letto all'avvio del server. Nessun reindex se usi caching sulla stringa, solo reset della cache Anthropic (avviene naturalmente allo scadere del TTL).

Lato formazione dei colleghi, prepara una breve guida operativa con due o tre casi d'uso ricorrenti: "registrare la prima adesione FPI", "creare un piano da Avviso 3/2024", "rinnovare la certificazione antincendio di un preposto".

## 13. Evoluzioni future

Integrazione diretta con le aree riservate dei fondi (alcuni espongono API REST per la rendicontazione, altri no). Modulo di generazione automatica del fascicolo piano (pdf consolidato dei documenti caricati). Rendicontazione economica con riconciliazione fatture docenti e compensi e comparazione con l'importo erogato dal fondo. Cruscotto cliente esterno (portale) dove l'azienda cliente può consultare in autonomia lo stato dei propri piani formativi.
