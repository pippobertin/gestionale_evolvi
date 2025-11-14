# Database Structure Documentation
*Generato automaticamente il 14/11/2025*

## 📋 Panoramica Sistema Scadenze BLM

Il sistema gestisce bandi, clienti, progetti e scadenze attraverso un database relazionale PostgreSQL.

---

## 🗂️ Tabelle Principali

### 1. `scadenze_bandi_bandi` ⚠️ VUOTA (0 record)
**Gestisce i bandi disponibili**

**⚠️ PROBLEMA IDENTIFICATO:** La tabella esiste ma è vuota, questo spiega gli errori di caricamento.
- Il codice cerca il campo `titolo` ma probabilmente il campo corretto è `nome`
- Necessario popolare la tabella o verificare la migrazione

---

### 2. `scadenze_bandi_clienti` ✅ POPOLATA (6 record)
**Gestisce l'anagrafica clienti**

**Campi principali:**
- `id` (string) - UUID identificativo
- `denominazione` (string) - Nome dell'azienda
- `numero_azienda` (string) - Codice interno (es: AZ2025000003)
- `partita_iva` (nullable) - P.IVA dell'azienda
- `codice_fiscale` (nullable) - CF dell'azienda
- `email`, `pec`, `telefono` (nullable) - Contatti
- `ula` (number) - Unità Lavorative Attive
- `ultimo_fatturato` (number) - Fatturato ultimo anno
- `dimensione` (string) - Dimensione aziendale (es: "MICRO")
- `tipo_collegamento` (string) - Tipo collegamento (es: "AUTONOMA")

**Dati legale rappresentante:**
- `legale_rappresentante_*` (vari campi nullable) - Dati del rappresentante legale

**Esempio record:**
```json
{
  "id": "1623f69f-18fb-47b4-bf65-10b7166473e2",
  "denominazione": "Test Auto-Gen",
  "numero_azienda": "AZ2025000003",
  "ula": 5,
  "ultimo_fatturato": 150000,
  "dimensione": "MICRO",
  "tipo_collegamento": "AUTONOMA"
}
```

---

### 3. `scadenze_bandi_progetti` ✅ POPOLATA (2 record)
**Gestisce i progetti associati ai bandi**

**Campi principali:**
- `id` (string) - UUID identificativo
- `bando_id` (string) - FK verso scadenze_bandi_bandi
- `cliente_id` (string) - FK verso scadenze_bandi_clienti
- `codice_progetto` (string) - Codice univoco (es: PRJ-2025-004)
- `titolo_progetto` (string) - Titolo descrittivo
- `stato` (string) - Stato progetto (es: "DECRETO_ATTESO")
- `importo_totale_progetto` (number) - Valore totale
- `contributo_ammesso` (number) - Contributo concesso
- `percentuale_contributo` (number) - Percentuale contributo

**Date importanti:**
- `data_pubblicazione_graduatoria` (string/date) - Data pubblicazione
- `data_decreto_concessione` (nullable) - Data decreto
- `scadenza_accettazione_esiti` (nullable) - Scadenza accettazione
- `data_avvio_progetto` (nullable) - Data avvio
- `data_fine_progetto_prevista` (nullable) - Fine prevista

**Gestione SAL:**
- `anticipo_richiedibile` (boolean) - Se richiedibile anticipo
- `percentuale_anticipo` (number) - Percentuale anticipo (es: 30)
- `numero_sal` (string) - Numero SAL (es: "DUE")
- `proroga_richiedibile` (boolean) - Se richiedibile proroga

---

### 4. `scadenze_bandi_scadenze` ⚠️ VUOTA (0 record)
**Gestisce le scadenze specifiche dei progetti**

**⚠️ PROBLEMA:** La tabella esiste ma è vuota, anche se dal log vediamo che vengono generate scadenze.
- Possibile problema di inserimento
- Verificare permessi o constraint sulla tabella

---

### 5. `scadenze_bandi_template_scadenze` ✅ POPOLATA (8 record)
**Template per generazione automatica scadenze**

**Campi principali:**
- `id` (string) - UUID identificativo
- `bando_id` (string) - FK verso scadenze_bandi_bandi
- `nome` (string) - Nome della scadenza (es: "Avvio")
- `descrizione` (string) - Descrizione dettagliata
- `giorni_da_evento` (number) - Giorni dall'evento di riferimento
- `evento_riferimento` (string) - Evento base (es: "pubblicazione_graduatoria")
- `tipo_scadenza` (string) - Tipologia (es: "avvio")
- `priorita` (string) - Priorità (es: "critica", "alta", "media")
- `obbligatoria` (boolean) - Se la scadenza è obbligatoria
- `ordine_sequenza` (number) - Ordine di esecuzione
- `responsabile_suggerito` (string) - Email responsabile

**Esempio record:**
```json
{
  "id": "a8d0bb97-854e-4dec-ae5f-7f98f8ca9b75",
  "bando_id": "0964a334-f473-419c-aefc-b1425309e36d",
  "nome": "Avvio",
  "descrizione": "Accettazione formale degli esiti del bando",
  "giorni_da_evento": 10,
  "evento_riferimento": "pubblicazione_graduatoria",
  "priorita": "critica",
  "obbligatoria": true
}
```

---

### 6. `scadenze_bandi_documenti_progetto` ⚠️ VUOTA (0 record)
**Gestisce i documenti allegati ai progetti**

**⚠️ PROBLEMA:** Tabella vuota - documenti non vengono salvati.

---

### 7. `scadenze_bandi_documenti_progetto_view` ⚠️ VUOTA (0 record)
**Vista per documenti progetti**

**⚠️ PROBLEMA:** Vista vuota, dipende dalla tabella documenti.

---

## 🔧 Problemi Identificati e Soluzioni

### ❌ Problema 1: Tabella `scadenze_bandi_bandi` vuota
**Sintomo:** Errori "Errore caricamento bandi"
**Causa:** Tabella non popolata
**Soluzione:**
1. Verificare se esistono bandi nel sistema
2. Popolare la tabella con dati di test
3. Verificare field mapping `nome` vs `titolo`

### ❌ Problema 2: Tabella `scadenze_bandi_scadenze` vuota
**Sintomo:** Scadenze non visibili nonostante generazione
**Causa:** Inserimenti falliscono silenziosamente
**Soluzione:**
1. Verificare constraint e foreign key
2. Verificare permessi di INSERT
3. Verificare transaction commit

### ❌ Problema 3: Documenti non salvati
**Sintomo:** Tab documenti vuota
**Causa:** Tabella `scadenze_bandi_documenti_progetto` vuota
**Soluzione:**
1. Verificare logica di salvataggio documenti
2. Verificare storage Supabase
3. Testare upload manuale

---

## 🎯 Raccomandazioni Immediate

1. **Popolare tabella bandi** con almeno un record di test
2. **Verificare inserimenti scadenze** con query diretta
3. **Testare upload documenti** con debug
4. **Implementare logging** per tracking errori DB
5. **Aggiungere validazione** constraint sui campi obbligatori

---

## 📊 Statistiche Attuali

- **Clienti:** 6 record ✅
- **Progetti:** 2 record ✅
- **Template Scadenze:** 8 record ✅
- **Bandi:** 0 record ❌
- **Scadenze:** 0 record ❌
- **Documenti:** 0 record ❌

**Tasso di successo tabelle:** 3/7 (43%) - Necessarie correzioni urgenti.