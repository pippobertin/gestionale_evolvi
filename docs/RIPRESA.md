# Punto di ripresa del lavoro

Branch di lavoro `claude/stoic-hawking-mf8eph`. Aggiornato il 24/11/2026 (sera).

## Dove siamo

**In produzione** (`main`), provato e confermato:

- fasi 1-4 della sicurezza e della tracciabilità (database chiuso, registro delle operazioni, ripristino, ruoli e permessi configurabili, area dell'OdV);
- utenti con accesso a termine; backup mensile con registro delle prove di ripristino;
- pratica di finanza agevolata guidata, passaggi A e B;
- registri 231 completi (qualifiche, dichiarazioni degli interessi, conflitti, deleghe dei clienti, ingressi e uscite, segnalatori e compensi, deroghe) e report semestrale all'OdV. La bozza del 2° semestre 2026 è già preparata: va completata e inviata entro il 31/01/2027 (prima "Aggiorna i dati dai registri");
- client email veloce; documenti dei clienti su Google Drive (i 657 documenti dell'archivio interno sono stati spostati); riquadro Email nella scheda cliente e nella pratica, con archiviazione in PDF;
- sezione e categoria "Consulenti" rinominate "Segnalatori" (il codice interno della categoria resta CONSULENTI);
- filtro per tipologia di investimento nel Catalogo bandi.

**Email di sistema: decisione presa (scelta 3).** Il gestionale non invia email automatiche. Ogni email (contratti, solleciti, questionari, invii multipli) parte dalla casella personale di chi la scrive; chi non l'ha collegata riceve un messaggio che indica dove farlo. I promemoria delle scadenze arrivano dal calendario Google. L'account Google dello studio resta collegato perché serve a Drive: non va scollegato.

**Semplificazione dell'esperienza d'uso.** Analisi completa approvata dall'utente, divisa in tre rilasci.

- **Rilascio 1, fatto e in produzione.** Errori corretti: filtro dei bandi, aiuto su imprese associate e collegate, pulsanti che non facevano nulla, filtro Sospeso. Inoltre:
  - cruscotto "Le mie scadenze";
  - menu raggruppato e coerente con il ruolo;
  - Impostazioni in "Il mio profilo" e "Amministrazione";
  - nomi in italiano e sigle spiegate;
  - client email (invito a collegare la casella, conferme, rispondi a tutti, inoltra);
  - caricamenti in parallelo.
- **Rilascio 2, fatto e in produzione.**
  - Cliente: prima scheda "Progetti e scadenze", pulsante Modifica che torna al cliente, dati leggibili.
  - Progetti: pulsante "Nuovo progetto".
  - Scheda progetto a cinque schede, con stato calcolato e obbligatori solo bando, cliente e titolo.
  - Percorso della pratica con "Cosa fare ora", sezioni della fase in corso e linea di stato anche dopo l'invio.
  - Scadenze del progetto in due tabelle (prevista, fatta il).
  - Prospect con "Prossimo passo" in ogni scheda.

I dati di prova (delega "restart" su AAAAPIPPO, utente "Prova Uscita", segnalatore Daniele Bedetti e simili) restano di proposito: servono come esempio per formare i colleghi.

## Da dove riprendere: rilascio 3, le sezioni che si sovrappongono

Approvato dall'utente; si fa un pezzo alla volta, ciascuno con prova in anteprima e pubblicazione su main solo dopo il via.

**Rilascio 3 completato e in produzione** (tutti gli otto punti qui sotto). Dopo il rilascio 3, in produzione anche: Scadenzario con contatori come filtri e vista "da fare nei prossimi 30 giorni"; ricerca nei menu a tendina di cliente, bando e progetto; elenchi coerenti (eliminazione dentro la scheda, conferme che rimandano al Registro attività); chiusura di tutte le finestre con la X e con il clic fuori; progetto aperto sopra la scheda del cliente; Note da assegnare con cliente proposto, punti da controllare e archivio. Inoltre: pulizia dei contratti e stato del contratto nella sezione Incarico; contatori corretti e cliccabili nella pagina Progetti; controllo automatico delle pagine dei bandi (vedi sotto).

1. **Segnalatori in un solo posto.**
   - Oggi un segnalatore si inserisce due volte: dal menu Segnalatori (anagrafica con categoria Segnalatori e clienti segnalati) e in Modello 231, Segnalatori e compensi.
   - Proposta: aggiungere nella scheda del segnalatore (ConsulenteDettaglio) una scheda "Accordo e compensi" con il componente 231 filtrato su quel segnalatore, sul modello delle deleghe già mostrate nella pratica.
   - In Modello 231 la scheda diventa un riepilogo con collegamento.
   - Altri interventi: un pulsante "Nuovo segnalatore" nella pagina Segnalatori; "Riepilogo economico" rinominato "Valore dei clienti segnalati"; un solo nome ovunque ("Anagrafica Partner", "Apri dettaglio consulente" e "Spot" vanno sistemati).
2. **Modello 231 ridotto per i collaboratori.**
   - Vedono "I miei adempimenti": la propria dichiarazione degli interessi, la richiesta di deroga, la segnalazione di un conflitto, la propria checklist di ingresso o uscita.
   - Le otto schede restano agli amministratori, e all'OdV in sola lettura.
   - Un contatore nel menu per ciò che c'è da fare: dichiarazione da rinnovare, anomalie in attesa dell'amministratrice unica.
3. **Compensi dei segnalatori.** Un pulsante "Prossimo passo" per ogni compenso, con una piccola sequenza a quattro punti (attestazione, fattura, autorizzazione, pagamento) e pulsanti tutti dello stesso stile; "Cessa" diventa "Chiudi il rapporto".
4. **Report e Ricerche uniti in "Analisi".**
   - Una sola voce di menu con due schede: "Cruscotto" (i grafici dei Report) e "Elenchi e ricerche" (le Ricerche).
   - Esportazione in Excel ovunque.
   - **Urgente prima di gennaio:** nei Report gli anni sono scritti a mano dal 2023 al 2026 (ReportsContent.tsx, circa righe 678-704 e 1221-1226): vanno calcolati dalla data di oggi, altrimenti a gennaio manca il 2027.
   - Filtri dentro le schede che li usano; tolto il titolo doppio in "Scadenze contrattuali".
   - Ricerche: le 12 aree raggruppate in 3-4 gruppi, con un solo stile di icone e testi semplici quando non ci sono risultati. Nel modulo "Crea scadenze in serie": categoria e responsabile da elenco a tendina, etichette senza "template".
5. **"Bandi" e "Catalogo bandi" in un'unica pagina.** Due schede ("Su cui lavoriamo" e "Catalogo"), un pulsante "Lavoriamo su questo bando" che precompila il bando interno, gli stessi nomi di stato nei due elenchi.
6. **Formazione solo dove serve.** La scheda Formazione si mostra solo per i clienti FPI o per chi ha già dati di formazione; le sotto-schede FPI si nascondono senza adesione.
7. **Contributo ottenuto in un solo posto.** Oggi si scrive sia nel progetto sia in Contributi ottenuti. Proposta: importo e data si registrano solo in Contributi e il progetto li mostra in sola lettura, con collegamento.
8. **Guida e assistente aggiornati** (la guida ora sta in `frontend/docs/guida/FAQ_GESTIONALE_EVOLVI.md`, da cui leggono la pagina Aiuto e l'assistente).
   - Togliere "stack tecnologico" ed elenchi di tabelle.
   - Aggiornare menu e impostazioni con i nomi nuovi.
   - Aggiungere Ricerche, Catalogo bandi, Modello 231, Note da assegnare e Segnalatori.
   - Spiegare la scelta sulle email (casella personale e promemoria dal calendario).

### Controllo automatico delle pagine dei bandi: in produzione dal 24/11/2026

- Ogni mattina alle 6 (cron `/api/cron/controllo-bandi`) legge la pagina ufficiale (campo in "Dati Bando") e le altre pagine dei bandi con progetti inviati in attesa del decreto, o accesi a mano nella scheda "Controllo della pagina". Motore in `frontend/src/lib/controlloBandi.ts`, tabelle `scadenze_bandi_controllo_pagine` e `scadenze_bandi_controllo_novita` (migrazione 20261124).
- Novità "graduatoria" (parole chiave) e "documento" (file nuovi); per le graduatorie scadenza "Controllare la graduatoria" ai responsabili dei progetti (responsabile della pratica, altrimenti referente interno) e riquadro "Novità sui bandi" nel Cruscotto.
- Da verificare alla prima graduatoria vera: se l'evento nel calendario dello studio viene creato (dipende dai permessi dell'account Google dello studio).
- Da raccogliere: quali siti degli enti risultano "non controllabili".
- Estensioni decise per dopo una prima prova: ricerca dei clienti (denominazione, partita IVA) nei PDF nuovi; valutazione delle novità dubbie con l'intelligenza artificiale.

### Rimasti dall'analisi, più piccoli

Fatti: Scadenzario, ricerca nei menu a tendina, elenchi coerenti, Note da assegnare, contratti (in prova).
Restano:
- Prospect: valutare se unire "In decisione" e "Preso in carico".
- Cliente: unire davvero dettaglio e modifica in una sola finestra (oggi sono due finestre, ma la modifica torna sul cliente).
- Progetti: le schede numeriche in alto (decreto atteso, ricevuto, in corso, completati) non contano i progetti non ancora inviati; la scheda "Completati" è rossa.

L'utente ha chiesto di fare per ora solo il terzo punto (fatto); gli altri due restano da decidere.

## Rinviati, da decidere

- Controllo giornaliero delle qualifiche scadute (oggi la scadenza si vede nell'elenco, ma non parte un avviso).
- Ricollegamento degli aiuti RNA quando si ripristina un'eliminazione.
- Eliminazione delle tabelle IMAP (1,6 GB, escluse dal backup): serve un via libera esplicito.
- Copie interne dei documenti dei clienti: eliminabili da Impostazioni, Backup e documenti, se non già fatto.
- Domande per l'Avv. Carano annotate in `docs/TODO_RINVIATI.md` (fasi 1 e 2 di PR.01 eliminate; invio con conferma o con delega).
- Le altre voci di `docs/TODO_RINVIATI.md` (Vercel Pro, sicurezza delle altre app sullo stesso progetto Supabase, aggiornamento di Postgres).

## Riferimenti

- Migrazioni, ciascuna con il suo annullamento: `supabase/migrations/` (date 20261119-20261123).
- Moduli 231 preparati (M.01-M.06): `docs/modulistica_231/`.
- Modello dell'ordine di lavoro: `docs/modelli/` e cartella MODELLI su Drive.
- Voci di menu e nomi delle pagine: `frontend/src/lib/navigazione.ts`.
- L'ambiente cloud di Claude non raggiunge Supabase via HTTP: le prove con la sola chiave pubblica si lanciano dal Mac (`bash scripts/prova-chiave-pubblica.sh` dalla cartella `frontend`).
