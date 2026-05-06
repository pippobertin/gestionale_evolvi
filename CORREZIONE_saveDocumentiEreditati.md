# Correzione funzione saveDocumentiEreditati in ProgettoForm.tsx

## Problema
La funzione `saveDocumentiEreditati` non salva il campo `nome_originale`, necessario per il matching con i file di Google Drive.

## File da modificare
`frontend/src/components/ProgettoForm.tsx`

## Modifica da applicare

Trova la funzione `saveDocumentiEreditati` e sostituisci il mapping dei documenti:

### PRIMA (codice attuale):
```typescript
.map(doc => ({
  progetto_id: progettoId,
  nome_file: doc.nome_file,
  categoria: doc.categoria,
  formato_file: doc.formato_file,
  dimensione_bytes: doc.dimensione_bytes,
  url_file: doc.url_file,
  descrizione: doc.descrizione,
  tipo_documento: doc.tipo_documento || 'template',
  caricato_da: 'SISTEMA_EREDITA'
}))
```

### DOPO (codice corretto):
```typescript
.map(doc => ({
  progetto_id: progettoId,
  nome_file: doc.nome_file,
  nome_originale: doc.nome_file, // ← AGGIUNTO: necessario per matching Drive
  categoria: 'allegato', // ← MODIFICATO: normalizzato a singolare
  formato_file: doc.formato_file,
  dimensione_bytes: doc.dimensione_bytes,
  url_file: doc.url_file,
  descrizione: doc.descrizione,
  tipo_documento: doc.tipo_documento || 'template',
  caricato_da: 'SISTEMA_EREDITA'
}))
```

## Motivo delle modifiche

1. **nome_originale**: L'API `/api/drive/create-progetto` usa questo campo per fare il match tra i documenti nel database e i file copiati su Google Drive
2. **categoria normalizzata**: DocumentiProgettoPreview cerca `categoria='allegato'` (singolare), mentre i documenti del bando hanno `categoria='allegati'` (plurale)

## Test dopo la modifica

1. Esegui lo script SQL `fix_documenti_nome_originale.sql` per fixare i documenti esistenti
2. Crea un nuovo progetto
3. Verifica che i documenti abbiano `google_drive_id` popolato
4. Verifica che la preview funzioni
