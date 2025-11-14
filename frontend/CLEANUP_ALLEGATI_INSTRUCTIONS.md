# Pulizia e Ricostruzione Sistema Allegati Compilabili

## 🎯 Obiettivo
Ricostruire da zero il sistema di gestione degli allegati compilabili con logica semplice e lineare.

## 🔄 Flusso Target (Semplificato)

### 1. Editor nel BANDO
- Utente carica un documento Word (con o senza underscore, non importa)
- Utente aggiunge placeholder `{DENOMINAZIONE}`, `{PARTITA_IVA}`, etc. dove vuole nel documento
- Sistema salva il documento modificato nel bucket `bandi-documenti/{bando_id}/`

### 2. Creazione PROGETTO
- Sistema copia TUTTI i documenti da `bandi-documenti/{bando_id}/` a `progetti-documenti/{progetto_id}/`
- Nessuna modifica, solo copia diretta

### 3. Compilazione PROGETTO
- Sistema prende i documenti da `progetti-documenti/{progetto_id}/`
- Sostituisce `{PLACEHOLDER}` con i dati reali dell'azienda
- Genera documento finale compilato

## 🧹 PULIZIA COMPLETA

### File da Pulire Completamente

#### 1. `/src/components/DocumentTemplateEditor.tsx`
**RIMUOVERE COMPLETAMENTE:**
- ❌ Tutta la logica di mapping underscore → placeholder
- ❌ Tutti i fallback e strategie multiple
- ❌ `doc.render()` e mapping complessi
- ❌ Estrazione placeholder da HTML
- ❌ Logica XML complessa con sostituzione underscore

**MANTENERE SOLO:**
- ✅ Caricamento documento Word originale
- ✅ Editor HTML per visualizzazione
- ✅ Salvataggio nel bucket `bandi-documenti`

#### 2. `/src/components/ProgettoForm.tsx`
**RIMUOVERE COMPLETAMENTE:**
- ❌ Logica complessa di copia documenti con gestione errori multipli
- ❌ Auto-compilazione complessa con fallback
- ❌ Gestione template dal database (non più necessaria)

**MANTENERE SOLO:**
- ✅ Copia semplice da bucket bando a bucket progetto
- ✅ Chiamata API compilazione semplice

#### 3. `/src/app/api/compile-template/route.ts`
**MANTENERE E SEMPLIFICARE:**
- ✅ Caricamento documento da bucket progetto
- ✅ Sostituzione placeholder con dati reali
- ✅ Return documento compilato

## 🚀 RICOSTRUZIONE STEP-BY-STEP

### Step 1: DocumentTemplateEditor Pulito
```typescript
// LOGICA SEMPLICE:
// 1. Carica Word originale
// 2. Mostra editor HTML
// 3. Quando utente clicca "Salva Template":
//    - Prende il contenuto HTML modificato
//    - Identifica placeholder {CHIAVE} nell'HTML
//    - Modifica il Word inserendo i placeholder dove specificato
//    - Salva nel bucket bandi-documenti/{bandoId}/template_{fileName}
```

### Step 2: Copia Documenti Semplice
```typescript
// LOGICA SEMPLICE ProgettoForm:
// 1. Lista tutti i file in bandi-documenti/{bandoId}/
// 2. Per ogni file:
//    - Download da bandi-documenti
//    - Upload in progetti-documenti/{progettoId}/
// 3. Fine
```

### Step 3: Compilazione Semplice
```typescript
// LOGICA SEMPLICE API:
// 1. Lista file in progetti-documenti/{progettoId}/
// 2. Per ogni documento Word:
//    - Carica documento
//    - Trova tutti i {PLACEHOLDER}
//    - Sostituisci con dati azienda
//    - Return documento compilato
```

## 📁 Struttura Bucket Target

```
bandi-documenti/
├── {bando_id}/
│   ├── template_allegato1.docx  (con placeholder {DENOMINAZIONE}, {PARTITA_IVA})
│   ├── template_allegato2.docx  (con placeholder {EMAIL}, {TELEFONO})
│   └── ...

progetti-documenti/
├── {progetto_id}/
│   ├── template_allegato1.docx  (copia identica da bando)
│   ├── template_allegato2.docx  (copia identica da bando)
│   └── ...
```

## 🗑️ Codice da Eliminare

### DocumentTemplateEditor.tsx - Righe da Eliminare
- Tutto il blocco `extractPlaceholdersSafely`
- Tutto il blocco mapping underscore
- Tutto il blocco modifica XML
- Tutte le strategie fallback
- Tutto il debug complesso

### ProgettoForm.tsx - Righe da Eliminare
- Auto-compilazione con multiple strategie
- Gestione template dal database
- Parsing HTML complesso
- Gestione errori stratificata

## 📝 Implementazione Pulita

### 1. DocumentTemplateEditor - Nuovo Approccio
```typescript
const handleSaveTemplate = async () => {
  // 1. Estrai placeholder SOLO dall'HTML editor
  const htmlContent = editorRef.current?.getContent() || ''
  const placeholders = htmlContent.match(/\{[A-Z_]+\}/g) || []

  // 2. Carica Word originale
  const doc = new Docxtemplater(originalZip)

  // 3. SEMPLICE: Inserisci placeholder nel Word basandoti sull'HTML
  // (logica da definire - ma SEMPLICE)

  // 4. Salva nel bucket
  const fileName = `template_${originalFile.name}`
  await supabase.storage
    .from('bandi-documenti')
    .upload(`${bandoId}/${fileName}`, wordBlob)

  // 5. Fine
}
```

### 2. ProgettoForm - Nuovo Approccio
```typescript
const copyDocumentsFromBando = async () => {
  // 1. Lista file bando
  const { data: files } = await supabase.storage
    .from('bandi-documenti')
    .list(bandoId)

  // 2. Copia ogni file
  for (const file of files) {
    const { data } = await supabase.storage
      .from('bandi-documenti')
      .download(`${bandoId}/${file.name}`)

    await supabase.storage
      .from('progetti-documenti')
      .upload(`${progettoId}/${file.name}`, data)
  }
}
```

### 3. Compile API - Nuovo Approccio
```typescript
export async function POST(request: NextRequest) {
  // 1. Get progetto e documenti
  const { progettoId, clientData } = await request.json()

  // 2. Lista documenti progetto
  const { data: files } = await supabase.storage
    .from('progetti-documenti')
    .list(progettoId)

  // 3. Per ogni documento Word, sostituisci placeholder
  const doc = new Docxtemplater(zip)
  doc.render(clientData) // SEMPLICE sostituzione

  // 4. Return documento compilato
}
```

## 🎯 Risultato Atteso
- **Codice 80% più semplice**
- **Zero fallback e strategie multiple**
- **Flusso lineare e predicibile**
- **Facile debugging**
- **Manutenibile nel tempo**

---

## ⚠️ IMPORTANTE
Prima di iniziare la ricostruzione:
1. Backup completo del codice attuale
2. Eliminare TUTTO il codice complesso esistente
3. Ricominciare con logica semplice step-by-step
4. Testare ogni step singolarmente prima di procedere