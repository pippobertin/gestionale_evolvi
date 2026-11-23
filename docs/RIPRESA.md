# Punto di ripresa del lavoro

Branch di lavoro `claude/stoic-hawking-mf8eph`.

## Dove siamo

Aggiornato il 23/11/2026. **In produzione** (`main`), provato e confermato:

- fasi 1-4 della sicurezza e della tracciabilità (database chiuso, registro delle operazioni, ripristino, ruoli e permessi configurabili, area dell'OdV);
- utenti con accesso a termine; backup mensile con registro delle prove di ripristino;
- pratica di finanza agevolata guidata, passaggi A e B;
- Registri 231 (menu Modello 231, in sola lettura anche per l'OdV):
  - passaggio 1: qualifica delle controparti (M.01), dichiarazioni degli interessi (M.04), registro dei conflitti;
  - passaggio 2: deleghe dei clienti con persone autorizzate e riesame semestrale; checklist di ingresso e uscita (M.06), con promemoria in calendario e uscita automatica dagli elenchi delle deleghe per chi viene disattivato o ha l'accesso scaduto;
  - passaggio 3: segnalatori (qualifica, accordo con clausola 231 approvato dall'AU) e compensi (attestazione, fattura, autorizzazione dell'AU, pagamento); registro delle deroghe, con quelle già registrate dal gestionale.

Le email arretrate della coda sono annullate; la coda si riempie di nuovo finché non si ricollega la casella Gmail di sistema.

I dati di prova (delega "restart" su AAAAPIPPO, utente "Prova Uscita", segnalatore Daniele Bedetti e simili) restano di proposito: servono come esempio per formare i colleghi.

- Report semestrale all'OdV (M.05): bozza precompilata dai registri, preparata da sola alla chiusura del semestre, sezioni confermate dai responsabili, invio dell'AU con PDF su Drive; promemoria ricorrenti in calendario. La bozza del 2° semestre 2026 è già preparata: va completata e inviata entro il 31/01/2027 (prima "Aggiorna i dati dai registri").
- La sezione "Consulenti" e la categoria omonima in anagrafica si chiamano ora "Segnalatori" (il codice interno della categoria resta CONSULENTI).

## Da dove riprendere

L'utente ha altre richieste da indicare.

## Rinviati, da decidere

- Ricollegare la casella Gmail di sistema, per svuotare la coda delle email.
- Controllo giornaliero delle qualifiche scadute (oggi la scadenza si vede nell'elenco, ma non parte un avviso).
- Ricollegamento degli aiuti RNA quando si ripristina un'eliminazione.
- Eliminazione delle tabelle IMAP (1,6 GB, escluse dal backup): serve un via libera esplicito.
- Domande per l'Avv. Carano annotate in `docs/TODO_RINVIATI.md` (fasi 1 e 2 di PR.01 eliminate; invio con conferma o con delega).
- Le altre voci di `docs/TODO_RINVIATI.md` (Vercel Pro, sicurezza delle altre app sullo stesso progetto Supabase, aggiornamento di Postgres).

## Riferimenti

- Migrazioni, ciascuna con il suo annullamento: `supabase/migrations/` (date 20261119-20261121).
- Moduli 231 preparati (M.01-M.06): `docs/modulistica_231/`.
- Modello dell'ordine di lavoro: `docs/modelli/` e cartella MODELLI su Drive.
- L'ambiente cloud di Claude non raggiunge Supabase via HTTP: le prove con la sola chiave pubblica si lanciano dal Mac (`bash scripts/prova-chiave-pubblica.sh` dalla cartella `frontend`).
