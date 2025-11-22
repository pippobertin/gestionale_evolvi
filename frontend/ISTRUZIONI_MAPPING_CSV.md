# Istruzioni per Mapping CSV Import Clienti

## Problema Identificato
Il sistema di importazione CSV sta cercando di scrivere su colonne database inesistenti, causando l'importazione di solo 398 record su 497 totali.

## Errori nei Log
```
Could not find the 'cap' column → dovrebbe essere 'cap_fatturazione'
Could not find the 'codice_ateco' column → dovrebbe essere 'ateco_2025'
Could not find the 'citta' column → dovrebbe essere 'citta_fatturazione'
```

## Mapping Corretto Richiesto

### File CSV: `/Users/filippobertin/Downloads/Accounts (1).csv`
**Importante**: Utilizzare il CSV modificato con `Azienda_Codice_Fiscale`

### Mappature Critiche da Verificare

| Colonna CSV | ✅ Campo Database Corretto | ❌ Campo Sbagliato |
|-------------|---------------------------|-------------------|
| `Azienda_Codice_Fiscale` | `codice_fiscale` | - |
| `BOX (fatturazione)` | `cap_fatturazione` | `cap` |
| `ATECO` | `ateco_2025` | `codice_ateco` |
| `Città (Fatturazione)` | `citta_fatturazione` | `citta` |
| `Codice Fiscale` (legale rapp.) | `legale_rappresentante_codice_fiscale` | - |

### Mapping Completo Suggerito

```
Nome Azienda → denominazione
Partita IVA → partita_iva
REA → rea
Azienda_Codice_Fiscale → codice_fiscale
ATECO → ateco_2025
Email → email
Data di Costituzione → data_costituzione
PEC → pec
Telefono → telefono
Sito Web → sito_web
Coordinate Bancarie → coordinate_bancarie
SDI → sdi
Categoria → categoria_evolvi
Durata Evolvi → durata_evolvi
Scadenza Evolvi → scadenza_evolvi
Estremi di Iscrizione al RUNTS → estremi_iscrizione_runts
Indirizzo (Fatturazione) → indirizzo_fatturazione
BOX (fatturazione) → cap_fatturazione
Città (Fatturazione) → citta_fatturazione
Provincia (Fatturazione) → provincia_fatturazione
Descrizione → descrizione
ULA → ula
DATO ULTIMO FATTURATO → ultimo_fatturato
Attivo di Bilancio → attivo_bilancio
MATRICOLA INPS → matricola_inps
PAT INAIL → pat_inail
N° VOLONTARI → numero_volontari
N° DIPENDENTI → numero_dipendenti
N° COLLABORATORI ESTERNI → numero_collaboratori

# Legale Rappresentante
Cognome → legale_rappresentante_cognome
Nome → legale_rappresentante_nome
Codice Fiscale → legale_rappresentante_codice_fiscale
Luogo di Nascita → legale_rappresentante_luogo_nascita
Data di Nascita → legale_rappresentante_data_nascita
Email Legale Rappresentante → legale_rappresentante_email
Telefono Legale Rappresentante → legale_rappresentante_telefono
Città di Residenza → legale_rappresentante_citta
CAP Residenza → legale_rappresentante_cap
Indirizzo di Residenza → legale_rappresentante_indirizzo

# Non Mappare
Numero Civico → NON MAPPARE
VISURA → NON MAPPARE
STATUTO → NON MAPPARE
BILANCIO ANNO 0 → NON MAPPARE
```

## Verifica Pre-Import
1. **File CSV**: Verificare che sia il file modificato con `Azienda_Codice_Fiscale`
2. **Mapping Interface**: Controllare che nel dropdown vengano selezionati i campi database corretti
3. **Anteprima**: Verificare che i dati siano mappati correttamente nell'anteprima

## Risultato Atteso
- **Importazione**: 497/497 record (tutti i record del CSV)
- **Errori**: 0 errori di schema database
- **Report**: Statistiche dettagliate con breakdown completo

## Debug se Persistono Errori
Se continua a importare solo 398 record:
1. Verificare che il mapping nell'interfaccia non stia usando `cap`, `codice_ateco`, `citta`
2. Controllare i log per identificare altre colonne problematiche
3. Assicurarsi che il CSV abbia effettivamente `Azienda_Codice_Fiscale` nell'header

## Aggiornamenti Tecnici Fatti
- ✅ Corretto mapping automatico in `ClientiMappingCSV.tsx`
- ✅ Aggiornato endpoint `table-structure` con nomi colonne corretti
- ✅ Corretto mapping API in `import-csv/route.ts` per `ateco_2025` e `ateco_descrizione`