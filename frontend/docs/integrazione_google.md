# Integrazione Google Drive

## Obiettivo
Integrare Google Drive per:
- Salvare automaticamente i documenti dei progetti su Google Drive
- Permettere anteprima in tempo reale dei documenti
- Sincronizzare modifiche automaticamente
- Migliorare la collaborazione sui documenti

## Setup Google Cloud Console

### STEP 1: Accesso e Progetto
1. Vai su: https://console.cloud.google.com/
2. Accedi con il tuo account Google/Gmail
3. Crea un nuovo progetto o seleziona uno esistente

### STEP 2: Abilitare Google Drive API
1. Vai su "API e servizi" > "Libreria"
2. Cerca "Google Drive API"
3. Clicca su "Abilita"

### STEP 3: Creare Credenziali OAuth 2.0
1. Vai su "API e servizi" > "Credenziali"
2. Clicca su "Crea credenziali" > "ID client OAuth"
3. Tipo di applicazione: "Applicazione web"
4. Nome: "Scadenze BLM - Drive Integration"
5. URI di reindirizzamento autorizzati:
   - http://localhost:3000/api/auth/callback/google
   - https://tuodominio.com/api/auth/callback/google (per produzione)

### STEP 4: Configurazione Schermata Consenso OAuth
1. Vai su "Schermata consenso OAuth"
2. Tipo di utente: "Esterno" (se non hai Google Workspace)
3. Compila i campi obbligatori:
   - Nome app: "Scadenze BLM"
   - Email di supporto: il tuo email
   - Domini autorizzati: tuodominio.com (se applicabile)

### STEP 5: Scope necessari
Aggiungi questi scope:
- https://www.googleapis.com/auth/drive.file
- https://www.googleapis.com/auth/drive.readonly
- https://www.googleapis.com/auth/userinfo.profile
- https://www.googleapis.com/auth/userinfo.email

## Credenziali necessarie

Avremo bisogno di queste informazioni:
- [ ] Client ID OAuth 2.0
- [ ] Client Secret OAuth 2.0
- [ ] Project ID Google Cloud

## Implementazione

### Pacchetti da installare:
```bash
npm install googleapis google-auth-library next-auth
```

### Variabili ambiente (.env.local):
```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_PROJECT_ID=your_project_id
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
```

## Workflow previsto

1. **Upload documento** → Salva su Supabase + crea copia su Google Drive
2. **Visualizza documento** → Mostra anteprima da Google Drive
3. **Modifica documento** → Link diretto a Google Drive per editing
4. **Sincronizzazione** → Controllo periodico modifiche da Drive

## Stato implementazione

- [x] Setup Google Cloud Console ✅
- [x] Installazione pacchetti ✅
- [x] Configurazione NextAuth ✅
- [x] API Google Drive setup ✅
- [x] Upload file su Drive ✅
- [ ] Preview file da Drive
- [ ] Integrazione nel ProgettoForm
- [ ] Test completo workflow
- [ ] Sincronizzazione bidirezionale

## File creati

1. **Configurazione:**
   - `.env.local` - Credenziali Google Drive
   - `google-credentials.json` - File credenziali (in .gitignore)
   - `.gitignore` - Aggiornato per sicurezza

2. **Autenticazione:**
   - `src/pages/api/auth/[...nextauth].ts` - NextAuth config con Google
   - Scope configurati: drive.file, drive.readonly

3. **Google Drive API:**
   - `src/lib/googleDrive.ts` - Utility functions per Drive
   - `src/pages/api/drive/upload.ts` - API endpoint per upload

## Prossimi passi

1. **Test autenticazione Google**
2. **Modifica ProgettoForm** per usare Google Drive
3. **Test upload documenti**
4. **Implementare preview da Drive**
5. **Test workflow completo**

---

**Nota**: Iniziare con account Google personale per testing, poi eventualmente migrare a Google Workspace per funzionalità aziendali avanzate.