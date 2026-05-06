# Prompt di istruzioni per Claude Code — Chatbot interno Gestionale Evolvi

> Copia/incolla il contenuto sotto (dalla riga "INIZIO PROMPT" alla riga "FINE PROMPT") in una nuova sessione Claude Code, con la cartella `gestionale_evolvi/` aperta in VS Code. Il prompt guida Claude Code nella costruzione di un chatbot interno che risponde ai colleghi sul funzionamento del gestionale.

---

## Contesto e obiettivo

Serve implementare un chatbot assistente integrato nel gestionale Evolvi. Il chatbot deve aiutare i collaboratori a trovare rapidamente risposte su come si usa l'applicazione, rispondendo a domande del tipo "come faccio a...?", "dove trovo...?", "come funziona...?".

La knowledge base completa è già stata scritta nel file `docs/chatbot/FAQ_GESTIONALE_EVOLVI.md`. Il chatbot deve usare quel file come unica fonte di verità.

Lo stack del progetto è Next.js 16 + TypeScript + Tailwind + Supabase. L'autenticazione è già gestita tramite `AuthContext` (JWT in localStorage oppure Google OAuth). Il backend espone API routes in `frontend/src/app/api/`.

---

## INIZIO PROMPT

Sei un ingegnere senior Next.js. Lavoriamo nel progetto "Gestionale Evolvi" (cartella `gestionale_evolvi/`). Devi implementare un chatbot interno di assistenza per i colleghi BLM, integrato nell'app. Leggi sempre `docs/chatbot/FAQ_GESTIONALE_EVOLVI.md` come fonte di verità per le risposte.

### Requisiti funzionali

1. Widget fluttuante sempre disponibile nell'app autenticata (non deve apparire nella pagina di login). Icona chat in basso a destra, apre un pannello con cronologia messaggi, input testo, pulsante invio.
2. L'utente scrive una domanda, il chatbot risponde in italiano, in tono discorsivo, citando la sezione della FAQ da cui ha tratto la risposta (es. "Vedi sezione Clienti della FAQ").
3. Se la domanda non è coperta dalla knowledge base, il chatbot lo dichiara chiaramente e suggerisce di contattare un amministratore oppure di consultare la FAQ completa (mostrando un link al file).
4. Deve restare coerente con i ruoli: quando la risposta riguarda funzionalità admin, il chatbot lo segnala ("Questa funzione è disponibile solo per gli amministratori").
5. Deve tracciare una cronologia della conversazione per sessione, con possibilità di "nuova conversazione".
6. Persistenza leggera in localStorage per conservare l'ultima conversazione finché il browser non viene chiuso.

### Requisiti non funzionali

- Nessuna dipendenza da servizi esterni ad alta latenza: usare l'API di Anthropic direttamente (Claude Sonnet 4.5 o Haiku 4.5 a scelta per costi).
- Nessun dato personale del cliente deve essere inviato al modello: il chatbot usa solo la knowledge base.
- Le risposte devono rispettare il tono del file `FAQ_GESTIONALE_EVOLVI.md` (italiano professionale e discorsivo, niente emoji, frasi complete).

### Architettura richiesta

1. **Knowledge base**
   - La fonte unica è `docs/chatbot/FAQ_GESTIONALE_EVOLVI.md`.
   - Caricala a build time (usare `fs.readFileSync` in una API route) oppure creare uno script di preprocessing che salva il contenuto in un modulo TypeScript.
   - Evitare di includere il file nel bundle client: il testo deve restare lato server.

2. **API route `POST /api/chatbot`**
   - Path: `frontend/src/app/api/chatbot/route.ts`.
   - Autenticata con lo stesso middleware/JWT già usato dalle altre API (`lib/jwtAuth.ts`).
   - Riceve `{ messages: ChatMessage[] }` dove `ChatMessage = { role: 'user' | 'assistant', content: string }`.
   - Costruisce la richiesta al modello con:
     - system prompt: istruzioni del chatbot (vedi sotto).
     - injection della knowledge base completa come contesto.
     - conversazione utente/assistente.
   - Chiama l'API di Anthropic (SDK `@anthropic-ai/sdk`) con variabile d'ambiente `ANTHROPIC_API_KEY`.
   - Restituisce `{ role: 'assistant', content: string }`.
   - Gestione errori: 401 se token mancante, 429 se rate limited, 500 altrimenti con messaggio utente-friendly.

3. **System prompt del chatbot**
   Usare questo testo (in italiano, senza emoji, tono discorsivo):

   > "Sei l'assistente interno del Gestionale Evolvi di BLM. Aiuti colleghi italiani a capire come usare la piattaforma. Rispondi in italiano, in tono discorsivo e professionale, senza elenchi puntati decorativi. Basa sempre le risposte sul contenuto della knowledge base fornita qui sotto, senza inventare funzioni inesistenti. Quando citi una sezione scrivi 'Vedi sezione {nome sezione} della FAQ'. Se la domanda non è coperta dalla knowledge base, dillo esplicitamente e invita l'utente a contattare un amministratore. Per funzioni riservate agli admin, segnalalo. Evita frasi conclusive stereotipate, non usare emoji, non usare triplette di aggettivi.
   >
   > KNOWLEDGE BASE:
   > {contenuto integrale del file FAQ_GESTIONALE_EVOLVI.md}"

4. **Componente React `ChatbotWidget`**
   - Path: `frontend/src/components/ChatbotWidget.tsx`.
   - Client component (`'use client'`).
   - Include: floating button (icona MessageCircle di lucide-react), pannello espandibile, header con titolo "Assistente Evolvi" e pulsante di chiusura, area messaggi scrollabile, input text + pulsante invio (icona Send), pulsante "Nuova conversazione" (icona RotateCcw).
   - Stile coerente con Tailwind esistente (colori grigio scuro per sidebar, teal/blu per accent).
   - Stato: `messages`, `input`, `loading`, `isOpen`.
   - Fetch: `fetch('/api/chatbot', { method: 'POST', ... })` passando JWT dal localStorage `auth_token`.
   - Persistenza: salvare `messages` in `localStorage['chatbot_history']`; al mount leggerli e ripristinarli.
   - Gestione errori: mostrare nel pannello un messaggio "Assistente momentaneamente non disponibile" se l'API fallisce.

5. **Integrazione nel layout**
   - Modificare `frontend/src/app/page.tsx`: mostrare `ChatbotWidget` solo se `user` è autenticato (quindi dentro `MainApp`, non dentro `AuthForm`).
   - Non serve toccare `layout.tsx`.

6. **Variabili d'ambiente**
   - Aggiungere `ANTHROPIC_API_KEY` al file `.env.local` di sviluppo.
   - Aggiornare `.env.example` se esiste.
   - Non committare mai la chiave reale.

7. **Dipendenze da installare**
   - `@anthropic-ai/sdk` (ultima versione stabile).
   - Nessun'altra nuova dipendenza: lucide-react è già presente, Tailwind e Next.js idem.

### Comportamento atteso con esempi

- "Come creo un nuovo cliente?" → Risposta basata sulla sezione 5, include pulsante "+ Nuovo", form ClienteForm, campi obbligatori, chiude con "Vedi sezione Clienti della FAQ".
- "Dove vedo le scadenze di questa settimana?" → Vista Calendario Settimana nella sezione Scadenzario, come accedervi.
- "Ho dimenticato la password" → Spiega che non esiste auto-recupero, serve un admin per resettarla.
- "Posso eliminare definitivamente un utente?" → Spiega che è una funzione admin e l'azione è irreversibile.
- "Come si cucinano le lasagne?" → Dichiara che la domanda non è coperta dalla knowledge base del gestionale.

### File da creare o modificare

- Creare: `frontend/src/app/api/chatbot/route.ts`, `frontend/src/components/ChatbotWidget.tsx`, eventualmente `frontend/src/lib/chatbotKnowledge.ts` per caricare la FAQ.
- Modificare: `frontend/src/app/page.tsx` (integrare widget), `frontend/package.json` (aggiungere SDK), `.env.local` (aggiungere chiave), eventualmente `.env.example`.
- Non toccare il file `docs/chatbot/FAQ_GESTIONALE_EVOLVI.md` (la manutenzione è manuale).

### Verifica

Prima di considerare il task completato:
1. Avvia `npm run dev` e verifica che il widget compaia in basso a destra dopo il login.
2. Apri il widget, scrivi una domanda di test tra quelle negli esempi, verifica che la risposta sia in italiano, citi la sezione della FAQ e non inventi funzioni.
3. Verifica che su login/logout la cronologia persista/si azzeri correttamente.
4. Verifica in console che non compaiano errori bloccanti e che le chiamate API siano autenticate con JWT.

### Note finali per Claude Code

- Prima di scrivere codice, leggi integralmente `docs/chatbot/FAQ_GESTIONALE_EVOLVI.md` e `frontend/src/contexts/AuthContext.tsx` per capire come recuperare il token.
- Segui lo stile del codebase: Next.js App Router, componenti client dove serve interattività, server-only logic nelle API routes, Tailwind per gli stili.
- Usa `ts-node` / tipi TypeScript stretti (no `any`).
- Commenta solo dove non ovvio.
- Se durante l'implementazione emergono dubbi sulla copertura della FAQ, segnala in un TODO inline, non inventare risposte.
- Fai commit separati per: (1) aggiunta dipendenze e env, (2) API route, (3) componente widget, (4) integrazione in page.tsx, (5) aggiornamenti documentazione.

## FINE PROMPT

---

## Dopo l'implementazione

Quando Claude Code ha terminato, verifica questi punti:

- Il file `docs/chatbot/FAQ_GESTIONALE_EVOLVI.md` è referenziato a runtime: nessuna copia duplicata nel codice.
- La chiave `ANTHROPIC_API_KEY` è in `.env.local` e non committata.
- Il widget appare solo dopo il login ed è stilisticamente coerente con il resto del gestionale.
- Le risposte che il chatbot produce sono coerenti con i contenuti della FAQ.

## Manutenzione della knowledge base

Ogni volta che il gestionale cambia (nuova sezione, nuova etichetta, nuovo flusso):

1. Aggiornare le sezioni rilevanti di `FAQ_GESTIONALE_EVOLVI.md`.
2. Rilanciare il build (il contenuto viene caricato dal filesystem a cold start dell'API route).
3. Se si passa a un approccio RAG con embeddings (futuro), rigenerare l'indice.

## Possibili evoluzioni future

- Passare a un approccio RAG con chunking e embeddings (Supabase vector store) quando la FAQ supera le 30k parole.
- Aggiungere un sistema di feedback (pollice su/giù sulle risposte) per raccogliere casi non coperti.
- Tracciare metriche d'uso (domande più frequenti, risposte insoddisfacenti) in una tabella dedicata.
- Supportare risposte multi-lingua se arrivano collaboratori non italofoni.
