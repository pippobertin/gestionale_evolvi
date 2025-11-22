#!/bin/bash

# Script di Setup Credenziali Google per Gestionale Evolvi
# Questo script ti guida nella configurazione delle credenziali Google

set -e  # Esci in caso di errore

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funzione per stampare messaggi colorati
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🚀 Setup Credenziali Google per Gestionale Evolvi"
echo "=================================================="
echo

# Verifica se siamo nella directory corretta
if [ ! -f "frontend/package.json" ]; then
    print_error "Esegui questo script dalla directory principale del progetto (dove si trova la cartella frontend/)"
    exit 1
fi

print_info "Directory verificata ✓"

# Verifica se i file template esistono
if [ ! -f "frontend/gmail-credentials.example.json" ] || [ ! -f "frontend/service-account-key.example.json" ]; then
    print_error "File template non trovati. Assicurati che esistano:"
    echo "  - frontend/gmail-credentials.example.json"
    echo "  - frontend/service-account-key.example.json"
    exit 1
fi

print_info "File template trovati ✓"

echo
print_warning "Prima di procedere, assicurati di aver completato la configurazione su Google Cloud:"
echo "1. ✓ Progetto Google Cloud creato"
echo "2. ✓ API Gmail e Google Drive abilitate"
echo "3. ✓ Credenziali OAuth2 per Gmail create"
echo "4. ✓ Service Account per Google Drive creato"
echo
read -p "Hai completato tutti i passaggi sopra? (y/n): " -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Completa prima la configurazione su Google Cloud Console."
    print_info "Consulta il file SETUP_GOOGLE_CREDENTIALS.md per istruzioni dettagliate."
    exit 1
fi

echo

# Setup Gmail Credentials
echo "📧 Configurazione Gmail Credentials"
echo "===================================="

if [ -f "frontend/gmail-credentials.json" ]; then
    print_warning "File gmail-credentials.json già esistente."
    read -p "Vuoi sovrascriverlo? (y/n): " -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm frontend/gmail-credentials.json
    else
        print_info "Mantengo il file esistente per Gmail."
        GMAIL_EXISTS=true
    fi
fi

if [ "$GMAIL_EXISTS" != true ]; then
    cp frontend/gmail-credentials.example.json frontend/gmail-credentials.json
    print_success "File gmail-credentials.json creato dal template"

    echo
    print_info "Ora modifica il file frontend/gmail-credentials.json con i tuoi dati:"
    echo "1. Sostituisci 'TUO_CLIENT_ID_GOOGLE' con il tuo Client ID OAuth2"
    echo "2. Sostituisci 'TUO_PROGETTO_GOOGLE_CLOUD' con il tuo Project ID"
    echo "3. Sostituisci 'TUO_CLIENT_SECRET_GOOGLE' con il tuo Client Secret OAuth2"
    echo "4. Aggiorna gli URI di reindirizzamento se necessario"
    echo
    read -p "Premi INVIO quando hai finito di modificare gmail-credentials.json..."
fi

echo

# Setup Service Account Key
echo "🔑 Configurazione Service Account Key"
echo "====================================="

if [ -f "frontend/service-account-key.json" ]; then
    print_warning "File service-account-key.json già esistente."
    read -p "Vuoi sovrascriverlo? (y/n): " -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm frontend/service-account-key.json
    else
        print_info "Mantengo il file esistente per Service Account."
        SERVICE_EXISTS=true
    fi
fi

if [ "$SERVICE_EXISTS" != true ]; then
    echo
    print_info "Hai due opzioni per il service-account-key.json:"
    echo "1. Copia il contenuto dal file JSON scaricato da Google Cloud"
    echo "2. Crea dal template e modifica manualmente"
    echo
    read -p "Vuoi creare dal template? (y/n): " -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp frontend/service-account-key.example.json frontend/service-account-key.json
        print_success "File service-account-key.json creato dal template"
        echo
        print_info "Ora sostituisci TUTTO il contenuto di frontend/service-account-key.json"
        print_info "con il contenuto del file JSON scaricato da Google Cloud Console"
        echo
    else
        touch frontend/service-account-key.json
        print_success "File service-account-key.json vuoto creato"
        echo
        print_info "Incolla il contenuto del file JSON scaricato da Google Cloud Console"
        print_info "direttamente in frontend/service-account-key.json"
        echo
    fi

    read -p "Premi INVIO quando hai finito di configurare service-account-key.json..."
fi

echo

# Verifica dei file
echo "🔍 Verifica Configurazione"
echo "========================="

# Controlla gmail-credentials.json
if grep -q "TUO_CLIENT_ID_GOOGLE" frontend/gmail-credentials.json 2>/dev/null; then
    print_error "gmail-credentials.json contiene ancora placeholder. Completa la configurazione."
    VERIFICATION_FAILED=true
else
    print_success "gmail-credentials.json configurato"
fi

# Controlla service-account-key.json
if grep -q "TUO_PROGETTO_GOOGLE_CLOUD" frontend/service-account-key.json 2>/dev/null; then
    print_error "service-account-key.json contiene ancora placeholder. Completa la configurazione."
    VERIFICATION_FAILED=true
elif [ ! -s "frontend/service-account-key.json" ]; then
    print_error "service-account-key.json è vuoto. Aggiungi il contenuto del file JSON."
    VERIFICATION_FAILED=true
else
    print_success "service-account-key.json configurato"
fi

echo

if [ "$VERIFICATION_FAILED" = true ]; then
    print_error "Configurazione incompleta. Completa i file e riprova."
    exit 1
fi

# Test opzionale
print_info "Configurazione completata! 🎉"
echo
read -p "Vuoi testare la configurazione avviando il server di sviluppo? (y/n): " -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Avvio server di sviluppo..."
    cd frontend
    if [ -f "package-lock.json" ] || [ -f "yarn.lock" ]; then
        if command -v npm &> /dev/null; then
            npm install
            npm run dev
        elif command -v yarn &> /dev/null; then
            yarn install
            yarn dev
        else
            print_error "Né npm né yarn sono installati"
        fi
    else
        print_warning "Installa prima le dipendenze con 'npm install' o 'yarn install'"
    fi
else
    echo
    print_success "Setup completato!"
    print_info "Per testare:"
    echo "  cd frontend"
    echo "  npm install"
    echo "  npm run dev"
    echo
    print_info "Poi visita: http://localhost:3000"
fi

echo
print_warning "RICORDA: Non committare mai i file *-credentials.json nel repository!"
print_info "Questi file sono già nel .gitignore per sicurezza."