# Refactoring TODO - Gestionale Evolvi

**Branch**: `refactor-feb-2026`
**Ultimo aggiornamento**: 14 Febbraio 2026
**Stato**: Fase 1 completata ✅

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

## 📋 FASE 2: Consolidamento Selettori (DA FARE)

**Tempo stimato**: 9 ore
**Priorità**: HIGH
**Rischio**: MEDIO

### Obiettivi:

Unificare 4 componenti selettori duplicati (969 righe totali):

1. **ResponsableSelector.tsx** (206 righe)
   - `src/components/ResponsableSelector.tsx`
   - Usato in: ScadenzaForm, BandoForm

2. **SimpleResponsableSelector.tsx** (154 righe)
   - `src/components/SimpleResponsableSelector.tsx`
   - Simile a ResponsableSelector ma semplificato

3. **MultipleResponsableSelector.tsx** (305 righe)
   - `src/components/MultipleResponsableSelector.tsx`
   - Selezione multipla con chip

4. **MultiResponsableSelector.tsx** (304 righe)
   - `src/components/MultiResponsableSelector.tsx`
   - Quasi identico a MultipleResponsableSelector

### Piano di azione:

1. **Analisi delle differenze**
   - Confrontare i 4 componenti
   - Identificare funzionalità comuni e specifiche

2. **Creazione componente unificato**
   - Nome: `UnifiedResponsableSelector.tsx`
   - Props:
     - `multiple?: boolean` (singola vs multipla selezione)
     - `simplified?: boolean` (versione semplificata)
     - `showChips?: boolean` (mostra chip per multipli)
     - Altri props comuni

3. **Migration graduale**
   - Sostituire ResponsableSelector
   - Sostituire SimpleResponsableSelector
   - Sostituire MultipleResponsableSelector
   - Sostituire MultiResponsableSelector
   - Eliminare vecchi componenti

4. **Testing**
   - Testare ScadenzaForm
   - Testare BandoForm
   - Testare ProgettoForm
   - Verificare selezione singola/multipla

### Risultato atteso:
- 4 componenti → 1 componente unificato
- ~969 righe → ~350 righe
- Risparmio: ~620 righe di codice duplicato

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

### Stato attuale (dopo Fase 1):
- ✅ Dependency rimosse: 1
- ✅ Duplicazioni eliminate: 220 righe
- ✅ Utility create: 2
- ⏳ Tempo investito: 2.5 ore

### Obiettivi finali (tutte le fasi):
- 🎯 Duplicazioni da eliminare: ~1,800 righe
- 🎯 File da refactorare: ~15
- 🎯 Componenti unificati: 6+
- 🎯 Tempo totale stimato: 81 ore
- 🎯 Tempo rimanente: 78.5 ore

---

## 🚀 Prossima Sessione

### Da fare immediatamente:

1. **Decidere quale fase affrontare**
   - Fase 2 (selettori) - 9 ore - Impatto medio
   - Fase 3 (ProgettoForm) - 25 ore - Impatto alto
   - Fase 4 (polish) - 44 ore - Impatto basso

2. **Setup ambiente**
   ```bash
   git checkout refactor-feb-2026
   git pull origin refactor-feb-2026
   npm install
   npm run dev
   ```

3. **Leggere analisi**
   - Aprire `CODEBASE_ANALYSIS_REPORT.md`
   - Rivedere sezione della fase scelta

### Raccomandazioni:

- **Per quick win**: Iniziare con Fase 2 (selettori)
- **Per impatto massimo**: Iniziare con Fase 3 (ProgettoForm)
- **Per stabilità**: Completare Fase 2 e Fase 4 prima di Fase 3

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

**Ultimo commit refactoring**: `d6fdf71`
**Branch**: `refactor-feb-2026`
**Data**: 14 Febbraio 2026
