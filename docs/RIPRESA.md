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

## Correzioni funzionali del 20/11/2026 (in produzione)

- Dimensione d'impresa secondo la Raccomandazione 2003/361/CE: regola "ULA e (fatturato oppure attivo)", dati mancanti = non determinabile (prima 208 clienti risultavano GRANDE), associate e collegate allineate alla norma, impresa unica del de minimis con le sole imprese controllate (anche indirettamente).
- Storico per esercizio (`scadenze_bandi_clienti_esercizi`), regola dei due esercizi consecutivi e registro non modificabile delle modifiche (`scadenze_bandi_clienti_dati_log`); dati attuali attribuiti al 2025.
- Registra contratto firmato (progetti ed Evolvi): file su Drive accanto al contratto approvato, data, canale, autore; solleciti bloccati per i firmati.
- Fatturazione Evolvi rimossa; riconversione cliente → prospect solo per amministratori, con conferma.
- Documenti dei bandi: copia su Drive nella cartella giusta e nel cestino di Drive quando si eliminano dal gestionale.
- Scadenze della formazione, stato predefinito dei prospect, trigger del calendario corretti.

## Piccole cose aperte

- Nell'archivio `progetti-documenti` restano quattro file di progetti eliminati (cartelle `ae11af39...` del novembre 2025 e `15e0ef49...` del febbraio 2026): eliminabili dalla dashboard di Supabase se non servono.

## Prossimi passi possibili

0. **Ancora aperti tra le correzioni:** filtri di Interrogazioni sulla dimensione riconosciuta (oggi usano l'ultimo esercizio); notifiche automatiche delle scadenze (richiedono Vercel Pro, rinviate); eventuale eliminazione della tabella vuota delle fatture Evolvi.
1. **Fase 4, ruoli e tracciabilità per la 231** (comprende la pagina dei registri per gli amministratori, vedi `docs/TODO_RINVIATI.md`): permessi per operazione (per esempio solo un amministratore approva i contratti), registro delle operazioni non modificabile, archiviazione al posto delle cancellazioni. Serve un'indicazione del consulente 231 sui tempi di conservazione.
2. **Correzioni funzionali:** quelle elencate in `docs/TODO_RINVIATI.md` sono state fatte il 20/11/2026, tranne quelle del punto 0.
3. **Sicurezza delle altre app** sullo stesso progetto Supabase (tabelle e archivi file ancora aperti).
4. **Funzioni dal materiale di Stefano** (processi, cartelle Drive per processo, controllo documenti, cervello aziendale).
