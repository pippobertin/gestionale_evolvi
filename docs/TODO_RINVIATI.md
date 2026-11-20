# Gestionale Evolvi: attività rinviate

Elenco delle attività emerse durante l'analisi del 19/11/2026 e lasciate consapevolmente per un secondo momento. Per ciascuna è indicato perché conta e che cosa serve per farla. Le voci sono raggruppate per area e, dentro ogni area, in ordine di priorità.

Ultimo aggiornamento: 20/11/2026.

## Già fatto il 19/11/2026 (per riferimento)

- Fase 1 sicurezza: rimosse le route di test e debug, chiusa la registrazione libera, login Google limitato agli utenti censiti e attivi, hash delle password e token Gmail non più leggibili con la chiave pubblica (script `supabase/migrations/20261119_fase1_chiusura_colonne_sensibili.sql`), account di prova disattivato.
- Cambiate e salvate come "sensitive" su Vercel le chiavi `JWT_SECRET` e `NEXTAUTH_SECRET`.
- Next.js aggiornato dalla 16.0.7 alla 16.4.6 (chiuse 25 vulnerabilità note, due critiche).
- Liste clienti, bandi e progetti: una sola richiesta al database invece di una per elemento.
- Branch Tracking di Vercel collegato a `main`; funzioni spostate nella regione di Francoforte (`fra1`).

## Infrastruttura e fornitori

1. **Passaggio a Vercel Pro.** Il piano Hobby è riservato per contratto all'uso personale e non commerciale; conserva i log per un'ora soltanto e limita le attività pianificate a una al giorno. Serve per l'uso aziendale, per avere memoria di ciò che succede sul server e per le notifiche automatiche delle scadenze. Decisione e costo a carico di BLM.
2. **Database nel progetto Supabase "TEST".** Il gestionale condivide database e chiave pubblica con almeno otto altre applicazioni (finanza, scuole e studenti, immobiliare, EDIH, trasferte, VSME, balneari, cantieri). Per ora si resta così. In futuro valutare un progetto Supabase dedicato al gestionale, con chiavi proprie, e comunque rinominare il progetto per non farlo sembrare un ambiente di prova sacrificabile.
3. **Sicurezza delle altre applicazioni sullo stesso database e archivio file.** Oltre alle tabelle, tre regole generiche sui file ("Allow all reads flreew_0", "Allow all uploads flreew_0", "authenticated_can_manage_storage_objects") lasciano leggere e caricare a chiunque i file degli altri bucket del progetto (per esempio `documents`, `seedmind-materiali`); dal 19/11/2026 escludono i bucket del gestionale. Le tabelle `fin_*` (conti e estratti conto), `csp_*` (studenti) e le altre hanno la protezione disattivata e sono leggibili e modificabili con la chiave pubblica. Non riguarda il gestionale, ma lo stesso database: va affrontata applicazione per applicazione.
4. **Aggiornamento di Postgres su Supabase.** Il controllo di sicurezza di Supabase segnala aggiornamenti in sospeso per la versione 15.8.1.131. Si fa dalla dashboard di Supabase, con una breve interruzione: pianificarlo fuori orario.
5. **Altre chiavi su Vercel come "sensitive".** `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_SERVICE_ACCOUNT_KEY` e `ANTHROPIC_API_KEY` sono ancora leggibili in chiaro da chi ha accesso al progetto Vercel. Priorità bassa finché il progetto è visibile solo a Filippo; diventa necessario se si aggiungono persone al progetto Vercel.

## Sicurezza: decisioni rinviate

1. **Token Gmail degli utenti.** Sono rimasti leggibili con la chiave pubblica per mesi e permettevano di leggere e inviare email dalle caselle dei collegati. Si è deciso di non revocarli. Se in futuro si vuole farlo, ogni utente deve solo premere di nuovo "Collega Gmail" nelle Impostazioni: nessuno deve cambiare la password di Google.
2. **Password degli utenti.** Gli hash bcrypt sono stati leggibili; si è deciso di non imporre il cambio, dato il breve periodo di utilizzo.
3. **Password dell'account Agevolando condiviso.** La pagina di accesso automatico la consegna in chiaro al browser e la documentazione interna la segnala come già esposta. Si è deciso di lasciarla invariata.
4. **Token di sessione nel browser.** Il token è ancora salvato anche nel `localStorage` (esposto a eventuali attacchi XSS) e il logout non lo revoca lato server: resta valido fino alla scadenza di 7 giorni. Da sistemare con la fase 3.
5. **Cambio password obbligatorio al primo accesso** applicato solo dall'interfaccia: il server rilascia comunque un token valido.
6. **Mancano** limiti ai tentativi di login, autenticazione a due fattori, intestazioni di sicurezza (CSP, HSTS) e i controlli di tipo nel build (`ignoreBuildErrors: true` in `next.config.js`).

## Fase 3: chiusura del database (completata il 20/11/2026)

Tutte le tabelle, le viste, le funzioni di ricerca e gli archivi dei file del gestionale rispondono solo al badge rilasciato al login a un utente attivo; le sessioni sono revocabili (logout effettivo), il token vive solo nel cookie httpOnly e il cambio della password temporanea è imposto dal server. Prova finale del 20/11/2026 con la sola chiave pubblica (`frontend/scripts/prova-chiave-pubblica.sh`): 99 controlli, nessuna risorsa accessibile. Resta da valutare la cifratura dei token Google salvati nel database (oggi leggibili solo dal server con la chiave riservata).

## Fase 4: ruoli e tracciabilità per la 231

Ruoli applicati dal server sulle operazioni critiche, registro delle operazioni non modificabile (chi, quando, che cosa, valore prima e dopo), autore reale al posto di "system", separazione tra chi crea e chi approva i contratti, archiviazione al posto delle cancellazioni fisiche, rimozione delle cascate sui dati storici, cestino invece dell'eliminazione definitiva su Drive. Serve un'indicazione del consulente 231 sui tempi di conservazione dei documenti.

## Pagina dei registri per gli amministratori (richiesta del 20/11/2026)

Una pagina riservata agli admin, di facile lettura e con filtri (persona, periodo, tipo di evento, cliente o progetto, esito), che riunisca in un'unica cronologia gli eventi oggi sparsi in più tabelle o non registrati affatto: accessi e uscite (sessioni, metodo, IP, dispositivo), cambi e reimpostazioni di password, creazione e disattivazione di utenti, registrazione dei contratti firmati, approvazione e invio di contratti, email inviate dal gestionale, documenti caricati ed eliminati. Si costruisce insieme al registro delle operazioni della fase 4 (tabella unica, non modificabile, alimentata dal server e dal database), con esportazione in Excel o PDF per il consulente 231.

## Correzioni funzionali

1. **Dimensione d'impresa.** Associate e collegate sono invertite rispetto alla Raccomandazione 2003/361/CE; la classificazione usa il parametro peggiore invece della regola "ULA e (fatturato oppure attivo)"; manca la regola dei due esercizi consecutivi.
2. **Perimetro de minimis.** L'impresa unica è calcolata includendo le partecipazioni di minoranza ed escludendo le controllate, per effetto dell'errore precedente.
3. **Notifiche delle scadenze.** Lo scheduler parte solo se un browser è aperto nella finestra giusta; la coda email si svuota solo a mano; le scadenze contrattuali non generano email; i responsabili per gruppo o per bando sono ignorati. Richiede un'attività pianificata vera (vedi Vercel Pro).
4. **Conversione prospect FPI e Consulenti.** Il vincolo sul campo `decisione` della tabella prospect ammette solo EVOLVI, SPOT e RIFIUTATO: da verificare e allineare.
5. **Rimozione della fatturazione Evolvi.** Deciso di eliminarla perché le fatture si emettono con il gestionale collegato allo SDI. Prima esportare le eventuali fatture presenti.
6. **Contratto firmato: risolto il 20/11/2026.** "Registra contratto firmato" nei contratti di progetto e nei contratti Evolvi: file su Drive accanto al contratto approvato, data, canale, note, chi ha registrato; i solleciti si fermano.
7. **Riconversione cliente in prospect.** Cancella fisicamente fatture, contratti, documenti, progetti e formazione del cliente; pulsante visibile a tutti.
8. **Caricamento su Drive dei documenti dei bandi.** Cerca la cartella del bando nel posto sbagliato e quindi non funziona.
9. **Prospect: stato predefinito.** Il valore predefinito della colonna `stato` ("nuovo") non è ammesso dal suo stesso vincolo: un inserimento che non indica lo stato viene rifiutato.
10. **Eventi di calendario.** Il trigger su `updated_at` della tabella `calendar_events` potrebbe riferirsi a una colonna mancante: da verificare prima di modificare eventi da codice.
11. **Tracking dei contratti di progetto ricostruito.** Le 12 righe ricostruite il 19/11/2026 dai PDF approvati su Drive hanno come destinatario l'email attuale del cliente e come data d'invio la creazione del PDF; se un invio di allora era fallito, il dato va corretto a mano.

12. **Firma email nella sezione Email: risolto il 20/11/2026.** Le email della sezione Email partono in testo e HTML con la firma dell'utente. Restano senza firma l'invio del contratto di progetto da "Invia email" e i solleciti.
13. **File orfani nell'archivio progetti: risolto il 20/11/2026.** Caricamento ed eliminazione dei documenti di progetto corretti; il Modul_C.pdf di TRE GELSI è stato ricollegato. Restano quattro file di progetti eliminati, eliminabili dalla dashboard.

## Nuove funzioni (materiale di Stefano, 19/11/2026)

Da progettare dopo le fasi 3 e 4, partendo dal disegno dei processi: strutture di cartelle Drive per tipo di processo, controllo dei documenti richiesti, rilevazione dei file caricati direttamente su Drive con richiesta di abbinamento, registrazione di email, deroghe e accordi telefonici come documenti tracciati, esposizione dei dati per il cervello aziendale (Obsidian o Claude).
