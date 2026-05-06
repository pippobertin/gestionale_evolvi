# Refactoring TODO - Gestionale Evolvi

**Branch**: `refactor-feb-2026`
**Ultimo aggiornamento**: 16 Febbraio 2026
**Stato**: Fase 1 ✅ | Fase 2 ✅ | Fase 2.5 🔄 IN PROGRESS

---

## 📊 Panoramica Progetto Refactoring

Piano di refactoring incrementale in 4 fasi per migliorare la manutenibilità del codebase.

**Analisi completa**: Vedi `CODEBASE_ANALYSIS_REPORT.md`
- 103 file TypeScript/TSX analizzati
- 35,026 righe totali di codice
- Identificate criticità CRITICAL e HIGH priority

---

## ✅ FASE 1: Quick Wins (COMPLETATA)

**Tempo stimato**: 3 ore
**Tempo effettivo**: ~2.5 ore
**Commit**: `d6fdf71`
**Data completamento**: 14 Febbraio 2026

### Modifiche implementate:

1. **Dependency cleanup**
   - ✅ Rimosso `@nivo/core` da package.json (non utilizzato)

2. **Gmail API utilities**
   - ✅ Creata `createGoogleAuthClient()` in `src/lib/gmail.ts`
   - ✅ Creata `getGmailClient()` in `src/lib/gmail.ts`

3. **Eliminazione duplicazioni Gmail (200+ righe)**
   - ✅ `src/app/api/gmail/labels/route.ts`
   - ✅ `src/app/api/gmail/messages/route.ts`
   - ✅ `src/app/api/gmail/messages/[id]/route.ts`
   - ✅ `src/app/api/gmail/messages/[id]/markAsRead/route.ts`
   - ✅ `src/app/api/gmail/messages/[id]/read/route.ts`
   - ✅ `src/app/api/gmail/messages/[id]/star/route.ts`
   - ✅ `src/app/api/gmail/send/route.ts`

### Testing:
- ✅ Gmail API: labels, messages, send
- ✅ Google Drive: creazione bandi/progetti
- ✅ Database operations
- ✅ Compilazione TypeScript (0 errori)

### Metriche Fase 1:
- File modificati: 11
- Righe duplicate eliminate: ~220
- Dependency rimosse: 1
- Utility create: 2

---

## ✅ FASE 2: Consolidamento Selettori Responsabili (COMPLETATA)

**Tempo stimato**: 9 ore
**Tempo effettivo**: ~3 ore
**Priorità**: HIGH
**Rischio**: MEDIO
**Commit**: `5f1701d`
**Data completamento**: 16 Febbraio 2026

### Obiettivi raggiunti:

Unificati 4 componenti selettori duplicati (969 righe totali) in 2 componenti:

1. **UnifiedResponsableSelector.tsx** (385 righe)
   - Sostituisce: ResponsableSelector + SimpleResponsableSelector
   - Supporta `variant='standard' | 'simple'`
   - Union types per flessibilità tipo value

2. **UnifiedMultiResponsableSelector.tsx** (490 righe)
   - Sostituisce: MultipleResponsableSelector + MultiResponsableSelector
   - Supporta `variant='inline' | 'external'`
   - Gestisce ResponsabileSelezionato[] e Responsabile[]

### Migrazioni completate:
- ✅ ScadenzaForm.tsx → UnifiedResponsableSelector
- ✅ BandoForm.tsx → UnifiedMultiResponsableSelector (variant="external")

### Componenti eliminati:
- ✅ ResponsableSelector.tsx (206 righe)
- ✅ SimpleResponsableSelector.tsx (154 righe)
- ✅ MultipleResponsableSelector.tsx (305 righe)
- ✅ MultiResponsableSelector.tsx (304 righe)

### Testing:
- ✅ Compilazione TypeScript: 0 errori
- ✅ Server Next.js: running senza errori
- ✅ ScadenzaForm: selezione singola funzionante
- ✅ BandoForm: selezione multipla con external chips funzionante

### Metriche Fase 2:
- File modificati: 8
- File creati: 2 (unified components)
- File eliminati: 4 (old selectors)
- Righe duplicate eliminate: ~520 righe (53% riduzione)
- Da 969 righe → 450 righe totali

---

## 🔄 FASE 2.5: Pulizia console.log (IN PROGRESS)

**Tempo stimato**: 4 ore
**Priorità**: MEDIUM
**Rischio**: MOLTO BASSO
**Status**: 🔄 IN PROGRESS

### Obiettivo:

Rimuovere 388 occorrenze di `console.log` dal codebase per avere un codice più pulito e professionale.

### Step da seguire:

1. **Analisi occorrenze console.log**
   - Trovare tutte le 388 occorrenze
   - Categorizzare: eliminare vs mantenere (console.error, console.warn critici)
   - Identificare file con più occorrenze

2. **Rimozione in batch per sicurezza**
   - Batch 1: src/components/ (componenti UI)
   - Batch 2: src/app/ (route handlers e pagine)
   - Batch 3: src/lib/ (utility e servizi)
   - Testare compilazione dopo ogni batch

3. **Mantenere solo logging critico**
   - Mantenere `console.error` per errori reali
   - Mantenere `console.warn` per warning importanti
   - Rimuovere tutti i `console.log` di debug

4. **Testing e commit**
   - Verificare compilazione TypeScript: 0 errori
   - Verificare dev server running
   - Commit dettagliato con metriche
   - Push a refactor-feb-2026

### Risultato atteso:
- ~350-380 console.log rimossi
- Codebase più pulito e professionale
- 0 breaking changes
- Mantenuti solo console.error/warn critici

### Nota:
ClienteSelector e BandoSelector menzionati nella pianificazione originale non esistono nel codebase. Le duplicazioni principali (Responsable Selectors) sono già state risolte in Fase 2.

---

## 📋 FASE 3: Refactoring ProgettoForm.tsx (DA FARE)

**Tempo stimato**: 25 ore
**Priorità**: CRITICAL
**Rischio**: ALTO

### Problema:

`src/components/ProgettoForm.tsx` - **2,348 righe**
- Componente monolitico difficile da mantenere
- Multipli useEffect con dipendenze complesse
- Logica business mista a UI

### Piano di azione:

1. **Estrazione custom hooks** (8 ore)
   - `useProgettoFormState.ts` - Gestione stato form
   - `useProgettoValidation.ts` - Validazione campi
   - `useProgettoGoogleDrive.ts` - Operazioni Google Drive
   - `useProgettoDocuments.ts` - Gestione documenti

2. **Suddivisione componente** (12 ore)
   - `ProgettoFormHeader.tsx` - Header e info base
   - `ProgettoFormDatiGenerali.tsx` - Dati generali progetto
   - `ProgettoFormDocumenti.tsx` - Sezione documenti
   - `ProgettoFormScadenze.tsx` - Gestione scadenze
   - `ProgettoFormFooter.tsx` - Azioni salva/annulla

3. **Refactoring logica** (5 ore)
   - Spostare business logic in servizi separati
   - Semplificare useEffect
   - Migliorare error handling

### Risultato atteso:
- 2,348 righe → ~800 righe totali (distribuiti in 5-6 file)
- Miglior testabilità
- Manutenibilità aumentata

---

## 📋 FASE 4: Polish e Ottimizzazioni (DA FARE)

**Tempo stimato**: 44 ore
**Priorità**: MEDIUM
**Rischio**: BASSO

### Obiettivi:

1. **Pulizia console.log** (4 ore)
   - Rimuovere 388 occorrenze `console.log`
   - Mantenere solo `console.error` e `console.warn` critici
   - Implementare logger service (opzionale)

2. **Componenti comuni** (15 ore)
   - Estrarre `ClienteSelector.tsx` unificato (3 duplicati)
   - Estrarre `BandoSelector.tsx` unificato (2 duplicati)
   - Creare `LoadingButton.tsx` riutilizzabile
   - Creare `DataTable.tsx` generico

3. **Miglioramenti TypeScript** (10 ore)
   - Sostituire `any` types con types specifici
   - Aggiungere interfacce mancanti
   - Migliorare type safety

4. **Ottimizzazioni performance** (8 ore)
   - Memoizzazione componenti pesanti
   - Lazy loading componenti grandi
   - Ottimizzazione re-render

5. **Testing** (7 ore)
   - Unit tests per utility functions
   - Integration tests per API routes critiche
   - E2E tests per flussi principali

### Risultato atteso:
- Codebase più pulito e professionale
- Migliori performance
- Coverage test >60%

---

## 📈 Metriche Totali Progetto

### Stato attuale (dopo Fase 2):
- ✅ Dependency rimosse: 1
- ✅ Duplicazioni eliminate: 740 righe (220 Fase 1 + 520 Fase 2)
- ✅ Utility create: 2
- ✅ Componenti unificati creati: 2 (UnifiedResponsableSelector, UnifiedMultiResponsableSelector)
- ⏳ Tempo investito: 5.5 ore (2.5h Fase 1 + 3h Fase 2)

### Obiettivi finali (tutte le fasi):
- 🎯 Duplicazioni da eliminare: ~1,800 righe
- 🎯 Progresso duplicazioni: 740/1800 (41% completato)
- 🎯 File da refactorare: ~15
- 🎯 Componenti unificati target: 6+
- 🎯 Tempo totale stimato: 81 ore
- 🎯 Tempo rimanente: ~75.5 ore

---

## 🚀 Prossima Sessione - ISTRUZIONI AUTOMATICHE

### ⚡ TASK ATTUALE: Fase 2.5 (Pulizia console.log)

**Procedi automaticamente con i seguenti step:**

1. **Trova tutte le occorrenze console.log**
   ```bash
   cd /Users/filippobertin/Documents/GESTIONALE\ EVOLVI/gestionale_evolvi
   grep -rn "console\.log" frontend/src --include="*.{ts,tsx}" | wc -l
   grep -rn "console\.log" frontend/src --include="*.{ts,tsx}" > /tmp/console-log-list.txt
   ```

2. **Analizza e categorizza**
   - Conta occorrenze per directory
   - Identifica file con più occorrenze
   - Lista console.error/warn da mantenere

3. **Rimuovi in batch (usa Edit tool per sicurezza)**
   - Batch 1: frontend/src/components/ (start con file più piccoli)
   - Batch 2: frontend/src/app/
   - Batch 3: frontend/src/lib/
   - Testa compilazione dopo ogni batch

4. **Strategia rimozione:**
   - Rimuovi intere righe `console.log(...)`
   - Se inline in espressioni, sostituisci con void 0 o rimuovi
   - Mantieni SEMPRE: console.error, console.warn
   - Rimuovi: console.log, console.info, console.debug

5. **Testing continuo**
   - Dopo ogni batch: verifica compilazione
   - Controlla dev server non abbia errori
   - Se errori: rollback quel file e skippa

6. **Commit finale**
   - Conta console.log rimossi
   - Commit dettagliato con metriche
   - Push a refactor-feb-2026

7. **DOPO Fase 2.5, FERMATI e chiedi conferma**
   - Valutare se procedere con Fase 4 (TypeScript improvements)
   - O se procedere con Fase 3 (ProgettoForm - HIGH RISK)

### 🎯 Strategia di avanzamento:

- ✅ Fase 1: Completata (Quick wins)
- ✅ Fase 2: Completata (Selector consolidation)
- 🔄 Fase 2.5: IN PROGRESS (console.log cleanup)
- ⏸️ Fase 3: STOP e chiedi conferma (ProgettoForm - HIGH RISK)
- ⏸️ Fase 4: STOP e chiedi conferma (TypeScript/Polish)

---

## 📝 Note Tecniche

### Files chiave modificati (Fase 1):
```
frontend/
├── package.json                                      # -1 dependency
├── src/lib/gmail.ts                                  # +2 utilities
└── src/app/api/gmail/                               # -220 righe duplicate
    ├── labels/route.ts
    ├── messages/route.ts
    ├── messages/[id]/route.ts
    ├── messages/[id]/markAsRead/route.ts
    ├── messages/[id]/read/route.ts
    ├── messages/[id]/star/route.ts
    └── send/route.ts
```

### Convenzioni adottate:

1. **Commit messages**: Formato conventional commits
   - `refactor(scope): descrizione`
   - Include metriche e dettagli nel body

2. **Testing**: Test manuali completi prima di commit
   - Gmail API
   - Google Drive
   - Database operations

3. **Branch strategy**:
   - Main: `main`
   - Refactoring: `refactor-feb-2026`
   - Feature: creare branch da refactor-feb-2026 se necessario

---

## 🔗 Links Utili

- **Report completo**: `CODEBASE_ANALYSIS_REPORT.md`
- **Repository**: https://github.com/pippobertin/gestionale_evolvi
- **Branch refactoring**: `refactor-feb-2026`

---

## ⚠️ Avvertenze

### Rischi da considerare:

1. **ProgettoForm.tsx** (Fase 3)
   - Componente molto complesso
   - Testing estensivo necessario
   - Possibili breaking changes

2. **Selettori** (Fase 2)
   - Verificare tutte le pagine che li usano
   - Controllare props compatibility

3. **Performance**
   - Monitorare bundle size
   - Test carico dopo ogni fase

---

**Ultimo commit refactoring**: `5f1701d` (Fase 2 completata)
**Commit precedenti**:
- `d6fdf71` - Fase 1 (Quick wins)
- `a0bd1ad` - Aggiunta refactor-todo.md

**Branch**: `refactor-feb-2026`
**Data ultimo aggiornamento**: 16 Febbraio 2026
