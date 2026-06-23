# Lista della spesa + Bandi esterni — punto di ripresa

Ultimo aggiornamento: 2026-06-19
Branch di lavoro: `feat/lista-spesa-bandi-esterni` (NON pushata, main intatta)
Design doc completo: `~/.gstack/projects/pippobertin-gestionale_evolvi/filippobertin-main-design-20260619-173447.md`

---

## Cos'è questa feature

Registrare le esigenze di un cliente ("lista della spesa": vuole un macchinario,
formazione, fotovoltaico…) e confrontarle automaticamente con bandi esterni
provenienti dal servizio di scouting in abbonamento **Agevolando.eu**, per
suggerire al consulente i bandi pertinenti per ogni cliente.

Idea chiave: Agevolando usa un vocabolario chiuso di **14 categorie** ("Tipologia
di investimento"). Usando le stesse 14 voci sia per la checklist del cliente sia
per il tag del bando, il match è **deterministico** (intersezione di insiemi),
non fuzzy.

---

## STATO: Fase A — FATTA, testata, migrazione eseguita in Supabase

Loop completo funzionante: aggiungi bando al catalogo → compila lista della spesa
del cliente → il bando compare tra i "Bandi suggeriti" se le categorie combaciano.

### File creati / modificati (Fase A)

Database
- `docs/sql/add_lista_spesa_bandi_esterni.sql` — migrazione (già eseguita in Supabase)
  - `scadenze_bandi_clienti_esigenze` — lista della spesa (`categorie text[]` + `descrizione`)
  - `scadenze_bandi_bandi_esterni` — catalogo condiviso bandi esterni
  - `scadenze_bandi_clienti_bandi_esterni` — override per-cliente (`scartato`/`convertito`)
  - indici GIN su `categorie` e `investimenti_spesati` (per l'operatore `&&`)
  - RPC `match_bandi_esterni_per_cliente(p_cliente_id)` — `STABLE`, eredita RLS
  - trigger `update_updated_at_column`, RLS "allow all authenticated" come nel repo

App / libreria
- `frontend/src/lib/tipologieInvestimento.ts` — le 14 voci come vocabolario unico
  + `normalizzaCategorie()` per filtrare output LLM sulle voci ammesse. **Se Agevolando
  cambia le voci, si aggiorna SOLO qui.**

API (Anthropic `claude-haiku-4-5-20251001`, auth `verifyJWT` da cookie)
- `frontend/src/app/api/bandi-esterni/extract/route.ts` — estrae i campi di un bando
  da testo incollato (titolo, tipologia_aiuto, investimenti_spesati[], stato,
  data_scadenza, territorio, destinatari, settori, url). Output normalizzato.
- `frontend/src/app/api/esigenze/extract/route.ts` — da un testo libero suggerisce
  `categorie[]` (subset delle 14) + `descrizione`.

UI
- `frontend/src/components/ListaSpesa.tsx` — usato nel tab Gestione cliente:
  - blocco "Lista della spesa": checklist 14 categorie + descrizione + pulsante
    "Suggerisci categorie dal testo" (chiama `/api/esigenze/extract`)
  - blocco "Bandi suggeriti": chiama la RPC, evidenzia in verde le categorie che
    corrispondono alle esigenze attive, azioni scarta/ripristina per cliente,
    avviso "uso interno"
- `frontend/src/components/BandiEsterniManager.tsx` — sezione globale "Bandi esterni":
  catalogo + ingest manuale assistito (incolla alert → "Estrai campi con AI" → rivedi
  → salva), filtro stato, edit/elimina
- Aggancio: `ClienteDettaglio.tsx` (tab Gestione, dopo NoteTimeline),
  `Sidebar.tsx` (voce "Bandi esterni", icona Landmark),
  `page.tsx` (import + case in getPageTitle/getBreadcrumb/renderContent)

### Decisioni prese (Fase A)
- Override del match reso **a livello cliente** (`cliente_id + bando_esterno_id`),
  non per-esigenza come nel design originale: coerente col match aggregato per cliente.
- Conversione **match → progetto** NON implementata (Open Question #3): tocca il
  flusso bando→progetto esistente, da decidere insieme. Per ora: link "Vedi dettagli"
  + scarto. La colonna `progetto_id` e lo stato `convertito` esistono già in tabella.
- Filtro del match basato su `stato='attivo'` del bando, NON su `data_scadenza`
  (la scadenza esatta non è negli alert; è best-effort).

### Vincolo legale (presidiato)
Contenuti Agevolando = uso interno (siamo abbonati). Vietata redistribuzione verbatim
ai clienti via email/PDF. In UI c'è l'avviso "uso interno"; da NON includere mai il
testo `raw_payload`/verbatim nei template email/PDF verso cliente.

---

## FASE B — SCAFFOLD FATTO (server-side, Forma B). Da tarare su email reali + collegare il trigger.

Obiettivo: invece dell'ingest manuale, leggere automaticamente gli alert Agevolando
che arrivano su **paladini@blmproject.com** e popolare il catalogo
`scadenze_bandi_bandi_esterni`.

### Decisione presa: Forma B (job server-side, non la pagina email)
Scoperta chiave: il token Gmail di Paladini e' GIA' salvato nel gestionale
(`scadenze_bandi_utenti.gmail_email/gmail_refresh_token`, usato dalla pagina email).
Quindi NON serve service account / delega domain-wide: il job legge la sua casella
lato server con `getGmailClient(userId)`, riusando quel token. La pagina email e'
"pull all'apertura" (nessun listener live), percio' un trigger dentro la pagina
scatterebbe solo a pagina aperta -> scartato in favore del job server.

### File creati (Fase B)
- `frontend/src/lib/bandiEsterniExtract.ts` — logica di estrazione condivisa.
  `extractBandoFromText()` (1 bando) + `extractBandiFromText()` (N bandi da 1 email,
  approccio "corpo intero -> LLM -> array"). Prompt e normalizzazione (14 voci) in
  un solo posto. `/api/bandi-esterni/extract` ora importa da qui (niente duplicazione).
- `frontend/src/app/api/bandi-esterni/ingest-gmail/route.ts` — il job. Auth
  `x-ingest-secret == INGEST_SECRET` (come le note). Risolve l'utente del feed,
  lista email `from:bandi@agevolando.eu`, per ciascuna: dedup su `email_msg_id` ->
  estrai corpo MIME (text/plain, fallback html->testo con link preservati) ->
  `extractBandiFromText` -> insert multipli. Supporta `{ maxResults, q, dryRun }`.
  `raw_payload` tiene solo metadati (msg id, oggetto), MAI verbatim (vincolo legale).

### Env da impostare (non ancora in .env.local)
- `INGEST_SECRET` — secret della route (riusa quello delle note se gia' su Vercel).
- `AGEVOLANDO_FEED_EMAIL` — opz., default `paladini@blmproject.com`.
- `AGEVOLANDO_SENDER` — opz., default `bandi@agevolando.eu`.
- `AGEVOLANDO_GMAIL_USER_ID` — opz., override esplicito dell'utente del feed
  (altrimenti lookup per `gmail_email`).

### Come testare (dryRun, NON scrive su DB)
Prerequisito: Paladini ha collegato la sua Gmail dalla pagina email del gestionale.
```
curl -X POST http://localhost:3000/api/bandi-esterni/ingest-gmail \
  -H "x-ingest-secret: $INGEST_SECRET" -H "Content-Type: application/json" \
  -d '{"dryRun": true, "maxResults": 5}'
```
Ritorna i bandi estratti per email (campo `details[].estratti`): serve a tarare il
parsing sull'HTML reale prima di scrivere. Togli `dryRun` per l'ingest vero.

### Calibrazione su email reali — FATTA (3 .eml forniti)
Test su 3 alert reali (forniti come Fwd; in prod arrivano diretti da
bandi@agevolando.eu sulla casella di Paladini). Estrazione multi-bando OK:
3 / 5 / 1 bandi, titoli corretti, categorie mappate sulle 14 voci, URL "Vedi dettagli"
catturati. `data_scadenza` sempre null (atteso: non e' negli alert).
- BUG DI PRODUZIONE TROVATO E CORRETTO: `htmlToText` racchiudeva gli URL in `<...>`
  e lo strip dei tag li rimuoveva -> `url_dettagli` sarebbe stato sempre null.
  Ora usa parentesi `(url)`. (route ingest-gmail)
- Stato 'in_apertura' aggiunto: gli alert includono bandi "Aprira' il <data>".
  Decisione presa: MOSTRARLI in anticipo nei suggeriti, con etichetta distinta
  (badge ambra "In apertura"). Vedi sotto la migrazione da applicare.

### Migrazione `in_apertura` — APPLICATA in Supabase
`docs/sql/add_stato_in_apertura_bandi_esterni.sql` — eseguita. CHECK su `stato`
allargato e RPC `match_bandi_esterni_per_cliente` ora matcha `IN ('attivo','in_apertura')`.

### Test sul vivo + backfill — FATTI (casella reale di Paladini)
- `INGEST_SECRET` generato e in `frontend/.env.local` + `.env.local` (gitignorati).
- dryRun su 9 email/120gg: 19 bandi, 0 errori, stati 10 attivo / 9 in_apertura.
- Route parallelizzata (mapLimit, CONCURRENCY=4) + isolamento errori per-email.
- BACKFILL REALE eseguito (120gg): **16 bandi scritti** in
  `scadenze_bandi_bandi_esterni` con `fonte='agevolando'`, `email_msg_id`, `created_by='agevolando-ingest'`.
- Idempotenza verificata: re-run = 0.96s, 8 email skipped, 0 doppioni (il dedup
  su `email_msg_id` gira PRIMA della chiamata LLM).
- Performance: backfill iniziale ~150s (LLM token/min rate limit; la concorrenza
  aiuta poco). A regime: giro a vuoto ~1s, +~15s per ogni email nuova. Per Vercel
  Cron (timeout) fare il primo backfill a lotti; n8n self-hosted non ha il problema.

### TRIGGER — Vercel Cron IMPLEMENTATO
- `frontend/vercel.json`: cron giornaliero `0 6 * * *` (UTC) -> 8:00 ora legale
  italiana (in inverno cadra' alle 7:00; se serve preciso, spostare a `0 7 * * *`).
- La route ora ha un handler `GET` (Vercel Cron fa GET) oltre al `POST`.
  Auth doppia (`isAuthorized`): `x-ingest-secret: <INGEST_SECRET>` (n8n/manuale)
  OPPURE `Authorization: Bearer <CRON_SECRET>` (Vercel lo inietta in automatico
  se la env CRON_SECRET e' impostata sul progetto).
- GET di default: `newer_than:2d`, `maxResults:10` (finestra stretta -> giro veloce,
  il dedup salta le gia' viste). `export const maxDuration = 60` (tetto Hobby).
- DA FARE su Vercel prima del deploy: impostare le env del progetto
  `INGEST_SECRET`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `AGEVOLANDO_FEED_EMAIL` (opz).
  Il backfill grosso resta da fare a lotti manuali (non dal cron, per il timeout 60s).

### Ancora da fare (Fase B)
- Integrare il match bandi↔clienti nella pagina Interrogazioni ("Ricerche") come
  nuovo ambito su una vista DB (vedi proposta in fondo).
- Decidere gestione "Bando Aggiornato": oggi dedup SOLO a livello email
  (`email_msg_id`); una ri-segnalazione con nuovo msg id crea un nuovo record.
  Eventuale dedup per titolo/upsert = rifinitura futura.

### Contesto storico (pre-scaffold)

### Cosa sappiamo già della fonte
- Mittente: `bandi@agevolando.eu`
- Oggetto tipo: `Segnalazione bandi del GG/MM/AAAA`
- Corpo HTML con N "card", ogni card contiene: **Titolo**, **Tipologia**,
  **Investimenti spesati** (una delle 14 voci), **Apertura** (stato), bottone
  "Vedi dettagli" (link). Più bandi per email.
- Campi NON presenti nell'alert (stanno solo dietro "Vedi dettagli"/PDF):
  territorio, destinatari, scadenza esatta. Per il match di Fase A bastano i campi
  dell'alert.
- L'indirizzo del feed resta **paladini@blmproject.com** (cambiabile in futuro se
  Paladini lascia: si modifica nel filtro mittente/casella).

### Architettura proposta (gemella del flusso note da Drive)
1. Job che legge via Gmail la casella, filtrando mittente `bandi@agevolando.eu`.
2. Per ogni email nuova: parsing delle card → per ciascuna estrai i campi
   (riusa la logica di `/api/bandi-esterni/extract`, eventualmente passando il
   testo/HTML della singola card).
3. Insert in `scadenze_bandi_bandi_esterni` con `fonte='agevolando'`,
   `email_msg_id` valorizzato (la colonna esiste già, serve per il **dedup**).
4. Idempotenza: se `email_msg_id` (o `email_msg_id`+titolo) già presente, skip.
5. I match per cliente si aggiornano da soli (la RPC è una vista live).

### Punti da verificare a inizio Fase B (NON ancora esplorati a fondo)
- **Come è integrato Gmail nel gestionale**: c'è `getGmailClient(userId?)`
  (vedi memory di progetto). Verificare:
  - dove/come sono salvati i token OAuth degli utenti (tabella?)
  - se paladini@blmproject.com ha già autorizzato Gmail nel gestionale (serve il suo
    token, oppure usare un service account con delega domain-wide?)
  - se l'account Google è workspace BLM con delega domain-wide → si può leggere la
    casella senza far loggare Paladini (preferibile per robustezza)
- **Trigger del job**: il repo ha già un meccanismo di scheduling/cron? Cercare
  Vercel cron (`vercel.json`), oppure route chiamata da n8n (come l'ingest note via
  `/api/notes/ingest` con header secret). Probabilmente la strada più semplice e
  coerente è: **route `/api/bandi-esterni/ingest-gmail` protetta da secret, chiamata
  periodicamente da n8n** (stesso pattern già usato per le note).
- **Parsing HTML delle card**: capire la struttura HTML esatta di un alert reale
  (chiedere a Paladini/utente 2-3 email reali, già citato come "assignment" nel design).
  Decidere se: (a) regex/cheerio sull'HTML per isolare le card, poi LLM per
  normalizzare; oppure (b) passare l'intero corpo testuale all'LLM chiedendo un
  array di bandi. (b) è più semplice e robusto al cambio layout.
- **Estrazione multi-bando**: oggi `/api/bandi-esterni/extract` ritorna UN bando.
  Per la Fase B serve una variante che ritorni un **array** di bandi da un'email.

### Decisioni da prendere con l'utente (Fase B)
1. Lettura casella: token utente di Paladini vs service account con delega
   domain-wide (workspace BLM).
2. Trigger: n8n che chiama una route protetta (consigliato, coerente con le note)
   vs Vercel cron vs polling.
3. Cosa fare degli alert che non matchano nessun cliente: salvare comunque nel
   catalogo (sì, è il catalogo condiviso) o scartare.
4. Gestione "Bando Aggiornato" (le card hanno un badge): aggiornare il record
   esistente o crearne uno nuovo.

---

## Come far ripartire l'ambiente
- Branch: `git checkout feat/lista-spesa-bandi-esterni`
- Dev server: `cd frontend && npm run dev` (http://localhost:3000)
- Migrazione SQL: già applicata; il file resta in `docs/sql/` (idempotente).
- Type check mirato: `cd frontend && ./node_modules/.bin/tsc --noEmit`
  (NB: nel progetto esistono errori TS pre-esistenti in altri file, non legati a
  questa feature).
