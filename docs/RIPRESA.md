# Punto di ripresa del lavoro

Branch di lavoro `claude/stoic-hawking-mf8eph`. Aggiornato il 24/11/2026.

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

**Già in produzione:** punti 1, 2, 3, 4 e 5 (segnalatori in un solo posto con accordo e compensi nella loro scheda; Modello 231 con la scheda "Da fare" e il contatore nel menu; Analisi; Bandi e Catalogo in un'unica pagina con "Lavoriamo su questo bando"). Restano i punti 6, 7 e 8.

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
8. **Guida e assistente aggiornati** (`docs/chatbot/FAQ_GESTIONALE_EVOLVI.md`, da cui l'assistente prende le risposte).
   - Togliere "stack tecnologico" ed elenchi di tabelle.
   - Aggiornare menu e impostazioni con i nomi nuovi.
   - Aggiungere Ricerche, Catalogo bandi, Modello 231, Note da assegnare e Segnalatori.
   - Spiegare la scelta sulle email (casella personale e promemoria dal calendario).

### Dopo il rilascio 3: controllo automatico delle pagine dei bandi (richiesto il 24/11/2026)

Avviso quando sul sito dell'ente compare una graduatoria. Proposta da confermare con l'utente prima di partire:
- per ogni bando con progetti in attesa del decreto, uno o più indirizzi da controllare (la pagina del bando e, se serve, la pagina delle notizie o degli esiti dell'ente);
- controllo una volta al giorno: si confrontano i collegamenti e i documenti della pagina con quelli già visti, si seguono le sottopagine dello stesso sito che parlano di esiti, graduatorie o notizie (al massimo poche per bando);
- segnalazione quando compare un documento o una notizia con parole come graduatoria, elenco degli ammessi, esiti, decreto di concessione; in una seconda fase, lettura dei PDF nuovi alla ricerca dei clienti (denominazione o partita IVA);
- avviso coerente con la scelta sulle email: scadenza "Controllare la graduatoria" nello Scadenzario al responsabile del progetto (quindi anche nel calendario) e riquadro nel Cruscotto, con i pulsanti "È la graduatoria" e "Non interessa";
- limiti da dire chiaramente: siti che caricano i contenuti con JavaScript, portali con accesso riservato, protezioni anti-robot; per questi la pagina risulta "non controllabile" e resta il controllo a mano.
- Oggi nessuno dei 5 bandi dello studio ha il link compilato: va inserito per quelli in attesa del decreto.

### Rimasti dall'analisi, più piccoli (da inserire dove capita)

- Prospect: valutare se unire "In decisione" e "Preso in carico".
- Cliente: unire davvero dettaglio e modifica in una sola finestra (oggi sono due finestre, ma la modifica torna sul cliente).
- Progetti: le schede numeriche in alto (decreto atteso, ricevuto, in corso, completati) non contano i progetti non ancora inviati; la scheda "Completati" è rossa.
- Elenchi coerenti tra clienti, progetti e bandi: clic sulla riga per aprire la scheda (in Bandi oggi non fa nulla), "Nuovo…" in alto a destra, eliminazione solo dentro la scheda.
- Scadenzario: schede numeriche cliccabili come filtri, vista predefinita "da fare nei prossimi 30 giorni", stessi nomi di stato in elenco e modulo ("Da fare" e "Non iniziata"), "Annullata" anche nel filtro.
- Cliente e bando con ricerca nel menu a tendina del nuovo progetto.
- Note da assegnare: dire dove finiscono le note interne, mostrare le verifiche suggerite o togliere il contatore, proporre il cliente in automatico dal titolo.
- Contratti: eliminare `ContractTrackingPanel` e `SignedContractUploadForm` se non usati, e "tracking" diventa "stato del contratto". ContractModal: titolo diverso per chi prepara solo la bozza, "Anteprima" diventa "Avanti: controlla i dati".
- Pratica: spostare lo stato del contratto dalla scheda Documenti alla sezione Incarico.

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
