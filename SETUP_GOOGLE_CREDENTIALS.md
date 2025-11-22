# Configurazione Credenziali Google per Gestionale Evolvi

Questo documento spiega come configurare le credenziali Google necessarie per il funzionamento dell'integrazione Gmail e Google Drive.

## 📋 Prerequisiti

1. Account Google Cloud Platform
2. Progetto Google Cloud attivo
3. Accesso alla Google Cloud Console

## 🚀 Setup Passo-Passo

### 1. Configurazione Google Cloud Console

#### A. Crea/Seleziona un Progetto
1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuovo progetto o seleziona uno esistente
3. Annota il **Project ID** (lo userai nei file di configurazione)

#### B. Abilita le API Necessarie
Abilita le seguenti API nel tuo progetto:
- Gmail API
- Google Drive API
- Google Calendar API (opzionale per future funzionalità)

```bash
# Da Google Cloud Shell o con gcloud CLI installato:
gcloud services enable gmail.googleapis.com
gcloud services enable drive.googleapis.com
gcloud services enable calendar-json.googleapis.com
```

### 2. Configurazione OAuth2 (Per Gmail)

#### A. Crea le Credenziali OAuth2
1. Vai in **APIs & Services > Credentials**
2. Clicca **+ CREATE CREDENTIALS > OAuth 2.0 Client ID**
3. Seleziona **Web application**
4. Aggiungi gli URI di reindirizzamento:
   - `http://localhost:3000/api/auth/gmail/callback` (sviluppo)
   - `https://tuodominio.com/api/auth/gmail/callback` (produzione)

#### B. Scarica le Credenziali
1. Clicca su **Download JSON** per le credenziali appena create
2. Rinomina il file in `gmail-credentials.json`
3. Posizionalo nella cartella `frontend/`

### 3. Configurazione Service Account (Per Google Drive)

#### A. Crea un Service Account
1. Vai in **IAM & Admin > Service Accounts**
2. Clicca **+ CREATE SERVICE ACCOUNT**
3. Compila i dettagli:
   - **Name**: `gestionale-evolvi-service`
   - **Description**: `Service account per Gestionale Evolvi`

#### B. Assegna i Ruoli
Aggiungi questi ruoli al service account:
- **Editor** (per gestire Drive)
- **Gmail API User** (se disponibile)

#### C. Genera la Chiave
1. Clicca sul service account appena creato
2. Vai in **Keys > ADD KEY > Create new key**
3. Seleziona **JSON**
4. Scarica il file e rinominalo in `service-account-key.json`
5. Posizionalo nella cartella `frontend/`

### 4. Configurazione Files Locali

#### Opzione A: Copia dai Template
```bash
# Dalla cartella frontend/
cp gmail-credentials.example.json gmail-credentials.json
cp service-account-key.example.json service-account-key.json
```

#### Opzione B: Usa lo Script di Setup
```bash
# Dalla cartella principale del progetto
chmod +x setup-credentials.sh
./setup-credentials.sh
```

### 5. Compilazione dei File di Configurazione

#### A. Modifica gmail-credentials.json
Sostituisci i placeholder con i tuoi valori:
- `TUO_CLIENT_ID_GOOGLE` → Il tuo Client ID OAuth2
- `TUO_PROGETTO_GOOGLE_CLOUD` → Il tuo Project ID
- `TUO_CLIENT_SECRET_GOOGLE` → Il tuo Client Secret OAuth2

#### B. Modifica service-account-key.json
Incolla il contenuto del file JSON scaricato da Google Cloud Console.

## 🔒 Sicurezza

### ⚠️ IMPORTANTE
- **MAI committare i file delle credenziali reali nel repository**
- I file `*-credentials.json` e `*-service-account*.json` sono già nel .gitignore
- Per la produzione, usa variabili d'ambiente invece dei file JSON

### Configurazione Produzione
Per deploy su Vercel/Netlify/Railway:
```bash
# Variabili d'ambiente da configurare:
GOOGLE_CLIENT_ID=tuo_client_id
GOOGLE_CLIENT_SECRET=tuo_client_secret
GOOGLE_PROJECT_ID=tuo_project_id
GOOGLE_PRIVATE_KEY=tua_private_key
GOOGLE_CLIENT_EMAIL=tuo_service_account_email
```

## 🧪 Test della Configurazione

```bash
# Avvia il server di sviluppo
cd frontend
npm run dev

# Testa l'integrazione Gmail
curl http://localhost:3000/api/gmail/status

# Testa l'integrazione Google Drive
curl http://localhost:3000/api/debug-drive
```

## 🆘 Risoluzione Problemi

### Errore: "Invalid client_id"
- Verifica che il Client ID in `gmail-credentials.json` sia corretto
- Controlla che l'URI di reindirizzamento sia configurato correttamente

### Errore: "Access denied"
- Verifica che le API siano abilitate nel progetto Google Cloud
- Controlla i permessi del Service Account

### Errore: "File not found"
- Verifica che i file `gmail-credentials.json` e `service-account-key.json` esistano nella cartella `frontend/`
- Controlla che i file non siano vuoti o corrotti

## 📞 Supporto

Per problemi specifici:
1. Verifica i log del browser (F12 → Console)
2. Controlla i log del server Next.js
3. Consulta la [documentazione Google Cloud](https://cloud.google.com/docs)

---

💡 **Suggerimento**: Salva questo documento e i tuoi file di credenziali in un luogo sicuro per configurazioni future!