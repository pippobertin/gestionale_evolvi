# 🚀 DEBUG: Autocompilazione Intelligente AI

## 📋 STATO ATTUALE (13/11/2025)
**Sistema funzionante al 70% - GRANDE PROGRESSO!**

### ✅ SUCCESSI OTTENUTI
- ✅ **Niente più errori JSON** - risolto problema "Unterminated string"
- ✅ **Produce file .docx validi** invece di .txt corrotti
- ✅ **Mantiene formattazione originale** del documento Word
- ✅ **AI riceve dati aziendali correttamente** (visto nei log server)
- ✅ **Sostituzioni funzionanti**: telefono, sito web, denominazione, partita IVA, codice fiscale

### ⚠️ PROBLEMI RIMANENTI
- ⚠️ **"(Nome e Cognome)" non sostituito** - pattern frammentato nell'XML
- ⚠️ **Email e PEC non inserite** - pattern `mail____________________PEC` non trovato
- ⚠️ **Referente del progetto non compilato**

---

## 🔧 EVOLUZIONE DEL SISTEMA

### 1️⃣ PROBLEMA INIZIALE
- Sistema originale creava **documenti Word corrotti**
- Usava semplice sostituzione di placeholder che rompeva la struttura XML
- User: *"word corrotto te l'ho scritto io..."*

### 2️⃣ PRIMO TENTATIVO: AI Pattern Matching
**File modificati:**
- `/src/app/api/analyze-document/route.ts` - Prompt complesso per trovare pattern
- `/src/components/ProgettoForm.tsx` - Algoritmi complessi di pattern matching

**Problemi riscontrati:**
- AI restituiva pattern generici come `"____"` causando sovrapposizioni
- Testi frammentati nell'XML (es: `<w:t>(Nome e</w:t></w:r><w:r><w:t>Cognome)</w:t>`)
- User: *"tutti i dati sono tutti assieme e messi a caso..."*

### 3️⃣ SECONDO TENTATIVO: AI Compilation Diretta
**Idea:** Far compilare all'AI l'intero documento

**Problemi riscontrati:**
- AI restituiva JSON troppo lungo (7933+ caratteri)
- Errore "Unterminated string in JSON"
- Server non aggiornava il codice

### 4️⃣ SOLUZIONE ATTUALE: Approccio Ibrido ✅
**Strategia vincente:**
1. **AI analizza** documento + dati aziendali
2. **AI restituisce sostituzioni precise** (formato compatto)
3. **Frontend applica sostituzioni** mantenendo XML originale

---

## 🛠️ IMPLEMENTAZIONE TECNICA

### API Route (`/src/app/api/analyze-document/route.ts`)
```javascript
// PROMPT OTTIMIZZATO - evita JSON troppo lunghi
const prompt = `
IMPORTANTE: Per evitare problemi di parsing JSON, restituisci solo le sostituzioni principali.

Rispondi SOLO con un JSON in questo formato:
{
  "success": true,
  "replacements": [
    {
      "search": "(Nome e Cognome)",
      "replace": "CHIARA CANZI"
    }
  ],
  "compilation_notes": "Sostituzioni applicate con successo"
}
`
```

**Dati inviati all'AI:**
```json
{
  "DENOMINAZIONE_AZIENDA": "blmproject srl",
  "PARTITA_IVA": "02652950425",
  "LEGALE_RAPPRESENTANTE_NOME": "chiara",
  "LEGALE_RAPPRESENTANTE_COGNOME": "canzi",
  "LEGALE_RAPPRESENTANTE_CF": "CNZCHR77C54C523O",
  "EMAIL_AZIENDA": "info@blmproject.com",
  "PEC_AZIENDA": "blmproject@pec.it",
  "LEGALE_RAPPRESENTANTE_TELEFONO": "3479573269"
}
```

### Frontend Logic (`/src/components/ProgettoForm.tsx`)
```javascript
// APPROCCIO IBRIDO - applica sostituzioni AI su documento originale
replacements.forEach((replacement) => {
  const { search, replace } = replacement

  // Sostituzione diretta
  if (xmlContent.includes(search)) {
    const firstIndex = xmlContent.indexOf(search)
    xmlContent = xmlContent.substring(0, firstIndex) + replace +
               xmlContent.substring(firstIndex + search.length)
  } else {
    // Pattern frammentati XML
    const searchWords = search.split(' ').filter(w => w.length > 2)
    if (searchWords.every(word => xmlContent.includes(word))) {
      const flexPattern = searchWords.join('(?:<[^>]*>|\\s)*')
      xmlContent = xmlContent.replace(new RegExp(flexPattern, 'i'), replace)
    }
  }
})
```

---

## 📊 LOG ANALYSIS (Ultima Esecuzione)

### ✅ Sostituzioni Riuscite
```
✅ Sostituito: "tel. _________________" → "tel. 3479573269"
✅ Sostituito: "sito Web____________" → "sito Web www.blmproject.com"
✅ Sostituito con pattern frammentato: "Codice Fiscale [...]"
✅ Sostituito con pattern frammentato: "Denominazione azienda [...]"
✅ Sostituito con pattern frammentato: "PARTITA IVA [...]"
```

### ⚠️ Pattern Non Trovati (DA RISOLVERE)
```
⚠️ Pattern non trovato: "(Nome e Cognome)"
⚠️ Pattern non trovato: "e – mail____________________"
⚠️ Pattern non trovato: "PEC___________________"
⚠️ Pattern non trovato: "Referente del progetto : Nome, Cognome, tel., e-mail: [...]"
```

---

## 🎯 PROSSIMI PASSI PER COMPLETARE

### 1. Fixare "(Nome e Cognome)"
**Problema:** Pattern frammentato nell'XML come:
```xml
<w:t xml:space="preserve"> (Nome e</w:t></w:r>
<w:r><w:rPr>...</w:rPr><w:t>Cognome)</w:t>
```

**Soluzione:** Migliorare regex per pattern con parentesi

### 2. Fixare Email + PEC
**Problema:** Nell'XML appaiono insieme come `mail____________________PEC`

**Soluzione testata precedentemente:**
```javascript
// Pattern speciale per mail-PEC combinato
if (xmlContent.includes('mail____________________PEC')) {
  const emailValue = replace_with || ''
  const newContent = `mail${emailValue}____________________PEC${pecValue}`
  xmlContent = xmlContent.replace('mail____________________PEC', newContent)
}
```

### 3. Aggiungere debug più dettagliato
**Aggiungere nei log:**
- Snippet XML intorno ai pattern non trovati
- Lista di tutte le sostituzioni tentate
- Conteggio caratteri dei pattern

### 4. Gestire meglio i dati mancanti
**Migliorare prompt AI per:**
- Indirizzo sede legale
- REA e altri campi opzionali
- Settore ATECO

---

## 🧠 LEZIONI APPRESE

### ✅ Cosa Funziona
1. **Approccio ibrido** AI + manipolazione XML diretta
2. **JSON compatto** invece di documento completo
3. **Pattern flessibili** per gestire frammentazione XML
4. **Riavvio server** per caricare modifiche API

### ❌ Cosa NON Funziona
1. **AI pattern matching complesso** - troppi conflitti
2. **Compilazione documento intero** - JSON troppo lungo
3. **Pattern matching generico** - sovrapposizioni multiple
4. **Simple text replacement** - corrompe XML

---

## 📁 FILE MODIFICATI

### Core Implementation
- ✅ `/src/app/api/analyze-document/route.ts` - API con prompt ottimizzato
- ✅ `/src/components/ProgettoForm.tsx` - Logic sostituzione ibrida
- ✅ `.env.local` - OpenAI API key

### Configurazione
- 📦 Installate librerie: `pizzip`, `mammoth`, `openai`
- 🔧 Rimosso import problematico `html-docx-js`

---

## 🎯 STATO FINALE (da continuare domani)

**Sistema attuale: 70% funzionante**
- ✅ Documento .docx valido generato
- ✅ Formattazione mantenuta
- ✅ Dati base compilati (telefono, sito, denominazione, P.IVA, CF)
- ⚠️ Mancano: Nome/Cognome, Email, PEC, Referente progetto

**Next Steps:**
1. Debug pattern "(Nome e Cognome)" frammentato
2. Fixare email+PEC combinati
3. Aggiungere logging dettagliato
4. Test completo con tutti i campi

**User Feedback:** *"l'errore è sparito, e alcuni dati ci sono (al posto giusto) mentre altri mancano. forse ci stiamo avvicinando..."*

🚀 **SIAMO SULLA STRADA GIUSTA!**