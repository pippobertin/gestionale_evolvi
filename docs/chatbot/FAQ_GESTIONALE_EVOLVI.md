# FAQ Gestionale Evolvi — Knowledge base per chatbot interno

> Documento sorgente per il chatbot di assistenza interna destinato ai colleghi BLM.
> Scopo: rispondere a domande del tipo "come faccio a...?", "dove trovo...?", "come funziona...?".
> Pubblico: collaboratori e amministratori del gestionale, nessuna competenza tecnica richiesta.
> Manutenzione: aggiornare questa knowledge base ogni volta che cambia l'interfaccia o vengono aggiunte funzionalità.

---

## INDICE

1. Introduzione e architettura generale
2. Login, password e sessioni
3. Ruoli, permessi, gestione utenti
4. Navigazione, sidebar, TopBar, Dashboard
5. Clienti
6. Prospect
7. Bandi
8. Progetti
9. Scadenze di progetto, calendario, scadenzario
10. Scadenze contrattuali
11. Sistema notifiche email, destinatari aggiuntivi, scheduler
12. Contratti generici e Contratti Evolvi
13. Fatturazione Evolvi e billing ricorrente
14. Centro Email / Gmail
15. Firma email e logo aziendale
16. Google Drive, cartelle progetti, documenti
17. Documenti amministrativi cliente
18. Reports e analytics
19. Impostazioni di sistema (admin)
20. Troubleshooting rapido
21. Glossario

---

## 1. INTRODUZIONE E ARCHITETTURA GENERALE

### Che cos'è il Gestionale Evolvi
Applicazione web interna di BLM per gestire bandi pubblici, progetti, clienti, scadenze, contratti Evolvi e fatturazione ricorrente. Integra Gmail, Google Drive e Google Calendar per la parte comunicativa e documentale.

### Stack tecnologico
Frontend: Next.js 16 con TypeScript, Tailwind CSS, componenti React modulari. Backend: API routes Next.js su Node. Database e storage: Supabase (PostgreSQL). Autenticazione: email/password con JWT (7 giorni) oppure Google OAuth. Integrazioni: Gmail API, Drive API, Google Calendar API.

### Struttura dati principale
Tabelle chiave nel database Supabase: `scadenze_bandi_utenti`, `scadenze_bandi_gruppi_utenti`, `scadenze_bandi_clienti`, `scadenze_bandi_prospect`, `scadenze_bandi_prospect_history`, `scadenze_bandi_bandi`, `scadenze_bandi_progetti`, `scadenze_bandi_scadenze`, `scadenze_bandi_scadenze_contrattuali`, `scadenze_bandi_template_scadenze`, `scadenze_bandi_contratti_evolvi`, `scadenze_bandi_fatture_evolvi`, `scadenze_bandi_documenti_amministrativi`, `scadenze_bandi_documenti_progetto`, `scadenze_bandi_additional_recipients`, `scadenze_bandi_system_settings`.

### Sezioni del menu laterale
Dashboard, Scadenzario, Prospect, Clienti, Bandi, Progetti, Email (Centro Gmail), Consulenti (in sviluppo), Reports, Impostazioni. Scadenze contrattuali e Fatturazione Evolvi sono accessibili come sottosezioni o widget dipendentemente dal flusso.

---

## 2. LOGIN, PASSWORD E SESSIONI

### Come accedo al gestionale
Apri l'URL del gestionale e inserisci email e password nella schermata di login. In alternativa clicca "Accedi con Google" per usare il tuo account Google aziendale.

### Primo accesso: mi viene chiesto di cambiare la password
È il comportamento previsto. Quando un amministratore crea un nuovo utente viene generata una password temporanea, per convenzione pari al cognome in minuscolo seguito da "!". Al primo login il sistema ti obbliga a impostare una nuova password di almeno 8 caratteri, da digitare identica in entrambi i campi. Solo dopo il cambio la dashboard diventa accessibile.

### Ho dimenticato la password, come la recupero
Il gestionale non ha un flusso di auto-recupero via email. Devi chiedere a un amministratore di resettarla: l'admin apre Impostazioni > Gestione Utenti, trova il tuo profilo, clicca sui tre puntini e sceglie "Resetta Password". Il sistema genera una nuova password temporanea che l'admin ti comunica. Al successivo login il sistema ti obbliga di nuovo a cambiarla.

### Come funziona l'accesso con Google
Clicca "Accedi con Google" dalla pagina di login. Seleziona l'account Google desiderato e autorizza i permessi (profilo, Gmail, Drive, Calendar). Se non esistevi già nel gestionale, il sistema crea automaticamente un utente con ruolo "collaboratore" usando il tuo nome Google. Se esistevi, recupera il profilo esistente tramite l'email. Dopo l'OAuth il sistema genera comunque un token JWT (necessario per le API interne).

### Quanto dura la sessione
Il token JWT dura 7 giorni. Alla scadenza ti viene chiesto di rifare il login. Il token è salvato in localStorage: se svuoti i dati del browser dovrai rifare l'accesso.

### Come faccio logout
Clicca sul tuo avatar in alto a destra nella TopBar e seleziona "Logout". Il sistema invalida il token e ti riporta alla pagina di login. Se eri autenticato con Google viene fatto anche il signOut lato NextAuth.

### Dopo il logout restano dati sensibili
No. Il token viene rimosso da localStorage e lo stato utente in memoria viene azzerato. Le eventuali pendenze di cambio password vengono cancellate dal sessionStorage.

---

## 3. RUOLI, PERMESSI, GESTIONE UTENTI

### Quali ruoli esistono
Due livelli: "admin" e "collaboratore". Il campo effettivo nel database è `livello_permessi`.

### Cosa può fare un collaboratore
Accede a Dashboard, Scadenzario, Prospect, Clienti, Bandi, Progetti, Email, Reports. Può creare e modificare i record che gli competono. In Impostazioni vede soltanto la sezione "Il Mio Gmail" per collegare il proprio account e impostare la firma email, più le preferenze di notifica personali.

### Cosa può fare un admin
Tutto ciò che fa un collaboratore, in più: creare/modificare/eliminare utenti, cambiare i ruoli, resettare le password, gestire gruppi utenti (in sviluppo), configurare Gmail e Drive di sistema, avviare/fermare lo scheduler notifiche, accedere ai pannelli di debug e migrazione database.

### Come divento admin
Non puoi auto-promuoverti. Deve farlo un admin esistente da Impostazioni > Gestione Utenti cliccando l'icona dello scudo accanto al tuo utente oppure, dal menu tre puntini, scegliendo "Cambia ruolo".

### Come creo un nuovo utente (admin)
Impostazioni > Gestione Utenti > pulsante "Aggiungi Utente". Compila Nome, Cognome, Email e seleziona Ruolo. Al salvataggio compare un popup con la password temporanea (cognome in minuscolo più "!"), da comunicare manualmente al nuovo utente.

### Come disabilito o elimino un utente
In Gestione Utenti, dal menu tre puntini della riga utente puoi scegliere "Disattiva/Attiva" (reversibile) oppure "Elimina" (irreversibile, richiede conferma). Un utente disattivato non può più accedere.

### Gruppi utenti
Esiste una sezione Impostazioni > Gruppi Utenti pensata per aggregare i collaboratori in team (es. Team Progetti, Team Marketing) con un colore identificativo. La gestione è presente nel database (`scadenze_bandi_gruppi_utenti`) e i gruppi vengono già usati come destinatari dei campi "responsabile" multipli; la UI di amministrazione è in fase di completamento.

### Chi può modificare cosa
Le funzioni `canEdit` e `canDelete` del contesto autenticazione permettono a un collaboratore di modificare/cancellare soltanto i record di cui è creatore (campo `created_by`). Gli admin possono modificare qualsiasi record, compresi quelli creati da altri utenti.

---

## 4. NAVIGAZIONE, SIDEBAR, TOPBAR, DASHBOARD

### Come funziona la sidebar
La sidebar di sinistra contiene le voci del menu principale (Dashboard, Scadenzario, Prospect, Clienti, Bandi, Progetti, Email, Consulenti, Reports, Impostazioni). Può essere espansa o compressa.

### Espandere, comprimere, appuntare la sidebar
Quando è espansa vedi in alto a destra due pulsanti: la puntina (Pin/PinOff) blocca la sidebar in modalità espansa; la freccia sinistra la comprime a sola icona. Quando è compressa passando il mouse sopra la sidebar si riespande temporaneamente; la freccia destra a scomparsa sul bordo la riappunta.

### Cosa trovo nella TopBar
Titolo della pagina corrente, breadcrumb, barra di ricerca globale (in sviluppo), indicatore di connessione a Google Drive, icona notifiche non lette, icona email non lette con contatore blu, avatar utente con menu "Profilo utente", "Impostazioni", "Logout".

### Cosa mostra la Dashboard
Quattro widget KPI in alto: Scadenze Urgenti (rosse), Scadenze Imminenti entro 7 giorni (arancioni), Scadenze Completate (verdi con percentuale), Totale Scadenze (blu). Sotto la tabella "Scadenze Prioritarie" (prime 20 per urgenza), la panoramica con i contatori di Progetti, Clienti, Bandi, In Corso, Da iniziare, le azioni rapide di navigazione e un calendario di tre mesi navigabile. Se attiva, viene mostrata anche la sezione Fatturazione Evolvi con totale fatturato, incassato, da incassare e scaduto.

### Codice colore delle scadenze
Rosso: scadenza oggi o scaduta, intervento immediato. Arancione: scadenza entro 7 giorni, da pianificare. Verde: completata. Blu: normale, oltre i 7 giorni.

### Cliccare sui numeri della dashboard
Quasi tutti i numeri dei widget e della panoramica sono cliccabili: portano direttamente alla sezione corrispondente già filtrata. Esempio: cliccando "Progetti attivi" vieni portato alla sezione Progetti con il filtro applicato.

### Come aggiorno i dati
In alto a destra della Dashboard c'è il pulsante "Aggiorna" (icona refresh) che rilegge tutti i dati. Il rendering viene comunque rinfrescato ad ogni cambio pagina.

### Dashboard personalizzabile
Al momento no: widget, ordine e numero di colonne sono fissi. È in roadmap una futura personalizzazione con drag and drop.

---

## 5. CLIENTI

### Dove trovo i clienti
Menu laterale > Clienti. La tabella mostra Denominazione, P.IVA, sede, email, dimensione europea, numero dipendenti, categoria Evolvi, scadenza Evolvi, numero progetti (cliccabile per filtrare i progetti di quel cliente).

### Come cerco un cliente
Nella toolbar in alto c'è una barra di ricerca libera che filtra per denominazione, P.IVA, email e numero azienda. A sinistra è presente la navigazione alfabetica A-Z per saltare direttamente ai clienti con quella iniziale.

### Filtri disponibili
Pulsante "Filtri" apre un pannello con due dropdown: dimensione aziendale (MICRO, PICCOLA, MEDIA, GRANDE) e categoria (EVOLVI oppure CLIENTE_SPOT).

### Come creo un nuovo cliente
Pulsante "+ Nuovo" in alto a destra. Si apre il form ClienteForm con tutti i campi: denominazione (obbligatoria), P.IVA, Codice Fiscale, ATECO, Data Costituzione, RUNTS, contatti (email, PEC, telefono, sito), dati fatturazione (indirizzo, CAP, città, provincia, stato), SDI, IBAN, BIC, dati legale rappresentante, dati dimensionamento (ULA, Ultimo Fatturato, Attivo di Bilancio, dipendenti, volontari, collaboratori esterni), categoria Evolvi e scadenza. Solo la denominazione è veramente obbligatoria; gli altri campi sono caldamente consigliati.

### Come viene calcolata la dimensione europea
Automaticamente seguendo la raccomandazione UE 2003/361/CE. Sulla base di ULA, ultimo fatturato e attivo di bilancio il sistema classifica l'azienda in MICRO, PICCOLA, MEDIA o GRANDE. Se sono presenti aziende collegate o associate, la dimensione viene ricalcolata aggregando proporzionalmente i dati.

### Aziende collegate e associate: come funzionano
Dal dettaglio cliente, sezione "Aziende Collegate", clicca "+ Aggiungi Collegamento". Scegli il tipo (COLLEGATA se partecipazione tra 25 e 49,99 percento, ASSOCIATA se maggiore o uguale al 50 percento), seleziona l'azienda dal dropdown oppure crea al volo una nuova azienda collegata, inserisci percentuale di partecipazione, diritti di voto ed eventuale influenza dominante. Alla conferma la dimensione aggregata viene ricalcolata.

### Creare al volo un'azienda collegata
Nel modal "Nuovo Collegamento Aziendale" clicca "+ Nuova azienda collegata". Basta la denominazione per crearla; puoi aggiungere P.IVA, ULA, fatturato e attivo, e la dimensione viene calcolata automaticamente. L'azienda viene salvata e selezionata nel collegamento.

### Importare clienti da CSV
Pulsante "CSV" in toolbar. Sono disponibili due modalità: import semplice (mapping automatico da tracciato "Accounts") con anteprima delle prime 5 righe; import avanzato con mappatura manuale colonna-per-colonna dove puoi anche scaricare il mapping come JSON per riutilizzarlo successivamente. Il sistema deduplica per stessa denominazione o stessa P.IVA.

### Differenza tra EVOLVI e CLIENTE_SPOT
EVOLVI identifica un cliente con abbonamento attivo al servizio Evolvi (accesso piattaforma, supporto dedicato, fatturazione ricorrente). CLIENTE_SPOT è occasionale, senza abbonamento, legato a progetti singoli. La categoria condiziona la disponibilità di alcune funzionalità contrattuali.

### Cosa succede se elimino un cliente
L'eliminazione è in cascata: prima vengono cancellati i progetti collegati, poi le scadenze di quei progetti, infine il cliente. È un'azione potenzialmente distruttiva: il sistema chiede una conferma singola finale.

### Come aggiungo un referente a un cliente
Dettaglio cliente, sezione "Referenti Aziendali", pulsante "+ Aggiungi Referente". Sono obbligatori nome e cognome; email, telefono e note sono opzionali. Ogni referente ha i pulsanti "Modifica" e "Elimina".

### Come gestisco i documenti amministrativi di un cliente
Vedi la sezione 17 di questa FAQ. In sintesi: nel dettaglio cliente trovi la sezione "Documenti Amministrativi" dove puoi caricare Visura Camerale, DURC, Atto Costitutivo, Statuto, Bilancio, documenti di identità, certificati, e altri documenti raggruppati per categoria.

### Come vedo tutti i progetti di un cliente
Dal dettaglio cliente oppure cliccando la colonna "Prog." nella tabella Clienti: il click porta alla sezione Progetti con filtro cliente già applicato.

---

## 6. PROSPECT

### Che cos'è un prospect
Un'azienda potenzialmente interessata ai servizi BLM, non ancora cliente. I prospect hanno un workflow di stati che serve a qualificarli prima di trasformarli in clienti veri e propri.

### Dove li trovo
Menu laterale > Prospect. In alto vedi sette card statistiche (Attivi, Bozza, Qualificati, In Carico, Convertiti, Congelati, Archiviati) e sotto la tabella con ricerca, filtro fonte acquisizione, pill buttons per lo stato e tabella con denominazione, stato, area di interesse, contatti, fonte, profiling score e responsabile assegnato.

### Come creo un nuovo prospect
Pulsante "+ Nuovo Prospect". Si apre il form PrequalificaForm con sezioni dati anagrafici, legale rappresentante, prequalificazione (tipologia soggetto obbligatoria fra PROFIT / NON_PROFIT / ENTE_PUBBLICO / SCUOLA, area interesse, natura, bisogno dichiarato e interpretato, affidabilità, potenziale economico, budget, tempi di decisione, raccomandazione) e fonte acquisizione (obbligatoria) con assegnazione a un operatore. Sono obbligatori denominazione, tipologia soggetto e fonte.

### Stati possibili del prospect
BOZZA (appena creato), QUALIFICATO (prequalifica confermata), IN_DECISIONE (in valutazione), PRESO_IN_CARICO (in trattativa), CONVERTITO (trasformato in cliente, stato terminale), CONGELATO (sospeso temporaneamente), ARCHIVIATO (scartato, stato terminale). Da ogni stato attivo puoi passare a CONGELATO o ARCHIVIATO; dallo stato CONGELATO il sistema ripristina automaticamente lo stato precedente alla data di scongelamento.

### Come qualifico un prospect
Dettaglio prospect in stato BOZZA, tab Prequalifica, compila eventualmente il Profiling (template di domande con punteggio e peso per categoria), il sistema calcola un profiling score da 0 a 100 percento, poi clicca "Qualifica Prospect". Lo stato passa a QUALIFICATO.

### Come congelo un prospect
Dettaglio prospect, pulsante "Congela". Si apre un dialog con scelta durata preimpostata (15, 30, 60, 90 giorni) oppure data personalizzata. Inserisci il motivo del congelamento. Alla conferma lo stato passa a CONGELATO e viene mostrata la data di scongelamento automatico. Al prossimo caricamento della lista prospect, quelli con data di scongelamento raggiunta vengono automaticamente ripristinati allo stato precedente (thaw-check).

### Come archivio un prospect
Dettaglio prospect, pulsante "Archivia", scegli il motivo di archiviazione. Lo stato passa a ARCHIVIATO. Per impostazione predefinita gli archiviati non sono mostrati nella lista: devi cliccare il pill "Archiviato" per vederli.

### Come converto un prospect in cliente
Apri un prospect in stato PRESO_IN_CARICO e clicca "Converti a Cliente". Si apre un wizard in tre step. Step 1: scegli tra EVOLVI (abbonamento piattaforma) e SPOT (cliente occasionale). Step 2: verifica l'anteprima dei dati che verranno trasferiti al nuovo cliente. Step 3: conferma conversione completata. Il sistema crea il record cliente, collega il prospect al cliente tramite `cliente_id`, imposta la data di conversione e marca il prospect come CONVERTITO.

### Profiling score
È il punteggio di qualificazione calcolato dal template di domande dinamiche. Più alto il punteggio, più il prospect è qualificato. Visualizzato come percentuale nella colonna "Score" della tabella.

### Fonti di acquisizione previste
Telefonata, Email inbound, Referral, Evento, Web, LinkedIn, Altro. Il filtro fonte permette di concentrare l'analisi su un singolo canale.

---

## 7. BANDI

### Cos'è un bando nel gestionale
Un bando pubblico o privato che BLM tiene monitorato e a cui concorre. Ogni bando ha dati anagrafici, date chiave (pubblicazione, apertura e chiusura presentazione), contributi previsti, responsabile/i, eventuali progetti derivati, documenti allegati e un template di scadenze ricorrenti applicabile a tutti i progetti che nascono da quel bando.

### Come visualizzo i bandi
Menu > Bandi. In alto ci sono quattro box statistici: Aperti (verde), In arrivo (ciano), Scaduti (ambra), Progetti attivi (rosso). Sotto trovi filtri testuali e dropdown (Stato: tutti/solo aperti/prossima apertura/in valutazione/chiusi; Tipologia: popolata dinamicamente) e la tabella con Bando, Ente, Scadenze, Contributo, Stato, Progetti, Azioni.

### Come creo un nuovo bando
Pulsante "Nuovo Bando". Compila Codice Bando, Nome Bando, Ente Erogatore, Tipologia, Data Pubblicazione, Data Apertura e Data Chiusura Presentazione, Contributo Massimo in euro, Percentuale Contributo. Nel tab "Template Scadenze" definisci le tappe standard (accettazione, avvio, SAL, chiusura, rendicontazione) con formule giorni dopo rispetto a un evento base o a una scadenza precedente. Nel tab "Documenti" carichi gli allegati del bando. Al salvataggio il sistema crea automaticamente la cartella Google Drive dentro "Drive Condivisi > Gestionale Evolvi > BANDI E PROGETTI > {anno} > {Nome Bando}".

### Stati del bando
Il sistema calcola automaticamente uno stato "di sistema" in base alle date: IN_ARRIVO se oggi è precedente alla data di apertura, APERTO se siamo nel periodo di presentazione, SCADUTO se siamo dopo la chiusura. Esiste inoltre uno stato manuale (`stato_bando`) con valori APERTO, PROSSIMA_APERTURA, IN_VALUTAZIONE, CHIUSO utilizzabile per classificare gli esiti.

### Contributo massimo vs contributo ottenuto
Il "Contributo Massimo" è l'importo teoricamente disponibile per il bando. Il "Contributo Ottenuto" (a livello di progetto) registra quanto effettivamente assegnato al termine della valutazione. La differenza è utile per i report di benchmarking e performance.

### Come assegno un responsabile a un bando
Modifica del bando, tab "Impostazioni avanzate", campo "Referente Bando". Il selettore UnifiedResponsableSelector permette di scegliere un singolo utente, un gruppo di utenti identificato da colore, oppure "Tutti gli utenti". Il responsabile riceverà le notifiche legate al bando e alle sue scadenze.

### Come gestisco più responsabili
Il selettore UnifiedMultiResponsableSelector (usato soprattutto in Progetti e Scadenze) permette di selezionare molteplici utenti e/o gruppi, che vengono visualizzati come chip con possibilità di rimozione.

### Come trasformo un bando vinto in progetto
Nella tabella Bandi, sulla riga del bando vinto, clicca l'icona del razzetto "Crea progetto da bando". Si apre il form ProgettoForm pre-compilato con il riferimento al bando e al contributo richiesto. Selezioni il cliente, dai un nome al progetto, verifichi le scadenze ereditate dal template e salvi. Il sistema crea a cascata la struttura Google Drive (sottocartelle ALLEGATI, DOC AMM, CONTRATTI) e copia gli allegati del bando nella cartella ALLEGATI del progetto.

### Dove vedo i bandi aperti
Nella sezione Bandi usa il filtro Stato e seleziona "Solo aperti", oppure guarda direttamente il box "Aperti" in alto che conta e permette di filtrare con un click. I bandi sono ordinati per data di chiusura crescente, così quelli più urgenti restano in cima.

### Eliminazione di un bando
L'azione è distruttiva: vengono eliminati in cascata tutti i progetti collegati, con le relative scadenze e cartelle Drive. Richiede conferma esplicita. Ha senso solo per bandi creati per errore o mai utilizzati.

### Cambio stato di più bandi in massa
Il pulsante "Seleziona" attiva la modalità selezione multipla per eliminazione di gruppo; il cambio stato avviene tipicamente dalla modifica del singolo bando.

---

## 8. PROGETTI

### Cos'è un progetto
Un'iniziativa specifica di un cliente collegata (in genere) a un bando vinto. Ha un nome, un cliente, un bando di riferimento, contributo richiesto e ottenuto, scadenze ereditate dal template del bando, documenti allegati e una struttura dedicata di cartelle su Google Drive.

### Dove trovo i progetti
Menu > Progetti. La sezione offre tab separati per le informazioni generali, importi e contributi, scadenze, documenti, impostazioni avanzate.

### Come creo un progetto nuovo
In genere si crea dalla sezione Bandi cliccando l'icona razzetto sulla riga del bando vinto. In alternativa dal menu Progetti con un pulsante "Nuovo progetto": in questo caso dovrai selezionare manualmente il bando di origine e il cliente.

### Importi e contributi
Nel tab "Importi e Contributi" inserisci il contributo_richiesto (preimpostato dal contributo massimo del bando) e, a lavori conclusi, il contributo_ottenuto. Lo scostamento viene calcolato automaticamente e compare nei report.

### Scadenze ereditate dal template
Al momento della creazione del progetto il sistema legge il template scadenze del bando e genera per ciascuna tappa una scadenza specifica del progetto, calcolando la data effettiva in base alla formula ("Evento Base + N giorni" oppure "Scadenza X + N giorni"). Le date pre-compilate possono essere sovrascritte manualmente; le scadenze successive non vengono più ricalcolate automaticamente se ne modifichi una.

### Documenti di progetto
Nel tab "Documenti" del form trovi:
- Gli "Allegati bando" automaticamente copiati dalla cartella ALLEGATI del bando.
- I "Documenti amministrativi" del progetto che puoi caricare direttamente via upload (Supabase Storage) con categoria (VISURA, BILANCI, ULA, CONTRATTI, DSAN, ALTRO).
- Il componente DocumentiProgettoPreview che mostra i file con stato di sincronizzazione Drive e permette anteprima, apertura in Drive, download e verifica modifiche.

### Struttura cartelle Drive di un progetto
`Drive Condivisi > Gestionale Evolvi > BANDI E PROGETTI > {anno} > {Nome Bando} > PROGETTI > {Nome Progetto}` con sottocartelle `ALLEGATI`, `DOC AMM`, `CONTRATTI`. La creazione è automatica al salvataggio del progetto e passa per l'API `/api/drive/create-progetto`.

### Preview e modifica di un documento di progetto
Nel componente DocumentiProgettoPreview, per ogni file vedi il nome, lo stato (verde "Sincronizzato", ambra "Modificato su Drive", grigio "Non sincronizzato"), tipo, data di caricamento e data di ultima modifica su Drive, e pulsanti di azione: Preview (iframe Google Drive), Drive (apertura file in nuova scheda), Download, Check (verifica modifiche attuali).

### Come verifico se un documento su Drive è stato aggiornato
Clicca il pulsante "Check" sulla riga del documento: il sistema chiama l'API Drive, confronta il `modifiedTime` con il valore `last_checked` memorizzato e aggiorna lo stato. Se il file è stato modificato, appare un warning ambra "Modificato su Drive" e suggerisce di scaricare la versione aggiornata.

### Responsabili del progetto
Tab "Impostazioni Avanzate", campo "Responsabili Progetto": puoi aggiungere più utenti o gruppi come chip. Riceveranno notifiche per scadenze, documenti e cambi di stato del progetto.

### Stato del progetto
Campo `stato_progetto` gestito nel tab "Impostazioni Avanzate" con valori tipici attivo, chiuso, sospeso. Il cambio di stato non ricalcola automaticamente le scadenze.

### Perché non vedo il link a Drive
Il link al Drive appare soltanto se il documento ha un `google_drive_id` valido. Se il file è stato caricato solo su Supabase Storage, vedrai solo il pulsante Download. Usa "Check" o "Upload su Drive" per completare la sincronizzazione.

---

## 9. SCADENZE DI PROGETTO, CALENDARIO, SCADENZARIO

### Dove trovo lo scadenzario
Menu > Scadenzario. È la vista principale di gestione delle scadenze operative (milestone di progetto, consegne SAL, adempimenti bando).

### A cosa si può collegare una scadenza
Durante la creazione scegli l'entità di collegamento: nessuna (scadenza generica), Cliente, Bando, Progetto. Se scegli un'entità, compare un dropdown per selezionare il record specifico.

### Campi di una scadenza
Titolo (obbligatorio), data di scadenza (obbligatoria), priorità (Bassa verde, Media gialla, Alta arancio, Critica rossa), stato (Non iniziata, In corso, Completata, Annullata), tipologia (scelta da elenco configurabile `scadenze_bandi_tipologie_scadenze`), responsabile (utente singolo, gruppo o "tutti"), note libere.

### Come creo una scadenza
Pulsante "Nuova Scadenza" in alto a destra. Si apre il modal ScadenzaForm. Scegli il collegamento (Nessuna, Cliente, Bando, Progetto), compila titolo, data, priorità, tipologia, responsabile e note, clicca "Salva Scadenza". Il sistema salva la scadenza e tenta la sincronizzazione con Google Calendar.

### Viste disponibili
Vista lista tabellare (default) con filtri avanzati, vista Calendario Mese con griglia 7x5, vista Calendario Settimana con 7 colonne verticali (Lun-Dom) e highlight sul giorno corrente. Le viste sono accessibili tramite i pulsanti Calendario Mese e Calendario Settimana.

### Come segno una scadenza come completata
Dalla vista lista clicca l'icona check verde della colonna Azioni. Dalla vista calendario clicca la card della scadenza. Si apre il modal "Completa Scadenza" con campo opzionale "Note completamento". Alla conferma lo stato passa a Completata (badge verde, testo barrato), viene registrato il timestamp nella colonna `data_effettiva_scadenze` e la scadenza esce dalle notifiche successive.

### Filtri nello scadenzario
Tipo entità (Cliente, Bando, Progetto, Generico), Stato, Priorità, Responsabile email (lista dinamica), intervallo date da/a. I filtri si sommano; il pulsante Ripristina li azzera.

### Come funziona la vista settimanale
Mostra sette colonne (Lunedì-Domenica). Per ogni giorno vedi intestazione con nome, data grande (blu se è oggi), mese abbreviato, e le card delle scadenze ordinate per urgenza (rosso Urgente ≤ 1 giorno, arancio Imminente ≤ 7, blu Normale, verde Completata). Sabato e domenica hanno sfondo grigio. Le frecce in testata permettono di navigare tra settimane. In fondo trovi statistiche (totale, completate, urgenti) e legenda colori.

### Come navigo fra mesi nel calendario mese
Pulsanti freccia in testata. L'header mostra "Mese Anno" (es. "Marzo 2026"). Ogni giorno compatta al massimo tre scadenze; se ce ne sono di più appare il link "+N altre" per espandere.

### Data pianificata vs data effettiva
La data pianificata è quella assegnata al momento della creazione. La data effettiva viene registrata al completamento e usata nei report per stabilire se la scadenza è stata rispettata, anticipata o ritardata. Puoi aggiungere note di completamento (es. "Completata 5 giorni in anticipo") nel campo note del modal.

---

## 10. SCADENZE CONTRATTUALI

### Differenza rispetto alle scadenze di progetto
Le scadenze contrattuali (tabella `scadenze_bandi_scadenze_contrattuali`) sono pensate per adempimenti amministrativi, legali, certificazioni, rinnovi contratti, scadenze di fornitori e simili. Supportano ricorrenze (mensili, annuali, ecc.), tag, notifiche multiple per scadenza con giorni di preavviso personalizzati, log completo delle azioni, dashboard dedicata e report specifici. Sono separate dalle scadenze operative di progetto.

### Dove trovo la dashboard
Sezione dedicata "Scadenze Contrattuali" con quattro card KPI: Totale (azzurro), Aperte (teal, include APERTA e IN_CORSO), Scadute (rosso, passate e non ancora completate/annullate), Completate (verde).

### Stati
APERTA (appena creata), IN_CORSO (in lavorazione), COMPLETATA (chiusa con data effettiva), ANNULLATA (cancellata). I nomi sono maiuscoli per distinguersi dalle scadenze di progetto.

### Creare una scadenza contrattuale
Pulsante "Nuova Scadenza" > form ScadenzaContrattualeForm. Campi: titolo, tipo (preconfigurato, es. CERTIFICAZIONE, RINNOVO, SCADENZA_CONTRATTO), data scadenza, categoria, descrizione, priorità, responsabile email, entity type (es. CLIENTE, VENDOR, GENERALE), entity ID, flag is_ricorrente con pattern (MONTHLY, YEARLY...), interval (es. 12 per "ogni 12 mesi"), data fine ricorrenza, notifiche attive, array giorni_notifica_prima (es. [30, 15, 7, 3, 1]), tags.

### Come completo una scadenza contrattuale
Icona check verde nella colonna Azioni > modal "Completa Scadenza". Se è ricorrente il sistema avvisa che genererà automaticamente la prossima occorrenza. Il backend aggiorna lo stato, registra la nota di completamento nel log e, se ricorrente, crea il record successivo con data = corrente + interval.

### Colori riga per urgenza
Scaduta < oggi: sfondo rosso scuro con bordo rosso. Critica < 3 giorni: rosso chiaro. Urgente < 7 giorni: arancio chiaro. Avviso < 15 giorni: giallo chiaro. Altre: neutro.

### Report contrattuali
Totali per tipo e categoria, tasso di completamento, tempo medio di rispetto delle scadenze, scadenze per responsabile, ricorrenti vs una tantum, log completo delle modifiche, alert sulle scadute non completate. Filtri per intervallo date, tipo, responsabile; export PDF/CSV/Excel.

---

## 11. SISTEMA NOTIFICHE EMAIL, DESTINATARI AGGIUNTIVI, SCHEDULER

### Quando arrivano le notifiche
Lo scheduler controlla periodicamente (intervallo predefinito 60 minuti) le scadenze imminenti. Per ogni scadenza invia notifiche a 15, 7, 3 e 1 giorno dalla data prevista. Gli orari di invio sono configurabili (default 09:00, 14:00, 18:00) e rispettano gli "Orari Non Disturbare" tranne che per la notifica di un giorno prima (che passa comunque per criticità).

### A chi arrivano
Al responsabile assegnato della scadenza (email richiesta) e ai destinatari aggiuntivi globali (es. direzione, amministrazione, archivio). I destinatari aggiuntivi ricevono tutte le notifiche e il digest settimanale.

### Come cambio le mie preferenze di notifica
Impostazioni > Notifiche. Sezione "Notifiche Email" con master switch e checkbox per ciascuna soglia (1, 3, 7, 15 giorni), digest settimanale del lunedì e notifiche di assegnazione progetto. Sezione "Orari Non Disturbare" con ora inizio e fine (es. 22:00-08:00). Sezione "Google Calendar" per abilitare la sincronizzazione e scegliere quale calendario usare. Pulsante "Test Email" invia una mail di prova immediata al tuo indirizzo.

### Come aggiungo un destinatario aggiuntivo globale
Impostazioni > Notifiche > Destinatari Aggiuntivi. Inserisci l'email e clicca "Aggiungi". L'indirizzo viene salvato nella tabella `scadenze_bandi_additional_recipients` e riceverà tutte le notifiche. Per rimuoverlo clicca la X accanto.

### Come funziona il template email
L'email mostra un header colorato per urgenza (rosso 1 giorno, arancio 3 giorni, verde 7 giorni, azzurro 15 giorni), una card con i dettagli (titolo scadenza, data in italiano esteso, cliente, progetto, priorità) e un pulsante "Apri Gestionale Evolvi" che porta direttamente alla pagina scadenze. Il footer ricorda che le preferenze sono modificabili nel gestionale.

### Dove configuro lo scheduler
Impostazioni > Scheduler (solo admin). Il pannello SchedulerManager mostra stato (Attivo/Inattivo), prossimo check scadenze, prossimo digest, job in esecuzione. La sezione "Configurazione" permette di impostare intervallo controllo scadenze in minuti, orari di invio, giorno e ora del digest settimanale, intervallo e batch size di elaborazione coda email.

### Come avvio, fermo o riavvio lo scheduler
Pulsanti dedicati: "Avvia" (verde), "Ferma" (rosso), "Riavvia" (grigio). Il pulsante "Controllo Manuale" forza un check immediato senza aspettare il ciclo periodico. È utile quando hai appena modificato una scadenza e vuoi che parta subito la notifica.

### Perché non ricevo le email
Verifica che le notifiche email siano abilitate nelle tue impostazioni, che la scadenza abbia un responsabile, che non sia attivo un "Orari Non Disturbare" nel momento dell'invio, che lo scheduler sia attivo, che il tuo Gmail (o quello di sistema) sia configurato correttamente. Prova il pulsante "Test Email" per isolare il problema.

### Health check scheduler
L'admin può consultare un endpoint di health che restituisce stato API, ultimo check, job in esecuzione, errori nelle ultime 24 ore, stato connessione DB e Gmail, numero email in coda.

### Sincronizzazione Google Calendar
Attiva la sincronizzazione nelle preferenze. Puoi specificare l'ID del calendario da usare (se vuoto viene usato il principale) e scegliere se sincronizzare solo le scadenze o anche le milestone dei progetti. Quando modifichi una scadenza il relativo evento Calendar viene aggiornato, quando la completi l'evento viene marcato come completato.

---

## 12. CONTRATTI GENERICI E CONTRATTI EVOLVI

### Cosa si intende per contratto
Un documento formalizzato generato dal gestionale a partire da un template Word. Esistono due flussi distinti: contratti "generici" legati a progetti (tipicamente per consulenze spot) e contratti "Evolvi" legati ai clienti EVOLVI (abbonamento con fatturazione ricorrente).

### Dove trovo i template
Google Drive Condiviso "Gestionale Evolvi", cartella MODELLI. I file possono essere Word nativi (.docx) o Google Docs convertibili. Per i contratti Evolvi è atteso il file con "CONTRATTO EVOLVI" nel nome.

### Placeholder supportati
I delimitatori sono `[[NomeCampo]]`. Esempi: `[[Denominazione]]`, `[[PartitaIVA]]`, `[[CodiceFiscale]]`, `[[Indirizzo]]`, `[[CAP]]`, `[[Citta]]`, `[[Provincia]]`, `[[Email]]`, `[[PEC]]`, `[[Telefono]]`, `[[DataContratto]]`, `[[DataInizio]]`, `[[DataFine]]`, `[[NumeroContratto]]`, `[[ModalitaPagamento]]`, `[[DurataContratto]]`, `[[ImportoRata]]`, `[[ImportoAnnuale]]`, `[[ImportoTotale]]`, `[[ImportoConsulenziaPiuIVA]]` (solo per spot con IVA al 22 percento), `[[DataOggi]]`.

### Come modifico il template
Apri il file su Google Drive, edita testo e placeholder mantenendo la forma esatta `[[NomeCampo]]`, salva. Dalla volta successiva in cui generi un contratto il sistema userà la nuova versione.

### Come creo un contratto Evolvi
Dal profilo cliente (tipicamente via EvolviContractModal), clicca "Nuovo Contratto Evolvi". Step 1 "Dati del Contratto": scegli modalità mensile (es. 600 euro/mese, 24 rate) o annuale (es. 7000 euro/anno, 2 rate), importo, data contratto, data inizio, data fine (default +2 anni), toggle rinnovo automatico, note. Step 2: riepilogo e conferma. Step 3: generazione (il sistema scarica il template, compila i placeholder, carica il documento su Google Docs nella cartella cliente). Step 4: link "Apri su Google Docs" per revisione, pulsante "Approva Contratto" per convertirlo in PDF, pulsante "Invia Email" per inviarlo al cliente.

### Approvazione
La funzione "Approva Contratto" esporta il Google Docs come PDF, lo salva nella stessa cartella con nome "Contratto_Evolvi_APPROVATO_{cliente}_{numero}_{data}.pdf", aggiorna lo stato a "approvato" e registra chi e quando ha approvato. Solo dopo l'approvazione il contratto può essere inviato via email.

### Invio email del contratto
Dal modal successo oppure dalla scheda contratto clicca "Invia Email". Il sistema recupera l'email del cliente, genera un messaggio con corpo standard e link al Google Docs (o PDF), lo invia tramite Gmail, registra il `message_id`, e crea un record di tracking.

### Tracking e solleciti
Il pannello ContractTrackingPanel mostra una timeline verticale con sette possibili stati di `overall_status`: DRAFT, SENT, DELIVERED, REMINDED, SIGNED_RECEIVED, COMPLETED, FAILED. Sezione "Stato Consegna Email" riporta lo stato Gmail (SENT, DELIVERED, BOUNCED, FAILED). Contatore solleciti e timestamp dell'ultimo. Pulsante "Invia Sollecito" (Bell) crea un nuovo reminder e incrementa il contatore. Pulsante "Carica Contratto Firmato" per caricare il PDF firmato ricevuto dal cliente. Pulsante "Segna Completato" per chiudere manualmente il tracking.

### Carico un contratto firmato dal cliente
Dal pannello Tracking clicca "Carica Contratto Firmato", trascina o seleziona il PDF. Il file viene salvato in Supabase Storage nel bucket `contratti-firmati` con path `{trackingId}/{filename}` e il tracking passa a SIGNED_RECEIVED.

### Rinnovo del contratto
Se il contratto ha `rinnovo_automatico = true`, il sistema al termine del periodo crea automaticamente un nuovo contratto con gli stessi parametri (importo, modalità) e data di inizio pari alla data di fine del vecchio. Il vecchio contratto mantiene un riferimento al nuovo tramite `contratto_rinnovato_id`. Rinnovo manuale: dal contratto attivo/scaduto clicca "Rinnova Contratto", verifica/modifica le date, conferma.

### Contratti generici (spot)
Percorsi API `/api/contracts/*` analoghi a quelli Evolvi ma con template "MODELLO CONTRATTO SPOT", senza fatturazione ricorrente, con IVA al 22 percento applicata se presente l'importo di consulenza. Il flow è identico (generate, approve, send-email, tracking, upload-signed).

### Perché il contratto non parte via email
Controlla nell'ordine: contratto in stato "approvato" (il PDF deve essere generato), email cliente presente e valida, Gmail di sistema o utente configurato correttamente, pannello Tracking > Stato Consegna Email per eventuali bounce o fallimenti. In caso di hard bounce correggi l'email del cliente e rigenera.

---

## 13. FATTURAZIONE EVOLVI E BILLING RICORRENTE

### Come funziona la fatturazione Evolvi
Al momento dell'approvazione di un contratto Evolvi il sistema genera automaticamente il piano di fatturazione in base alla modalità di pagamento: 24 fatture mensili, 8 trimestrali, 4 semestrali, 2 annuali (nei contratti standard di 24 mesi). Ogni fattura è un record in stato PENDING con data di scadenza calcolata (data fine periodo + 30 giorni).

### Come vedo la dashboard billing
Componente EvolviDashboardBilling: quattro KPI card (Totale Fatturato, Incassato, Da Incassare, Scaduto, con valori in euro e conteggio fatture) e la sezione "Prossime Scadenze (30 giorni)" con lista delle fatture PENDING in scadenza imminente, ordinate per data, con indicazione dei giorni rimanenti (rosso ≤7, giallo ≤14, grigio >14).

### Come vedo le fatture di un cliente
Componente EvolviInvoicesContent: tabella con colonne Fattura, Periodo, Netto, IVA, Totale, Scadenza, Stato. Filtro stato pagamento (Tutti, In Attesa, Pagata, Scaduta, Annullata). Selezionando una riga si apre il modal "Dettaglio Fattura".

### Come segno una fattura come pagata
Apri il Dettaglio Fattura (solo stato PENDING o OVERDUE), sezione verde "Segna come Pagata": inserisci data pagamento (default oggi), metodo (Bonifico, Carta di Credito, RID/SDD, Assegno, Contanti, Altro), riferimento pagamento (CRO o ID transazione, opzionale). Clicca "Conferma Pagamento". Lo stato passa a PAID, vengono salvati data, metodo e riferimento, la riga aggiorna il badge.

### Genero una fattura extra manualmente
Dal detail contratto, sezione "Fatture Correlate", pulsante "Genera Nuova Fattura". Il modal propone importi pre-compilati (totale/numero fatture) e calcola IVA al 22 percento. Puoi modificare data e periodo, quindi salvi.

### Fatture scadute
Un job periodico (o controllo all'apertura della dashboard) cambia lo stato delle fatture PENDING con scadenza < oggi in OVERDUE. Diventano rosse nella dashboard e entrano nella card "Scaduto".

### Perché vedo un importo maggiore del previsto
Ricordati che le fatture Evolvi generate sono per la durata del contratto (di default 24 mesi). "Totale Fatturato" è la somma di tutti gli importi lordi, a prescindere dallo stato. "Incassato" è solo ciò che è marcato come PAID.

---

## 14. CENTRO EMAIL / GMAIL

### Dove trovo la posta
Menu > Email. Si apre il componente GmailClient che, se il tuo account Gmail è collegato, permette di leggere, inviare, rispondere, archiviare, contrassegnare con stella, marcare come letta/non letta, gestire etichette.

### Indicatore email non lette
Nella TopBar a destra c'è un'icona busta con un badge blu che mostra il numero di email non lette, aggiornato dal hook `useUnreadEmailCount`. Cliccandola vai direttamente al Centro Email.

### Come collego il mio Gmail personale
Impostazioni > Il Mio Gmail > "Connetti account Gmail". Si apre il flusso Google OAuth: selezioni l'account, autorizzi i permessi (gmail.readonly, gmail.send, gmail.modify, userinfo.email). Se il progetto Google Cloud è in modalità Testing vedrai l'avviso "Google hasn't verified this app"; clicca "Advanced" e poi "Go to Gestionale Evolvi (unsafe)", è sicuro perché il consenso è controllato dall'admin interno. Al termine la sezione mostra "Connesso" e l'indirizzo.

### Disconnettere e riconnettere
Nello stesso pannello, pulsante "Disconnetti Gmail". Rimuove refresh/access token dall'utente. Per riconnettersi clicca di nuovo "Connetti account Gmail".

### Fallback con Gmail di sistema
Se un utente non ha Gmail connesso, il sistema usa il token di sistema memorizzato in `scadenze_bandi_system_settings`. Questo account è configurato dagli admin in Impostazioni > Google API ed è usato tipicamente per notifiche automatiche, reminder contratti, digest.

### Come invio un'email
Dal Centro Email oppure direttamente da scadenze/progetti/clienti/contratti quando è presente il pulsante "Invia Email". Compila destinatario, oggetto, corpo (editor WYSIWYG). La firma personalizzata viene aggiunta automaticamente in coda. Cliccando "Invia" il messaggio parte via Gmail API.

### Errori frequenti Gmail
"redirect_uri_mismatch": il redirect URI in Google Cloud non coincide con quello del gestionale, deve essere esattamente `https://gestionale.blmproject.com/api/user/gmail/callback`. "Access blocked: This app's request is invalid": la tua email non è nella lista Test Users del progetto EXTERNAL, chiedi all'admin di aggiungerla. "401 Unauthorized": token scaduto, fai logout/login e riprova.

---

## 15. FIRMA EMAIL E LOGO AZIENDALE

### Dove imposto la firma
Impostazioni > Il Mio Gmail, sezione "Firma Email". Usa l'editor EmailSignatureEditor con anteprima live a destra.

### Campi della firma
Nome completo, Ruolo, Telefono (opzionale), Email di contatto, Disclaimer legale (precompilato e personalizzabile), nota AI disclosure opzionale, logo (immagine caricata o URL esterno).

### Caricare il logo
Checkbox "Includi immagine/logo nella firma", pulsante "Carica immagine". Formati accettati PNG, JPG, GIF, WebP, SVG; dimensione massima 2 MB. Il file viene caricato via `POST /api/user/email-signature/upload-image` e l'URL restituito usato nella firma.

### Output HTML
La firma è generata come tabella HTML con stili inline per garantire la compatibilità con tutti i client di posta. Contiene logo, nome e ruolo in teal, recapiti, disclaimer legale e nota AI. Non sono usati CSS esterni.

### Salvataggio
Pulsante "Salva Firma" (teal). Messaggio "Salvato!" a conferma. L'HTML viene memorizzato nella colonna `firma_email_html` della tabella `scadenze_bandi_utenti`.

### Dove appare
In tutte le email inviate dal gestionale usando il tuo account Gmail o quello di sistema. Le email inviate prima del salvataggio non vengono retroattivamente modificate.

---

## 16. GOOGLE DRIVE, CARTELLE PROGETTI, DOCUMENTI

### Come è organizzato il Drive
Tutto il lavoro vive dentro il Drive Condiviso "Gestionale Evolvi". Struttura tipica: `MODELLI/` (template Word), `BANDI E PROGETTI/{anno}/{Nome Bando}/` (cartella bando con ALLEGATI), `BANDI E PROGETTI/{anno}/{Nome Bando}/PROGETTI/{Nome Progetto}/` con sottocartelle `ALLEGATI`, `DOC AMM`, `CONTRATTI`. Le cartelle cliente per i contratti Evolvi sono sotto "Contratti Evolvi/{Cliente}/".

### Chi crea le cartelle
La creazione è automatica alla salvaguardia di un bando (API `/api/drive/create-bando`) o di un progetto (API `/api/drive/create-progetto`). Se la cartella esiste già il sistema non la ricrea.

### Come carico un file su Drive
API `/api/drive/upload-file`: il file viene salvato in Supabase Storage (per fallback) e caricato su Drive, salvando `google_drive_id` e `google_drive_url` nella tabella `scadenze_bandi_documenti_progetto`.

### Verificare connessione Drive
L'icona nella TopBar indica lo stato (verde connesso, rosso disconnesso). Il componente GoogleDriveDebug (admin, Impostazioni > Google API) offre diagnostica completa con pulsante "Avvia Test" che verifica esistenza Drive Condiviso, cartella MODELLI, permessi account di servizio.

### Account di servizio vs OAuth utente
Le operazioni amministrative (creazione cartelle bandi/progetti, lettura template) possono avvenire con account di servizio configurato dagli admin (file `service-account-key.json`). Le operazioni personali (invio email da Gmail personale, lettura posta) usano l'OAuth dell'utente connesso.

### Problemi comuni
"Drive Condiviso non trovato": verifica che esista un Shared Drive chiamato esattamente "Gestionale Evolvi" e che l'account usato (OAuth o service account) abbia accesso in scrittura. "Cartella MODELLI non trovata": ripristinala nel Drive Condiviso e ricarica il template CONTRATTO EVOLVI. "Permission denied": mancano gli scope Drive nel consenso OAuth o l'account di servizio non ha ricevuto accesso al Drive Condiviso.

---

## 17. DOCUMENTI AMMINISTRATIVI CLIENTE

### Cosa sono i documenti amministrativi
I documenti formali associati a un'azienda cliente: Visura Camerale, Atto Costitutivo, Statuto, Bilancio, Documento d'Identità del rappresentante, Codice Fiscale, Certificato Partita IVA, Certificato Antimafia, DURC, Iscrizione RUNTS, Altro.

### Categorie
SOCIETARI (visura, atto costitutivo, statuto), FISCALI (codice fiscale, certificato P.IVA), IDENTITA (documento di riconoscimento), CERTIFICAZIONI (antimafia, DURC, RUNTS), BILANCI, ALTRO.

### Come carico un documento
Dal dettaglio cliente, sezione "Documenti Amministrativi", pulsante "+ Carica Documento". Drag and drop o selezione file. Campi: tipo documento (dropdown), categoria (auto-compilata), descrizione, data documento, data scadenza (fondamentale per DURC e certificati), tag personalizzati. Al caricamento il file viene salvato in Supabase Storage bucket `clienti` con path `{clienteId}/{tipo}/{timestamp}_{nome}`; i metadati in `scadenze_bandi_documenti_amministrativi`.

### Indicatori visivi
Icona rossa se il documento è scaduto (data_scadenza < oggi), icona arancione se scade entro 30 giorni, checkmark verde se un admin lo ha marcato come verificato.

### Verificare un documento
L'admin apre il documento e clicca "Marca come verificato". Il sistema aggiorna `verificato = true`, `verificato_da`, `verificato_il`.

### Ricerca e filtri
Cerca per nome, filtra per tipo, categoria o tag; raggruppamento automatico per categoria con espansione/compressione.

### Scaricare un documento
Clic sull'icona download della riga. Il sistema genera un URL Supabase Storage firmato temporalmente e avvia il download.

---

## 18. REPORTS E ANALYTICS

### Dove trovo i report
Menu > Reports. Cinque aree: Contributi Clienti, Analisi Bandi, Overview Progetti, Benchmarking, Scadenze Contrattuali.

### Contributi Clienti
Per ogni cliente: numero progetti, contributi ammessi totali, contributi ottenuti totali, tasso di completamento, percentuale di successo. Utile per valutare il portafoglio cliente.

### Analisi Bandi
Per ogni bando: numero di progetti, progetti accettati/rifiutati, contributi complessivi, percentuale di successo. Evidenzia i bandi con il miglior ROI.

### Overview Progetti
Stato globale dei progetti: totale, decreti attesi, decreti ricevuti, decreti accettati, in corso, completati. Totali economici.

### Benchmarking
Confronto tra più periodi temporali (es. Q1 2025 vs Q1 2026). Seleziona 2-4 periodi e clicca "Genera Benchmark". Grafici comparativi su contributi, tasso di successo, trend per bando.

### Scadenze Contrattuali
Report dedicato alle scadenze contrattuali (vedi sezione 10).

### Filtri trasversali
Ogni report ha filtri Stato, Periodo (tutti, anno, trimestre), Date personalizzate Da/A. I dati si aggiornano live al cambio di filtro. Pulsanti di export in PDF/CSV/Excel.

---

## 19. IMPOSTAZIONI DI SISTEMA (ADMIN)

### Dove trovo le impostazioni
Menu > Impostazioni oppure avatar TopBar > Impostazioni.

### Sezioni disponibili
Generali (info sistema), Gestione Utenti, Gruppi Utenti, Sicurezza (in sviluppo), Notifiche, Il Mio Gmail, Scheduler, Google API, Aspetto (in sviluppo), Database (in sviluppo).

### Gestione Utenti
Tabella con Nome Cognome, Ruolo, Status (Attivo/Disattivo), Data registrazione, Ultimo accesso, Azioni (visualizza, cambia ruolo, disattiva/attiva, resetta password, elimina). L'icona scudo permette di invertire il ruolo direttamente.

### Google API
Pannello amministrativo per configurare Gmail API e Drive API a livello di sistema, gestire il token di service account, effettuare test di connessione, diagnosticare problemi di autenticazione.

### Scheduler
Pannello SchedulerManager: stato, prossime esecuzioni, configurazione (intervallo controllo scadenze, orari invio, digest settimanale, elaborazione coda email), pulsanti Avvia/Ferma/Riavvia/Controllo Manuale/Health Check.

### Sicurezza e Database
In sviluppo. Prevederanno impostazioni 2FA, policy di password, backup, ripristino, migrazioni.

---

## 20. TROUBLESHOOTING RAPIDO

### Il caricamento resta infinito
Aspetta qualche secondo, poi fai refresh con F5 o Ctrl+F5 per svuotare la cache. Se persiste fai logout e rientra.

### I dati non si aggiornano
Clicca "Aggiorna" nella Dashboard o rinfresca la pagina. Se il problema continua controlla la console del browser per errori di rete; se sei admin, verifica la connessione al database.

### Accedo e mi rimanda al cambio password ma non entra
Assicurati che la nuova password soddisfi i requisiti (minimo 8 caratteri, uguale nei due campi). Se continua a fallire, chiedi all'admin di resettarti la password e riprovare.

### Login con Google dice "Access blocked"
La tua email non è nella lista Test Users del progetto Google Cloud (vale solo per OAuth in modalità Testing). Chiedi all'admin di aggiungerla in Google Cloud Console > OAuth consent screen > Test users.

### Drive disconnesso
Icona Drive rossa in TopBar: gli admin devono riconfigurare OAuth o il service account da Impostazioni > Google API. Il componente GoogleDriveDebug offre un test automatico.

### Notifiche non arrivano
Controlla le tue preferenze in Impostazioni > Notifiche; verifica che la scadenza abbia un responsabile; controlla orari non disturbare; verifica che lo scheduler sia attivo (admin); usa "Test Email" per isolare un problema di configurazione Gmail.

### Contratto non si invia
Verifica che lo stato sia "approvato" (PDF generato), che l'email cliente sia valida, che il Gmail di sistema o utente sia funzionante; nel pannello Tracking controlla lo Stato Consegna Email per bounce o failure.

### Preview documento non funziona
Il file deve avere `google_drive_id` valorizzato. Se mostra "Non sincronizzato" usa il pulsante di sincronizzazione o ricarica il file manualmente su Drive e aggiorna il record.

### Scheduler non parte
Admin, apri SchedulerManager. Se è inattivo, clicca "Avvia"; se dà errore, apri l'health check; se il problema persiste clicca "Riavvia" oppure, per un'esecuzione one-shot, usa "Controllo Manuale".

---

## 21. GLOSSARIO

- **Bando**: iniziativa pubblica o privata a cui BLM concorre per ottenere contributi o affidamenti.
- **Progetto**: attività specifica di un cliente che nasce (di norma) da un bando vinto.
- **Scadenza**: adempimento datato collegato a un progetto, un bando, un cliente o generico.
- **Scadenza contrattuale**: adempimento amministrativo/legale con logica dedicata e possibili ricorrenze.
- **Template scadenze**: modello di scadenze ricorrenti associato a un bando, applicato automaticamente ai progetti derivati.
- **Prospect**: azienda potenzialmente interessata, in fase di qualificazione pre-vendita.
- **Cliente EVOLVI**: cliente con abbonamento attivo e fatturazione ricorrente.
- **Cliente SPOT**: cliente occasionale, con contratti singoli.
- **Contratto Evolvi**: contratto di servizio con fatturazione ricorrente generato da template.
- **Contratto generico**: contratto "spot" per consulenze singole.
- **Tracking contratto**: stato di consegna, firma e completamento di un contratto inviato.
- **Scheduler notifiche**: processo periodico che verifica le scadenze in arrivo e invia le email.
- **Destinatario aggiuntivo**: email che riceve tutte le notifiche, indipendentemente dal responsabile specifico.
- **Drive Condiviso**: cartella su Google Drive dedicata al gestionale, accessibile a più utenti.
- **Service account**: account tecnico Google usato dal sistema per operazioni amministrative senza OAuth utente.
- **JWT**: token di autenticazione interno del gestionale, scade dopo 7 giorni.
- **UnifiedResponsableSelector / UnifiedMultiResponsableSelector**: componenti UI per assegnare uno o più utenti/gruppi come responsabili.
- **Dimensione europea**: classificazione MICRO/PICCOLA/MEDIA/GRANDE secondo Raccomandazione UE 2003/361/CE.

---

## Note per la manutenzione della knowledge base

Questo documento è pensato per essere la fonte di verità del chatbot interno. Ogni volta che viene aggiunta una funzionalità, cambiata un'etichetta, ridisegnato un flusso:

- Aggiornare la sezione corrispondente di questo file.
- Ri-indicizzare la knowledge base del chatbot (rigenerare embeddings se si usa RAG, oppure reindurre cache testuale).
- Se l'interfaccia cambia nomi di pulsanti o posizioni, correggere le indicazioni visive nel testo.
- Mantenere il tono discorsivo in italiano e l'ottica "utente finale", evitando dettagli puramente tecnici salvo in troubleshooting.
