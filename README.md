# Gestionale Scadenze BLM - Sistema Evolvi

Sistema di gestione bandi, progetti e scadenze per BLM.

## 📁 Struttura Progetto

```
├── frontend/           # Applicazione Next.js
├── docs/              # Documentazione del progetto
│   └── sql/           # Schema database e setup SQL
├── data/              # File dati (CSV, PDF)
├── _dev_archive/      # File di sviluppo archiviati
└── README.md          # Questo file
```

## 🚀 Avvio Rapido

```bash
cd frontend
npm install
npm run dev
```

L'applicazione sarà disponibile su http://localhost:3000

## 📋 Funzionalità Principali

- **Gestione Bandi**: Creazione e gestione bandi con template scadenze
- **Gestione Clienti**: Database completo delle aziende
- **Gestione Progetti**: Creazione progetti da bandi vinti
- **Sistema Scadenze**: Ricalcolo automatico delle scadenze in base ai template
- **Dashboard**: Visualizzazione generale dello stato progetti e scadenze

## 🗄️ Database

Il sistema utilizza Supabase come database e storage.

Schema principale:
- `clienti` - Anagrafica aziende
- `scadenze_bandi_bandi` - Gestione bandi
- `scadenze_bandi_progetti` - Progetti attivi
- `scadenze_bandi_scadenze` - Sistema scadenze
- `scadenze_bandi_template_scadenze` - Template per ricalcolo automatico

## 📚 Documentazione

- `docs/sql/` - Script di setup database
- `RIASSUNTO_SVILUPPO.md` - Cronologia sviluppo
- `struttura_collegamenti.md` - Schema relazioni database

## 🔧 Configurazione

1. Configurare le variabili d'ambiente in `frontend/.env.local`
2. Eseguire gli script SQL di setup da `docs/sql/`
3. Popolare i dati ATECO se necessario

## 📦 Dipendenze Principali

- **Next.js 16** - Framework React
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase** - Database e autenticazione
- **Lucide React** - Icone
- **Date-fns** - Gestione date

## 🗂️ File Archiviati

I file di sviluppo e debug sono stati spostati in `_dev_archive/` per mantenere pulita la root del progetto.