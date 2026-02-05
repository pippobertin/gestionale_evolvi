# Modelli Contratto

Questa cartella contiene i modelli di contratto per la generazione automatica.

## Struttura File

Salva i modelli contratto in questa cartella con i seguenti formati supportati:
- `.docx` - File Microsoft Word
- `.pdf` - File PDF (solo lettura)
- `.txt` - Template di testo

## Placeholder Supportati

Usa questi placeholder nei tuoi modelli:

### Dati Cliente
- `{{denominazione_cliente}}` - Nome azienda
- `{{partita_iva}}` - P.IVA cliente
- `{{codice_fiscale}}` - CF cliente
- `{{indirizzo_completo}}` - Indirizzo, CAP, Città, Provincia
- `{{email_cliente}}` - Email cliente
- `{{pec_cliente}}` - PEC cliente
- `{{telefono_cliente}}` - Telefono cliente
- `{{referente_nome}}` - Nome referente
- `{{referente_ruolo}}` - Ruolo referente

### Dati Progetto
- `{{titolo_progetto}}` - Titolo progetto
- `{{codice_progetto}}` - Codice identificativo
- `{{descrizione_progetto}}` - Descrizione dettagliata
- `{{importo_progetto}}` - Importo economico (da inserire manualmente)
- `{{contributo_ammesso}}` - Contributo pubblico ammesso
- `{{percentuale_contributo}}` - Percentuale contributo
- `{{data_oggi}}` - Data odierna

### Dati Bando
- `{{nome_bando}}` - Nome del bando
- `{{codice_bando}}` - Codice bando
- `{{ente_finanziatore}}` - Ente che finanzia
- `{{contributo_massimo}}` - Contributo max del bando

## Esempio Template

```
CONTRATTO DI CONSULENZA

Tra:
BLM Project Srl - P.IVA 12345678901

e

{{denominazione_cliente}}
P.IVA: {{partita_iva}}
{{indirizzo_completo}}
Email: {{email_cliente}}
Referente: {{referente_nome}} ({{referente_ruolo}})

OGGETTO: {{titolo_progetto}}
Progetto: {{codice_progetto}}
Bando: {{nome_bando}} - {{ente_finanziatore}}

IMPORTO: €{{importo_progetto}}

Data: {{data_oggi}}
```

## Istruzioni

1. Carica qui i tuoi modelli contratto
2. Usa i placeholder sopra indicati
3. Il sistema genererà automaticamente i contratti compilati
4. I contratti saranno salvati nella cartella CONTRATTI di ogni progetto su Google Drive