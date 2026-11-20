# Punto di ripresa del lavoro

Aggiornato il 20/11/2026. Branch di lavoro `claude/stoic-hawking-mf8eph`, allineato a `main` (produzione su gestionale.blmproject.com).

## Dove siamo

La chiusura del database (fase 3) è completa per i passaggi A, B, C, D ed E: tutte le tabelle, le viste, le funzioni di ricerca e gli archivi dei file del gestionale rispondono solo al badge rilasciato al login a un utente attivo. La chiave pubblica da sola non legge e non scrive nulla del gestionale. Gli script di ogni passaggio, con il relativo script di annullamento, sono in `supabase/migrations/` con data 20261119.

Durante le prove del 19/11 sono stati corretti anche difetti preesistenti emersi strada facendo:

- contratti di progetto mai tracciati (12 righe ricostruite dai PDF approvati su Drive);
- tabella dei responsabili delle scadenze mai creata; responsabile non mostrato nello scadenzario;
- eventi del calendario "Scadenze Evolvi" mai creati dalla versione online (token Google non rinnovato);
- breve intervallo senza badge dopo login o logout;
- documenti ereditati dal bando con percorso inesistente (59 riallineati, backup in `gestionale_backup`);
- caricamento manuale dei documenti nei progetti sempre fallito (categoria e campi obbligatori);
- documenti della formazione indirizzati a un archivio inesistente.

## Prima cosa da fare domattina

1. **Verifica in produzione dell'ultimo aggiornamento** (`58686a8`): nella scheda formazione di un cliente caricare, scaricare ed eliminare un documento; in un progetto aprire un documento ereditato e caricarne uno nuovo.
2. **File orfani in `progetti-documenti`.** Supabase non consente di cancellarli dal database: si eliminano dalla dashboard (Storage, bucket `progetti-documenti`) oppure dal gestionale dopo la correzione al punto 3 della sezione successiva. File delle prove del 19/11, da eliminare:
   - `895d0c7a-1d20-4824-8ff8-82d6ddeab4ab/1795107345372_bando-dt-2026-allegato.pdf` (MILLENERGIE)
   - `3fcc5d08-2500-4f23-ae0e-4155fcb890cb/1795107871874_bando-dt-2026-allegato.pdf` (MW ANCONA)
   - `3fcc5d08-2500-4f23-ae0e-4155fcb890cb/1795107897240_Contributi_AUTOTRASPORTI-CANNATA-MICHELE-CANNATA_2026-11-19.pdf` (MW ANCONA)
   - `3fcc5d08-2500-4f23-ae0e-4155fcb890cb/1795108027645_Contributi_AUTOTRASPORTI-CANNATA-MICHELE-CANNATA_2026-11-19.pdf` (MW ANCONA, la prova riuscita poi eliminata dall'elenco)

   Altri cinque file senza riga nel database risalgono a caricamenti falliti tra novembre 2025 e maggio 2026; tra questi `e71655ec-d08f-4af0-9aad-665948877c02/1779432141005_Modul_C.pdf` del progetto TRE GELSI, che potrebbe essere un documento vero da ricollegare al progetto. Da decidere caso per caso, non eliminare alla cieca.

## Passaggio F (20/11/2026)

Pubblicato in produzione: sessioni revocabili (il logout chiude la sessione nel database), token solo nel cookie httpOnly, cambio della password temporanea imposto dal server, badge del database ridotto a 15 minuti, Impostazioni → La mia password, Gestione utenti → Reimposta password, requisiti della password visibili. Chi entra con email e password ha dovuto rifare il login una volta.

Prova finale con la sola chiave pubblica, lanciata dal Mac il 20/11/2026: 99 controlli chiusi, nessuno aperto (`bash scripts/prova-chiave-pubblica.sh` dalla cartella `frontend`; l'ambiente cloud di Claude non raggiunge Supabase via HTTP). Login Google in produzione verificato: una sola sessione per accesso, riusata tra le pagine. **La fase 3 è conclusa.**

## Dopo il passaggio F

- Eliminazione di un documento di progetto caricato a mano: oggi cancella solo la riga e lascia il file nell'archivio (per i documenti ereditati il file è quello del bando e non va mai cancellato).
- Firma email anche nella sezione Email (oggi le email partono come testo semplice, senza firma).
- Recupero degli eventi di calendario per le scadenze future create tra aprile e novembre 2026.
- Le voci di `docs/TODO_RINVIATI.md`: fase 4 (ruoli, registro operazioni, archiviazione al posto delle cancellazioni), correzioni funzionali (dimensione d'impresa, de minimis, notifiche, prospect), sicurezza delle altre app sullo stesso progetto Supabase, funzioni del materiale di Stefano.
