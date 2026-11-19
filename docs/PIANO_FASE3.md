# Fase 3: chiusura del database del Gestionale Evolvi

Piano redatto il 19/11/2026 sulla base di verifiche in sola lettura sul progetto Supabase "TEST" e sul codice in produzione (commit `7eb26ea`).

## Obiettivo

Oggi chiunque possieda la chiave pubblica del sito (che è nel codice JavaScript scaricato dal browser) può leggere e modificare quasi tutte le tabelle del gestionale. Al termine della fase 3 il database risponderà solo a chi presenta un "badge" valido rilasciato dal gestionale al login, e la chiave pubblica da sola non darà accesso a nessun dato. Il database resta nel progetto "TEST", come deciso.

## Situazione verificata

**Firma dei token.** Il progetto usa il sistema storico di Supabase: un segreto condiviso con algoritmo HS256 e la sola chiave pubblica "anon" di tipo storico. Non sono attive le nuove chiavi di firma né le nuove chiavi API.

**Altre applicazioni.** Il progetto ospita almeno otto applicazioni oltre al gestionale e 31 utenti che entrano con il login di Supabase (ultimo accesso oggi). Per il database questi utenti hanno il ruolo "authenticated", lo stesso che avrebbero gli utenti del gestionale. Ne segue che le regole del gestionale non possono limitarsi a chiedere "utente autenticato": devono verificare che il badge sia stato rilasciato dal gestionale a un suo utente attivo. Le quattro regole esistenti di questo tipo (su bandi, scadenze, tipologie di scadenza ed eventi di progetto) oggi, se la protezione fosse attiva, lascerebbero entrare anche gli utenti delle altre applicazioni.

**Tabelle e viste.** 70 tabelle del gestionale, di cui 19 con la protezione attiva (quasi sempre con regole che lasciano passare tutti); 16 viste, molte delle quali eseguite con i privilegi del proprietario e quindi in grado di scavalcare le regole.

**Codice.**

| Punto di accesso | Quantità | Cosa usa oggi |
|---|---|---|
| Componenti e hook nel browser | 48 | chiave pubblica |
| Route API sul server | 131, di cui 77 con chiave pubblica e 19 con chiave riservata | misto |
| Agente RNA sul Mac | 1 | chiave pubblica |
| Pipeline n8n delle note | 1 | API del gestionale con segreto (già corretto) |
| Importazione Agevolando (cron) | 1 | chiave riservata (già corretto) |
| Questionario pubblico sul fabbisogno | 1 | API con token del questionario |

**Funzioni del database** usate dal codice (`match_clienti`, `match_bandi`, `match_progetti`, `find_note_candidate_*`, `match_bandi_esterni_per_cliente`): oggi eseguibili da chiunque abbia la chiave pubblica.

**Archivi file.** `progetti-documenti` è pubblico; `clienti-documenti` ha regole aperte a tutti; gli altri sono privati con regole pensate per un login che il gestionale non usa.

## Come verrà firmato il badge

**Opzione 1, consigliata: segreto storico del progetto.** Il gestionale firma il badge con lo stesso segreto che Supabase usa oggi. Non richiede alcuna modifica alla configurazione del progetto e non tocca le altre applicazioni. Il prezzo è che questo segreto è molto potente: con esso si possono firmare anche token con pieni poteri su tutte le applicazioni del progetto. Va quindi salvato solo su Vercel, come variabile "sensitive", e inserito da Filippo direttamente dalla dashboard di Supabase (mai in chat o per email).

**Opzione 2, da rinviare: nuove chiavi di firma con chiave privata propria.** È il sistema che Supabase raccomanda, ma l'attivazione riguarda la configurazione dell'intero progetto e quindi tutte le applicazioni che lo condividono. Ha senso solo quando il gestionale avrà un progetto Supabase dedicato (vedi `docs/TODO_RINVIATI.md`).

**Caratteristiche del badge.** Durata breve (un'ora) con rinnovo automatico finché l'utente resta collegato; contiene l'identificativo dell'utente, il suo livello (admin o collaboratore) e un'etichetta che indica che è stato rilasciato dal gestionale. Il database verifica a ogni richiesta che l'utente esista e sia attivo: disattivare un utente lo blocca entro pochi minuti, senza aspettare la scadenza.

## Passaggi

Ogni passaggio viene pubblicato separatamente, prima in anteprima e poi in produzione, con uno script per tornare indietro. Nessun passaggio cambia l'aspetto o il comportamento delle schermate.

### A. Preparazione (1-2 giorni)

- Esportazione dello schema reale del database nel repository, per avere la base di confronto e per il consulente 231.
- Inventario, tabella per tabella, di chi legge e chi scrive (browser, server, sistemi esterni).
- Lista di controllo delle operazioni da provare dopo ogni passaggio (login nei due modi, apertura di ogni sezione, salvataggio di un record di prova marcato come tale).

### B. Il badge (1-2 giorni)

- Rilascio e rinnovo del badge al login con password e con Google, appoggiandosi al login esistente.
- Il client del browser allega il badge a ogni richiesta al database.
- Due funzioni nel database: "utente corrente del gestionale" e "è amministratore", che leggono il badge e controllano la tabella utenti.

A questo punto le regole non sono ancora attive: il gestionale funziona come prima, ma ogni richiesta porta già con sé l'identità di chi la fa.

### C. Il server (3-5 giorni)

- Controllo centrale (`middleware.ts`) che chiede il login su tutte le API, con eccezioni esplicite solo per: questionario pubblico con token, ingest delle note da n8n, importazione Agevolando, sincronizzazione RNA, route di login.
- Le 77 route che usano la chiave pubblica passano al client riservato dopo aver verificato l'utente, oppure al client con il badge dell'utente.
- Correzione delle route che chiamano la verifica dell'utente ma ne ignorano l'esito.
- Agente RNA sul Mac: passaggio a una chiave dedicata oppure a una route del gestionale protetta da segreto.

### D. Le regole sul database, a gruppi di tabelle (4-6 giorni)

Per ogni gruppo: attivazione della protezione con regole "solo utenti attivi del gestionale", ricreazione delle viste in modo che rispettino le regole, revoca dei permessi al ruolo pubblico; poi anteprima, prova, produzione e monitoraggio dei log per 24 ore prima del gruppo successivo.

1. Tabelle di riferimento (ATECO, fondi, CCNL, tipologie, uffici, catalogo eventi).
2. Clienti, referenti, collegamenti, prospect, consulenti, note e collegamenti delle note, esigenze e bandi esterni.
3. Bandi, progetti, scadenze, template, documenti di bandi e progetti, eventi di calendario.
4. Contratti, contract tracking, scadenze contrattuali e relativo registro, notifiche.
5. Formazione, fabbisogno, contributi, RNA.

Le funzioni `match_*` e `find_note_candidate_*` diventano eseguibili solo dagli utenti del gestionale.

### E. Archivi dei file (1-2 giorni)

Tutti i bucket del gestionale diventano privati con regole basate sul badge; `progetti-documenti` smette di essere pubblico e i file si aprono con link temporanei.

### F. Pulizia finale (1 giorno)

- Il token di sessione non viene più salvato nel `localStorage` ma solo nel cookie protetto.
- Logout con revoca effettiva della sessione.
- Prova conclusiva con la sola chiave pubblica: nessuna tabella e nessun file del gestionale devono risultare leggibili.

**Durata complessiva stimata:** da 2 a 3 settimane di lavoro effettivo, distribuibili nel tempo.

## Che cosa la fase 3 non fa

Non introduce ancora differenze di permesso per operazione (per esempio "solo un admin approva i contratti"), il registro delle operazioni e l'archiviazione al posto delle cancellazioni: sono la fase 4. La fase 3 però ne è il presupposto, perché con il badge il database sa chi sta operando e potrà registrarlo da sé.

## Rischi e contromisure

- **Un'operazione dimenticata smette di funzionare.** Gruppi piccoli, monitoraggio dei rifiuti nei log dopo ogni pubblicazione, script di ripristino pronto per ogni gruppo.
- **L'anteprima usa il database vero.** Prove in sola lettura; per le scritture solo record di prova chiaramente marcati, poi eliminati.
- **Altre applicazioni sullo stesso progetto.** Si toccano solo oggetti del gestionale (`scadenze_bandi_*`, `vista_*`, `scadenze_enhanced_simple`) e non la configurazione del login del progetto.
- **Utenti con la pagina aperta durante una pubblicazione.** Avviso di ricaricare la pagina; le pubblicazioni più delicate fuori orario.

## Decisioni da prendere prima di iniziare

1. Conferma dell'opzione 1 (segreto storico del progetto) per la firma del badge.
2. Per ora un solo livello di accesso ai dati: tutti gli utenti attivi del gestionale vedono e modificano tutto, come oggi; le differenze per ruolo arrivano con la fase 4.
3. Agente RNA sul Mac: chiave dedicata oppure passaggio da una route del gestionale.
4. Finestre orarie per le pubblicazioni dei passaggi C, D ed E.
