# Punto di ripresa del lavoro

Aggiornato la sera del 19/11/2026. Branch di lavoro `claude/stoic-hawking-mf8eph`, allineato a `main` al commit `58686a8` (produzione su gestionale.blmproject.com).

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

## Prossimo passo: fase 3, passaggio F (pulizia finale)

1. **Token di sessione solo nel cookie protetto.** Oggi il token è salvato anche nel `localStorage` e letto in 6 file (17 punti): `AuthContext` e le chiamate che mandano l'intestazione `Authorization`. Vanno tutte portate sul cookie httpOnly, già inviato in automatico dal browser.
2. **Logout con revoca effettiva** del token lato server (oggi resta valido fino alla scadenza di 7 giorni).
3. **Cambio password al primo accesso** imposto anche dal server, non solo dall'interfaccia.
4. **Prova conclusiva** con la sola chiave pubblica su tabelle, viste, funzioni e file.

Come per gli altri passaggi: anteprima, prova, poi produzione.

## Dopo il passaggio F

- Eliminazione di un documento di progetto caricato a mano: oggi cancella solo la riga e lascia il file nell'archivio (per i documenti ereditati il file è quello del bando e non va mai cancellato).
- Firma email anche nella sezione Email (oggi le email partono come testo semplice, senza firma).
- Recupero degli eventi di calendario per le scadenze future create tra aprile e novembre 2026.
- Le voci di `docs/TODO_RINVIATI.md`: fase 4 (ruoli, registro operazioni, archiviazione al posto delle cancellazioni), correzioni funzionali (dimensione d'impresa, de minimis, notifiche, prospect), sicurezza delle altre app sullo stesso progetto Supabase, funzioni del materiale di Stefano.
