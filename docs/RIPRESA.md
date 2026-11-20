# Punto di ripresa del lavoro

Aggiornato venerdì 20/11/2026, per la ripresa di lunedì 23/11/2026. Branch di lavoro `claude/stoic-hawking-mf8eph`.

## Dove siamo

**In produzione** (`main`, commit `deedb33`, gestionale.blmproject.com), provato e confermato:

- fasi 1-3 della sicurezza (database chiuso, sessioni revocabili, cookie httpOnly);
- utenti con accesso a termine; backup mensile esportabile, con registro delle prove di ripristino;
- fase 4A: registro delle operazioni non modificabile, con vista sintetica per chi non è tecnico e vista completa;
- fase 4B: ripristino delle eliminazioni dal registro, file compresi (cartella `_cestino` su Drive);
- fase 4C: ruoli admin, collaboratore, collaboratore limitato e OdV; matrice dei permessi configurabile dagli amministratori; "chi genera non approva", con deroga motivata; area dell'OdV in sola lettura;
- pratica di finanza agevolata guidata, passaggi A e B: fasi incarico, progettazione, controllo pre-invio, invio e inviata, con ordine di lavoro generato dal modello in Drive (cartella MODELLI); REV diverso da RP; integrazioni, rendiconti e rettifiche; promemoria in calendario e segnalazione dei ritardi ogni mattina.

**Fatto il 20/11, già attivo nel database:** annullate le 861 email arretrate della coda (stato `annullata`). La coda tornerà a riempirsi finché non si ricollega la casella Gmail di sistema.

**In anteprima, da provare lunedì** (commit `d2e5490`), Registri 231, passaggio 1:
https://gestionale-evolvi-git-claude-st-06f946-filippo-bertins-projects.vercel.app

- Qualifica delle controparti (modulo M.01): checklist distinta per società e persona fisica, allegati su Drive in `MODELLO 231/Qualifiche/<anno>`, scadenza a 12 mesi per i rapporti continuativi, anomalie decise dall'AU.
- Dichiarazioni degli interessi (modulo M.04): ognuno dichiara per sé, la dichiarazione resa non si modifica (si presenta una variazione), la valuta l'AU o un altro amministratore se è dell'AU. All'OdV arriva solo il riepilogo; il contenuto non entra nel registro delle operazioni.
- Registro dei conflitti, con misure e decisione dell'AU.
- Voce "Modello 231" nel menu laterale; scheda "Qualifiche, interessi e conflitti" in sola lettura nell'area dell'OdV.

Le tabelle sono già create nel database di produzione (migrazioni `20261121_registri_231_a` e `20261121_registro_dichiarazioni_riservate`, con script di annullamento). Prima della pubblicazione manca solo l'interfaccia.

## Cosa provare lunedì

L'anteprima scrive nel database di produzione: i dati di prova si possono eliminare dopo il test, ma nel registro delle operazioni resta traccia che sono esistiti.

L'AU è Chiara Canzi (impostazione `utente_au`). Solo lei decide anomalie, valutazioni e conflitti; Filippo, come altro amministratore, decide soltanto quando la persona coinvolta è Chiara. Con l'account di Filippo "In attesa della decisione" è quindi il comportamento corretto.

1. **Account di Filippo, voce Modello 231.**
   - Qualifiche: creare una scheda per una società e una per una persona fisica; controllare che la checklist cambi; caricare un allegato e trovarlo su Drive; salvare una scheda senza anomalie (rapporto continuativo, deve comparire la scadenza) e una con anomalia (deve restare in attesa dell'AU, senza pulsante per decidere).
   - Dichiarazioni: compilare la propria; dopo l'invio non deve essere modificabile; deve comparire l'elenco di chi non ha ancora dichiarato; sulla propria dichiarazione non deve esserci il pulsante di valutazione.
   - Conflitti: annotarne uno di prova collegato a una pratica; se riguarda Chiara si decide, altrimenti resta in attesa.
2. **Account di Chiara:** decidere l'anomalia della qualifica, valutare la dichiarazione di Filippo, decidere il conflitto. Una valutazione con esito "conflitto annotato" deve creare la riga corrispondente nel registro dei conflitti.
3. **"utente prova" (ruolo OdV):** nuova scheda in sola lettura, nessun pulsante per creare o decidere; delle dichiarazioni si vedono solo chi, quando, l'esito e il numero di casi. Nel Registro attività le nuove voci hanno etichette leggibili.

Se tutto va bene: "anteprima testata, tutto ok, pubblica su main".

## Da dove riprendere dopo la pubblicazione

1. **Registri 231, passaggio 2:** deleghe dei clienti con le persone autorizzate (PR.03 §4.2); checklist di ingresso e uscita del personale (modulo M.06), collegate alla disattivazione degli utenti e all'accesso a termine.
2. **Registri 231, passaggio 3:** segnalatori (accordi, attestazione prima del pagamento, compensi) e registro delle deroghe.
3. **Report semestrale all'OdV** precompilato (scadenze 31/07 e 31/01).

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
