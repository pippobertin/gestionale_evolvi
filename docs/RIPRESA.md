# Punto di ripresa del lavoro

Aggiornato il 20/11/2026. Branch di lavoro `claude/stoic-hawking-mf8eph`, allineato a `main` (produzione su gestionale.blmproject.com).

## Dove siamo

**Fase 3 (chiusura del database) conclusa il 20/11/2026.** Tutte le tabelle, le viste, le funzioni di ricerca e gli archivi dei file del gestionale rispondono solo al badge rilasciato al login a un utente attivo. Le sessioni sono revocabili (il logout chiude la sessione nel database), il token vive solo nel cookie httpOnly, il cambio della password temporanea è imposto dal server. Prova finale con la sola chiave pubblica, lanciata dal Mac: 99 controlli, nessuna risorsa accessibile (`bash scripts/prova-chiave-pubblica.sh` dalla cartella `frontend`; l'ambiente cloud di Claude non raggiunge Supabase via HTTP).

Gli script di ogni passaggio, ciascuno con il proprio script di annullamento, sono in `supabase/migrations/` (date 20261119 e 20261120).

## Difetti preesistenti corretti strada facendo (19-20/11)

- contratti di progetto mai tracciati (12 righe ricostruite dai PDF approvati su Drive);
- tabella dei responsabili delle scadenze mai creata; responsabile non mostrato nello scadenzario;
- eventi del calendario "Scadenze Evolvi" mai creati dalla versione online (token Google non rinnovato);
- documenti ereditati dal bando con percorso inesistente (59 riallineati, backup in `gestionale_backup`);
- caricamento manuale dei documenti nei progetti sempre fallito; eliminazione che lasciava il file nell'archivio;
- documenti della formazione indirizzati a un archivio inesistente;
- requisiti della password non visibili nel cambio obbligatorio;
- firma assente nelle email scritte dalla sezione Email; oggetti con lettere accentate storpiati.

Nuove funzioni: Impostazioni → La mia password; Gestione utenti → Reimposta password.

## Piccole cose aperte

- Nell'archivio `progetti-documenti` restano quattro file di progetti eliminati (cartelle `ae11af39...` del novembre 2025 e `15e0ef49...` del febbraio 2026): eliminabili dalla dashboard di Supabase se non servono.

## Prossimi passi possibili

1. **Fase 4, ruoli e tracciabilità per la 231:** permessi per operazione (per esempio solo un amministratore approva i contratti), registro delle operazioni non modificabile, archiviazione al posto delle cancellazioni. Serve un'indicazione del consulente 231 sui tempi di conservazione.
2. **Correzioni funzionali** da `docs/TODO_RINVIATI.md`: dimensione d'impresa, perimetro de minimis, notifiche automatiche (richiedono Vercel Pro), vincoli dei prospect, rimozione della fatturazione Evolvi, caricamento su Drive dei documenti dei bandi.
3. **Sicurezza delle altre app** sullo stesso progetto Supabase (tabelle e archivi file ancora aperti).
4. **Funzioni dal materiale di Stefano** (processi, cartelle Drive per processo, controllo documenti, cervello aziendale).
