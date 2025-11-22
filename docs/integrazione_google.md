# Integrazione Google Drive - Piano di Implementazione

## 📋 Overview
Integrazione del Gestionale Evolvi con Google Drive per automatizzare la creazione di cartelle e sincronizzazione documenti per Bandi e Progetti.

## 🎯 Obiettivi
- **Creazione automatica** struttura cartelle per ogni bando
- **Upload automatico** documenti normativa e allegati
- **Organizzazione progetti** con cartelle dedicate per azienda
- **Sync bidirezionale** documenti (opzionale)

## 📁 Struttura Cartelle Target

```
Google Drive/
└── GESTIONALE EVOLVI/
    └── BANDI 2025/                     # Anno corrente
        └── BANDO XYZ/                  # Nome del bando
            ├── NORMATIVA/              # Documenti ufficiali bando
            │   ├── decreto.pdf
            │   ├── avviso_pubblico.pdf
            │   └── disciplinare.pdf
            ├── ALLEGATI/               # Modulistica da compilare
            │   ├── domanda_partecipazione.pdf
            │   └── modulo_spese.xlsx
            └── PROGETTI/               # Creata al primo progetto
                └── PROGETTO BANDO XYZ AZIENDA ABC/
                    ├── DOC AMM/        # Documenti amministrativi azienda
                    └── ALLEGATI/       # Copia allegati del bando
```

## 🛠 Setup Tecnico Richiesto

### 1. Google Cloud Console
- [ ] Creare nuovo progetto Google Cloud
- [ ] Abilitare Google Drive API
- [ ] Abilitare Google Workspace APIs (se necessario)
- [ ] Configurare OAuth 2.0 consent screen

### 2. Credenziali
- [ ] Service Account con chiavi JSON (per server-side)
- [ ] OAuth 2.0 credentials (per user access)
- [ ] Configurare domini autorizzati workspace

### 3. Permessi Google Drive
- [ ] Identificare cartella root "GESTIONALE EVOLVI"
- [ ] Configurare permessi condivisione
- [ ] Gestire accessi utenti workspace

## 📦 Dipendenze da Installare

```bash
npm install googleapis
npm install google-auth-library
npm install @google-cloud/storage  # Se serve backup
```

## 🔧 Implementazione

### 1. Configurazione Ambiente
```typescript
// .env.local
GOOGLE_DRIVE_CLIENT_ID=xxx
GOOGLE_DRIVE_CLIENT_SECRET=xxx
GOOGLE_DRIVE_REDIRECT_URI=xxx
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=xxx
GOOGLE_DRIVE_ROOT_FOLDER_ID=xxx  # ID cartella "GESTIONALE EVOLVI"
```

### 2. Servizio Google Drive
Creare file: `/src/lib/googleDrive.ts`
- [ ] Autenticazione Service Account
- [ ] Funzioni CRUD cartelle
- [ ] Upload files con metadata
- [ ] Gestione permessi cartelle
- [ ] Error handling e retry logic

### 3. Trigger Automatici

#### Creazione Bando
- [ ] Hook in `BandoForm.tsx` → `handleSave()`
- [ ] Creare cartella anno se non exists
- [ ] Creare cartella bando
- [ ] Creare sottocartelle NORMATIVA/ALLEGATI
- [ ] Upload documenti caricati

#### Upload Documenti Bando
- [ ] Hook in `handleFileUpload()`
- [ ] Sync automatico con cartella Google Drive
- [ ] Mantenere mapping ID Supabase ↔ Google Drive

#### Creazione Progetto
- [ ] Hook in `ProgettoForm.tsx` → `handleSave()`
- [ ] Creare cartella PROGETTI se non exists
- [ ] Creare cartella progetto specifica
- [ ] Creare sottocartelle DOC AMM/ALLEGATI
- [ ] Copiare allegati da cartella bando

### 4. Database Schema Updates
Aggiungere campi per tracking Google Drive:

```sql
-- Tabella bandi
ALTER TABLE scadenze_bandi_bandi ADD COLUMN google_drive_folder_id VARCHAR(255);
ALTER TABLE scadenze_bandi_bandi ADD COLUMN google_drive_sync_status VARCHAR(50) DEFAULT 'pending';

-- Tabella progetti
ALTER TABLE scadenze_bandi_progetti ADD COLUMN google_drive_folder_id VARCHAR(255);
ALTER TABLE scadenze_bandi_progetti ADD COLUMN google_drive_sync_status VARCHAR(50) DEFAULT 'pending';

-- Tabella documenti
ALTER TABLE scadenze_bandi_documenti ADD COLUMN google_drive_file_id VARCHAR(255);
ALTER TABLE scadenze_bandi_documenti ADD COLUMN google_drive_url VARCHAR(500);
```

## 🔄 Workflow di Sync

### Scenario 1: Creazione Bando
1. User salva bando nel gestionale
2. Sistema crea automaticamente:
   - Cartella "BANDI 2025" (se non esiste)
   - Cartella "BANDO [nome]"
   - Sottocartelle NORMATIVA/ALLEGATI
3. Upload documenti già caricati
4. Salva folder_id nel database
5. Notifica utente successo/errore

### Scenario 2: Upload Documento Bando
1. User carica documento in BandoForm
2. Sistema upload su Supabase Storage (esistente)
3. Sistema upload anche su Google Drive cartella appropriata
4. Salva file_id Google Drive nel database
5. Mantiene sync tra i due sistemi

### Scenario 3: Creazione Progetto
1. User crea progetto da bando esistente
2. Sistema verifica cartella bando esiste
3. Crea cartella PROGETTI (se prima volta per quel bando)
4. Crea cartella progetto "PROGETTO [bando] [azienda]"
5. Crea sottocartelle DOC AMM/ALLEGATI
6. Copia allegati da cartella bando padre
7. Salva folder_id progetto nel database

## 🚨 Gestione Errori

### Casi da Gestire
- [ ] Perdita connessione internet
- [ ] Quota Google Drive superata
- [ ] Permessi insufficienti
- [ ] Cartelle eliminate manualmente
- [ ] Conflitti nomi cartelle

### Strategy di Recovery
- [ ] Queue di retry per operazioni fallite
- [ ] Logging dettagliato operazioni
- [ ] Notifiche admin per errori critici
- [ ] Modalità "solo locale" se Google Drive non disponibile

## 📊 Monitoring

### Metriche da Tracciare
- [ ] Numero sync successo/fallimento
- [ ] Tempo medio operazioni
- [ ] Spazio Google Drive utilizzato
- [ ] Errori per tipologia

### Dashboard Admin
- [ ] Status sync per bando/progetto
- [ ] Log operazioni recenti
- [ ] Bottone "Forza Re-sync"
- [ ] Statistiche utilizzo spazio

## 🧪 Testing

### Test Cases
- [ ] Creazione primo bando anno
- [ ] Creazione bando con anno esistente
- [ ] Upload multipli documenti
- [ ] Creazione primo progetto per bando
- [ ] Creazione progetto con cartella esistente
- [ ] Gestione errori rete
- [ ] Test permessi workspace

## 🚀 Deployment

### Checklist Pre-Deploy
- [ ] Service Account configurato in produzione
- [ ] Variabili ambiente impostate
- [ ] Cartella root Google Drive creata
- [ ] Permessi workspace configurati
- [ ] Backup database pre-migrazione
- [ ] Test completo su ambiente staging

## 📝 Note Implementazione

### Priorità Features
1. **ALTA**: Creazione cartelle bandi + upload
2. **MEDIA**: Creazione cartelle progetti
3. **BASSA**: Sync bidirezionale
4. **BASSA**: Dashboard monitoring

### Considerazioni Tecniche
- Usare Service Account per operazioni server-side
- Implementare queue Redis per operazioni async (opzionale)
- Considerare rate limiting Google API
- Gestire conflitti encoding nomi file italiani

### Migration Strategy
- Iniziare con bandi nuovi
- Tool per migrazione bandi esistenti (opzionale)
- Modalità "dual mode" durante transizione

## ✅ Checklist Completa Implementazione

### Setup Iniziale
- [ ] Google Cloud Console configurato
- [ ] Service Account creato
- [ ] API abilitate
- [ ] Credenziali configurate in .env

### Backend
- [ ] Librerie Google APIs installate
- [ ] Servizio GoogleDrive implementato
- [ ] Database schema aggiornato
- [ ] Error handling implementato

### Frontend Integration
- [ ] Hook creazione bando
- [ ] Hook upload documenti
- [ ] Hook creazione progetto
- [ ] UI feedback sync status

### Testing & Deploy
- [ ] Test suite completa
- [ ] Deploy staging
- [ ] Test end-to-end
- [ ] Deploy produzione
- [ ] Monitoring attivo

---

**📞 Quando implementare**: Dire "leggi integrazione_google.md" per iniziare l'implementazione completa.