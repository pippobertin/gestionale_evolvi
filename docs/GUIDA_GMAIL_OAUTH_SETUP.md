# Guida Completa: Configurazione Gmail OAuth2 per Gestionale Evolvi

## Indice
1. [Configurazione EXTERNAL (testare ora con Gmail personali)](#fase-1-configurazione-external)
2. [Configurazione INTERNAL (dopo migrazione Workspace)](#fase-2-configurazione-internal)
3. [Configurazione Vercel](#configurazione-vercel)
4. [Test e Verifica](#test-e-verifica)
5. [Troubleshooting](#troubleshooting)

---

## FASE 1: Configurazione EXTERNAL

> **Quando usare**: Subito, per testare con account Gmail personali (es. `info@blmproject.com`, `filippo.bertin@gmail.com`, etc.)

### Step 1: Accedi a Google Cloud Console

1. Vai su https://console.cloud.google.com
2. In alto a sinistra, seleziona il progetto **"gestionale-evolvi-drive"**
   - Se non lo vedi, clicca sul dropdown e cercalo nella lista
3. ✅ Verifica di essere nel progetto corretto (nome visibile in alto)

---

### Step 2: Abilita Gmail API

1. Menu (☰) → **APIs & Services** → **Library**
2. Nella barra di ricerca, scrivi: **Gmail API**
3. Clicca su **Gmail API**
4. Clicca **ENABLE** (se già abilitata, vedrai "MANAGE")
5. ✅ Gmail API ora abilitata

---

### Step 3: Configura OAuth Consent Screen (EXTERNAL)

1. Menu (☰) → **APIs & Services** → **OAuth consent screen**

2. **User Type**: Seleziona **External**
   - ⚠️ Importante: Scegli "External" perché vuoi usare Gmail personali
   - Clicca **CREATE**

3. **App information**:
   - **App name**: `Gestionale Evolvi`
   - **User support email**: `info@blmproject.com` (o la tua email)
   - **App logo**: (opzionale, puoi caricare il logo BLM se vuoi)

4. **App domain** (opzionale ma consigliato):
   - **Application home page**: `https://gestionale.blmproject.com`
   - **Application privacy policy link**: `https://gestionale.blmproject.com/privacy` (se esiste)
   - **Application terms of service link**: `https://gestionale.blmproject.com/terms` (se esiste)

5. **Authorized domains**:
   - Clicca **+ ADD DOMAIN**
   - Aggiungi: `blmproject.com`
   - ✅ Salva

6. **Developer contact information**:
   - Email addresses: `info@blmproject.com`
   - Clicca **SAVE AND CONTINUE**

7. **Scopes** (permessi richiesti):
   - Clicca **ADD OR REMOVE SCOPES**
   - Nella barra di ricerca, cerca e seleziona questi scopes:
     - ✅ `.../auth/gmail.readonly` - "See all your email messages and settings"
     - ✅ `.../auth/gmail.send` - "Send email on your behalf"
     - ✅ `.../auth/gmail.modify` - "View and modify but not delete your email"
     - ✅ `.../auth/userinfo.email` - "See your primary Google Account email address"
   - Clicca **UPDATE**
   - Clicca **SAVE AND CONTINUE**

8. **Test users** (IMPORTANTE per External):
   - Clicca **+ ADD USERS**
   - Aggiungi gli indirizzi email che vuoi testare:
     - `info@blmproject.com`
     - `filippo.bertin@gmail.com` (il tuo account test)
     - Aggiungi altri se necessario (max 100 utenti in test mode)
   - Clicca **ADD**
   - Clicca **SAVE AND CONTINUE**

9. **Summary**:
   - Verifica che tutto sia corretto
   - Clicca **BACK TO DASHBOARD**

10. ⚠️ **Stato dell'app**: Vedrai "Testing"
    - Questo è normale per app External
    - Solo gli utenti che hai aggiunto in "Test users" possono usare l'app
    - ✅ Va bene così per ora

---

### Step 4: Crea OAuth 2.0 Client ID

1. Menu (☰) → **APIs & Services** → **Credentials**

2. In alto, clicca **+ CREATE CREDENTIALS**
3. Seleziona **OAuth client ID**

4. **Application type**: Seleziona **Web application**

5. **Name**: `Gestionale Evolvi Web Client`

6. **Authorized JavaScript origins** (opzionale):
   - Clicca **+ ADD URI**
   - Aggiungi: `https://gestionale.blmproject.com`

7. **Authorized redirect URIs** (IMPORTANTISSIMO ⚠️):
   - Clicca **+ ADD URI**
   - Aggiungi **ESATTAMENTE** questo URL:
     ```
     https://gestionale.blmproject.com/api/user/gmail/callback
     ```
   - ⚠️ **ATTENZIONE**:
     - Nessuno spazio prima/dopo
     - No `/` finale
     - Deve essere identico
     - Usa HTTPS (non HTTP)

8. Clicca **CREATE**

9. **Popup: "OAuth client created"**:
   - 📋 **Copia il Client ID** (es. `123456789-abc.apps.googleusercontent.com`)
   - 📋 **Copia il Client Secret** (es. `GOCSPX-abc123xyz`)
   - ⚠️ **IMPORTANTE**: Salva questi valori in un posto sicuro (li userai su Vercel)
   - Clicca **OK**

10. ✅ OAuth Client creato con successo

---

## Configurazione Vercel

### Step 1: Aggiungi Environment Variables

1. Vai su https://vercel.com
2. Seleziona il progetto **gestionale_evolvi** (o come lo hai chiamato)
3. Vai su **Settings** → **Environment Variables**

4. **Aggiungi GOOGLE_CLIENT_ID**:
   - **Key**: `GOOGLE_CLIENT_ID`
   - **Value**: Il Client ID che hai copiato (es. `123456789-abc.apps.googleusercontent.com`)
   - **Environment**: Seleziona tutti (Production, Preview, Development)
   - Clicca **Save**

5. **Aggiungi GOOGLE_CLIENT_SECRET**:
   - **Key**: `GOOGLE_CLIENT_SECRET`
   - **Value**: Il Client Secret che hai copiato (es. `GOCSPX-abc123xyz`)
   - **Environment**: Seleziona tutti (Production, Preview, Development)
   - Clicca **Save**

6. ✅ Variabili configurate

### Step 2: Redeploy

1. Vai su **Deployments**
2. Clicca sui **...** (tre puntini) dell'ultimo deployment
3. Clicca **Redeploy**
4. ✅ Aspetta che il deployment finisca (1-2 minuti)

---

## Test e Verifica (EXTERNAL)

### Test 1: Connetti Gmail

1. Vai su `https://gestionale.blmproject.com`
2. **Login** con un utente (es. il tuo utente test)
3. **Impostazioni** → **Il Mio Gmail**
4. Clicca **Connetti account Gmail**

### Cosa aspettarsi:

✅ **Successo**: Vieni reindirizzato a Google
- Ti chiede di scegliere l'account Gmail
- **⚠️ Warning**: Vedrai "Google hasn't verified this app" (normale in test mode)
  - Clicca **Advanced** (o "Avanzate")
  - Clicca **Go to Gestionale Evolvi (unsafe)** (è sicuro, è la tua app!)
- Ti chiede di autorizzare i permessi Gmail
- Clicca **Allow** (o "Consenti")
- Vieni reindirizzato al gestionale con messaggio di successo
- ✅ Gmail connesso!

❌ **Errori comuni**:
- "redirect_uri_mismatch" → Controlla che il redirect URI sia esattamente `https://gestionale.blmproject.com/api/user/gmail/callback`
- "Access blocked: This app's request is invalid" → L'account Gmail non è nella lista "Test users"
- "401 Unauthorized" → Fai logout e login di nuovo per aggiornare il cookie

### Test 2: Invia Email

1. Vai su una scadenza o progetto
2. Prova a inviare un'email
3. ✅ L'email dovrebbe partire dal tuo account Gmail personale connesso

---

## FASE 2: Configurazione INTERNAL

> **Quando usare**: Dopo la migrazione a Google Workspace, quando tutti hanno email `@blmproject.com`

### Quando Migrare a Internal

Migra da External a Internal quando:
- ✅ Hai completato la migrazione a Google Workspace
- ✅ Tutti gli utenti hanno email `@blmproject.com`
- ✅ Vuoi maggiore sicurezza (solo utenti dell'organizzazione)

---

### Step 1: Modifica OAuth Consent Screen

1. Menu (☰) → **APIs & Services** → **OAuth consent screen**

2. **Publishing status**: Vedrai "Testing"
   - ⚠️ Prima di cambiare a Internal, devi unpublish se hai pubblicato
   - Se è "Testing", puoi procedere direttamente

3. In alto a destra, clicca **MAKE INTERNAL**
   - Google ti chiederà conferma
   - ⚠️ **ATTENZIONE**: Una volta cambiato a Internal, solo gli utenti `@blmproject.com` potranno usare l'app
   - Clicca **CONFIRM**

4. ✅ User Type ora è **Internal**

5. **Rimuovi Test Users** (non servono più per Internal):
   - Vai su **Test users**
   - Clicca **REMOVE** per ogni utente
   - ✅ Con Internal, tutti gli utenti dell'organizzazione Workspace possono accedere automaticamente

---

### Step 2: Verifica Scopes (sono già configurati)

1. Vai su **Scopes** nella OAuth consent screen
2. Verifica che ci siano gli stessi scopes:
   - `.../auth/gmail.readonly`
   - `.../auth/gmail.send`
   - `.../auth/gmail.modify`
   - `.../auth/userinfo.email`
3. ✅ Non serve cambiare nulla

---

### Step 3: OAuth Client ID (resta lo stesso)

- ✅ **NON serve ricreare** il Client ID
- ✅ Il Client ID e Client Secret rimangono gli stessi
- ✅ Il redirect URI rimane lo stesso
- ⚠️ Se hai cambiato dominio o URL, aggiorna solo il redirect URI

---

### Step 4: Vercel (nessuna modifica)

- ✅ Le variabili `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` rimangono le stesse
- ⚠️ **NON serve redeploy** dopo il cambio a Internal

---

## Test e Verifica (INTERNAL)

### Test con Account Workspace

1. Gli utenti devono **disconnettere** il Gmail se era già connesso (con account External)
   - Impostazioni → Il Mio Gmail → Disconnetti

2. **Riconnetti** Gmail
   - Clicca **Connetti account Gmail**
   - Scegli l'account `@blmproject.com`
   - ⚠️ **NON vedrai più** il warning "Google hasn't verified this app" (perché è Internal!)
   - Autorizza i permessi
   - ✅ Connesso

3. ✅ Ora le email vengono inviate da `nome@blmproject.com`

---

## Differenze External vs Internal

| Caratteristica | EXTERNAL | INTERNAL |
|---------------|----------|----------|
| **Chi può usare** | Qualsiasi Gmail (se in Test users) | Solo utenti `@blmproject.com` |
| **Verifica Google** | Warning "App not verified" | Nessun warning |
| **Test users** | Necessari (max 100) | Non necessari |
| **Pubblicazione** | Opzionale (richiede verifica Google) | Non richiesta |
| **Sicurezza** | Media | Alta |
| **Quando usare** | Test, utenti esterni | Produzione, solo team interno |

---

## Troubleshooting

### Errore: "redirect_uri_mismatch"

**Causa**: Il redirect URI in Google Cloud non corrisponde a quello usato dall'app

**Soluzione**:
1. Vai su Google Cloud Console → APIs & Services → Credentials
2. Clicca sul tuo OAuth Client ID
3. Verifica che **Authorized redirect URIs** contenga ESATTAMENTE:
   ```
   https://gestionale.blmproject.com/api/user/gmail/callback
   ```
4. Controlla:
   - Nessuno spazio
   - HTTPS (non HTTP)
   - No `/` finale
   - Dominio corretto

---

### Errore: "Access blocked: This app's request is invalid"

**Causa**: L'utente non è nella lista "Test users" (solo per External)

**Soluzione**:
1. OAuth consent screen → Test users
2. Aggiungi l'email dell'utente
3. Salva
4. Riprova

---

### Errore: "401 Unauthorized" quando clicco "Connetti Gmail"

**Causa**: Il cookie auth_token non è impostato correttamente

**Soluzione**:
1. Fai **logout** dal gestionale
2. Fai **login** di nuovo
3. Vai su Impostazioni → Il Mio Gmail
4. Riprova

---

### Warning: "Google hasn't verified this app"

**Causa**: Normale per app External in modalità Testing

**Soluzione**:
- ✅ È sicuro procedere (è la tua app!)
- Clicca **Advanced** → **Go to Gestionale Evolvi (unsafe)**

**Oppure**:
- Pubblica l'app (richiede processo di verifica Google, 4-6 settimane)
- Passa a **Internal** quando hai Google Workspace

---

### L'email non parte dal mio account Gmail

**Verifica**:
1. Impostazioni → Il Mio Gmail
2. Controlla che sia **Connesso** e mostri la tua email
3. Se non connesso, clicca **Connetti Gmail**

**Se già connesso ma non funziona**:
1. Disconnetti Gmail
2. Riconnetti
3. Riprova a inviare email

---

### Voglio cambiare da External a Internal

**Procedura**:
1. OAuth consent screen → **MAKE INTERNAL** (in alto a destra)
2. Conferma
3. Rimuovi tutti i Test users (non servono più)
4. ✅ Fatto! Non serve altro

**⚠️ Ricorda**: Dopo il cambio, solo utenti `@blmproject.com` potranno connettere Gmail

---

### Voglio tornare da Internal a External

**Procedura**:
1. OAuth consent screen → **MAKE EXTERNAL** (in alto a destra)
2. Conferma
3. Aggiungi nuovamente i Test users
4. ✅ Fatto!

---

## Checklist Completa

### Configurazione EXTERNAL (ora)

- [ ] Progetto Google Cloud selezionato: "gestionale-evolvi-drive"
- [ ] Gmail API abilitata
- [ ] OAuth Consent Screen configurato:
  - [ ] User Type: External
  - [ ] App name: Gestionale Evolvi
  - [ ] Scopes aggiunti (4 scopes Gmail)
  - [ ] Test users aggiunti (le email che vuoi testare)
- [ ] OAuth 2.0 Client ID creato:
  - [ ] Type: Web application
  - [ ] Redirect URI: `https://gestionale.blmproject.com/api/user/gmail/callback`
  - [ ] Client ID copiato
  - [ ] Client Secret copiato
- [ ] Vercel configurato:
  - [ ] GOOGLE_CLIENT_ID aggiunto
  - [ ] GOOGLE_CLIENT_SECRET aggiunto
  - [ ] Redeploy effettuato
- [ ] Test completato:
  - [ ] Login effettuato
  - [ ] Gmail connesso con successo
  - [ ] Email inviata dal proprio account

### Migrazione a INTERNAL (dopo Workspace)

- [ ] Google Workspace attivo
- [ ] Tutti gli utenti hanno email @blmproject.com
- [ ] OAuth Consent Screen:
  - [ ] Cambiato a Internal
  - [ ] Test users rimossi
- [ ] Test con account Workspace:
  - [ ] Vecchia connessione disconnessa
  - [ ] Riconnessione con @blmproject.com
  - [ ] Email inviate con successo

---

## Supporto

Se hai problemi:
1. Controlla la sezione [Troubleshooting](#troubleshooting)
2. Verifica i log su Vercel → Deployments → Function Logs
3. Controlla la console del browser (F12)

---

**✅ Fine della guida - Buona configurazione!**
