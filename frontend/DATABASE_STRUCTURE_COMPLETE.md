# 🗄️ DATABASE STRUCTURE - COMPLETE REFERENCE
*Generato automaticamente il 14/11/2025*

## 📊 STATISTICHE GENERALI

**Totale tabelle:** 15
**Tabelle con dati:** 8
**Tabelle vuote:** 7

---

## 📋 LISTA TABELLE E RECORD COUNT

| Tabella | Record | Stato |
|---------|--------|-------|
| scadenze_bandi_ateco_2025 | 3257 | ✅ POPOLATA |
| scadenze_bandi_bandi | 2 | ✅ POPOLATA |
| scadenze_bandi_clienti | 6 | ✅ POPOLATA |
| scadenze_bandi_collegamenti_aziendali | 0 | ❌ VUOTA |
| scadenze_bandi_contatti | 0 | ❌ VUOTA |
| scadenze_bandi_documenti | 1 | ✅ POPOLATA |
| scadenze_bandi_documenti_bando | 0 | ❌ VUOTA |
| scadenze_bandi_documenti_cliente | 0 | ❌ VUOTA |
| scadenze_bandi_documenti_progetto | 0 | ❌ VUOTA |
| scadenze_bandi_legali_rappresentanti | 0 | ❌ VUOTA |
| scadenze_bandi_progetti | 3 | ✅ POPOLATA |
| scadenze_bandi_scadenze | 16 | ✅ POPOLATA |
| scadenze_bandi_template_scadenze | 8 | ✅ POPOLATA |
| scadenze_bandi_tipologie_bando | 8 | ✅ POPOLATA |
| scadenze_bandi_tipologie_scadenze | 20 | ✅ POPOLATA |

---

## 🗂️ STRUTTURA DETTAGLIATA TABELLE

### 1. `scadenze_bandi_ateco_2025` ✅ (3257 record)
**Codici ATECO 2025**

| Campo | Tipo | Nullable | Default | Note |
|-------|------|----------|---------|------|
| codice | text | NO | - | Codice ATECO |
| descrizione | text | NO | - | Descrizione attività |
| livello | integer | NO | - | Livello gerarchico |
| codice_padre | text | YES | - | Codice ATECO padre |
| attivo | boolean | YES | true | Se attivo |
| note | text | YES | - | Note aggiuntive |
| created_at | timestamptz | YES | now() | Data creazione |

---

### 2. `scadenze_bandi_bandi` ✅ (2 record)
**Bandi disponibili**

| Campo | Tipo | Nullable | Default | Note |
|-------|------|----------|---------|------|
| id | uuid | NO | uuid_generate_v4() | ID univoco |
| **nome** | text | NO | - | **NOME DEL BANDO** |
| descrizione | text | YES | - | Descrizione |
| tipo_bando | text | YES | - | Tipologia |
| stato | USER-DEFINED | YES | 'attivo' | Stato bando |
| created_at | timestamptz | YES | now() | Data creazione |
| updated_at | timestamptz | YES | now() | Ultimo aggiornamento |
| codice_bando | varchar(50) | YES | - | Codice identificativo |
| ente_erogatore | text | YES | - | Ente che eroga |
| tipologia_bando | text | YES | - | Tipologia bando |
| contributo_massimo | numeric(15,2) | YES | - | Contributo max |
| budget_totale | numeric(15,2) | YES | - | Budget totale |
| percentuale_contributo | numeric(5,2) | YES | - | % contributo |
| data_pubblicazione | date | YES | - | Data pubblicazione |
| data_apertura_presentazione | date | YES | - | Data apertura |
| data_chiusura_presentazione | date | YES | - | Data chiusura |
| tempo_valutazione_giorni | integer | YES | 90 | Giorni valutazione |
| data_pubblicazione_graduatoria | date | YES | - | Data graduatoria |
| link_bando_ufficiale | text | YES | - | Link ufficiale |
| documenti_paths | ARRAY | YES | - | Percorsi documenti |
| settori_ammessi | ARRAY | YES | - | Settori ammessi |
| dimensioni_aziendali_ammesse | ARRAY | YES | - | Dimensioni ammesse |
| localizzazione_geografica | text | YES | - | Area geografica |
| note_interne | text | YES | - | Note interne |
| referente_bando | text | YES | - | Referente |
| email_referente | text | YES | - | Email referente |
| stato_bando | USER-DEFINED | YES | 'PROSSIMA_APERTURA' | Stato |
| tipo_valutazione | USER-DEFINED | YES | 'A_PUNTEGGIO' | Tipo valutazione |
| spesa_minima_ammessa | numeric(12,2) | YES | 0 | Spesa minima |
| regime_aiuto | text | YES | 'DE_MINIMIS' | Regime aiuto |

---

### 3. `scadenze_bandi_clienti` ✅ (6 record)
**Anagrafica clienti**

| Campo | Tipo | Nullable | Default | Note |
|-------|------|----------|---------|------|
| id | uuid | NO | uuid_generate_v4() | ID univoco |
| **denominazione** | text | NO | - | **NOME AZIENDA** |
| numero_azienda | text | YES | AUTO | Numero azienda auto |
| **partita_iva** | text | YES | - | **P.IVA** |
| rea | text | YES | - | N. REA |
| **codice_fiscale** | text | YES | - | **CF** |
| ateco_2025 | text | YES | - | Codice ATECO |
| ateco_descrizione | text | YES | - | Descrizione ATECO |
| data_costituzione | date | YES | - | Data costituzione |
| **email** | text | YES | - | **EMAIL** |
| **pec** | text | YES | - | **PEC** |
| **telefono** | text | YES | - | **TELEFONO** |
| sito_web | text | YES | - | Sito web |
| coordinate_bancarie | text | YES | - | IBAN |
| sdi | text | YES | - | Codice SDI |
| **indirizzo_fatturazione** | text | YES | - | **INDIRIZZO** |
| **cap_fatturazione** | text | YES | - | **CAP** |
| **citta_fatturazione** | text | YES | - | **CITTÀ** |
| **provincia_fatturazione** | text | YES | - | **PROVINCIA** |
| stato_fatturazione | text | YES | 'Italia' | Stato |
| **ula** | numeric(10,2) | YES | - | **ULA** |
| **ultimo_fatturato** | numeric(15,2) | YES | - | **FATTURATO** |
| attivo_bilancio | numeric(15,2) | YES | - | Attivo bilancio |
| **dimensione** | USER-DEFINED | YES | - | **DIMENSIONE** |
| matricola_inps | text | YES | - | Matricola INPS |
| pat_inail | text | YES | - | PAT INAIL |
| numero_dipendenti | integer | YES | 0 | N. dipendenti |

---

### 4. `scadenze_bandi_progetti` ✅ (3 record)
**Progetti associati ai bandi**

⚠️ **NOTA:** Struttura da completare - necessario eseguire query specifica per questa tabella

---

### 5. `scadenze_bandi_scadenze` ✅ (16 record)
**Scadenze dei progetti**

⚠️ **NOTA:** Struttura da completare - necessario eseguire query specifica per questa tabella

---

### 6. `scadenze_bandi_template_scadenze` ✅ (8 record)
**Template per generazione scadenze**

⚠️ **NOTA:** Struttura da completare - necessario eseguire query specifica per questa tabella

---

### 7. `scadenze_bandi_documenti` ✅ (1 record)
**Documenti generici**

⚠️ **NOTA:** Struttura da completare - necessario eseguire query specifica per questa tabella

---

### 8. `scadenze_bandi_tipologie_bando` ✅ (8 record)
**Tipologie di bando**

⚠️ **NOTA:** Struttura da completare - necessario eseguire query specifica per questa tabella

---

### 9. `scadenze_bandi_tipologie_scadenze` ✅ (20 record)
**Tipologie di scadenze**

⚠️ **NOTA:** Struttura da completare - necessario eseguire query specifica per questa tabella

---

## 🚨 TABELLE VUOTE (0 record)

### `scadenze_bandi_collegamenti_aziendali` ❌
**Collegamenti tra aziende**
- Struttura da analizzare

### `scadenze_bandi_contatti` ❌
**Contatti aziendali**
- Struttura da analizzare

### `scadenze_bandi_documenti_bando` ❌
**Documenti specifici del bando**
- Struttura da analizzare

### `scadenze_bandi_documenti_cliente` ❌
**Documenti del cliente**
- Struttura da analizzare

### `scadenze_bandi_documenti_progetto` ❌
**Documenti del progetto**
- Struttura da analizzare
- ⚠️ **PROBLEMA:** Query fallisce per campo `bando_id` inesistente

### `scadenze_bandi_legali_rappresentanti` ❌
**Legali rappresentanti**
- Struttura da analizzare

---

## 🎯 CAMPI CHIAVE IDENTIFICATI

### Per Template Editor (Placeholder):
- **denominazione** (scadenze_bandi_clienti)
- **partita_iva** (scadenze_bandi_clienti)
- **codice_fiscale** (scadenze_bandi_clienti)
- **email** (scadenze_bandi_clienti)
- **telefono** (scadenze_bandi_clienti)
- **indirizzo_fatturazione** (scadenze_bandi_clienti)
- **citta_fatturazione** (scadenze_bandi_clienti)
- **ula** (scadenze_bandi_clienti)
- **ultimo_fatturato** (scadenze_bandi_clienti)

### Per Query Bandi:
- **nome** (scadenze_bandi_bandi) ⚠️ NON "titolo"

---

## ⚡ AZIONI RICHIESTE

1. **Completare struttura tabelle popolate** - Eseguire query specifiche per:
   - scadenze_bandi_progetti
   - scadenze_bandi_scadenze
   - scadenze_bandi_template_scadenze
   - scadenze_bandi_documenti
   - scadenze_bandi_tipologie_bando
   - scadenze_bandi_tipologie_scadenze

2. **Analizzare tabelle vuote** - Capire struttura e utilizzo previsto

3. **Correggere query errate** - Sostituire "titolo" con "nome" nel codice

---

**📝 IMPORTANTE:** Questo file deve essere aggiornato ogni volta che si modifica la struttura del database!