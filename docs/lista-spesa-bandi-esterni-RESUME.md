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

## PROSSIMO: Fase B — alimentare "bandi esterni" dalle email

Obiettivo: invece dell'ingest manuale, leggere automaticamente gli alert Agevolando
che arrivano su **paladini@blmproject.com** e popolare il catalogo
`scadenze_bandi_bandi_esterni`.

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
