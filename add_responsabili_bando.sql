-- Script per gestire responsabili scadenze a livello BANDO invece che per singola scadenza
-- Questo permette di assegnare utenti/gruppi una volta per tutto il bando
-- PREREQUISITO: Sistema gruppi utenti già esistente nel database

-- STEP 1: Aggiungi campo responsabili al BANDO
-- Questo campo JSON conterrà array di responsabili (utenti e/o gruppi)
ALTER TABLE scadenze_bandi_bandi
ADD COLUMN IF NOT EXISTS responsabili_scadenze_json JSONB DEFAULT '[]'::jsonb;

-- Esempio struttura JSON:
-- [
--   {"type": "utente", "id": "uuid-utente-1", "nome": "Mario Rossi", "email": "mario@example.com"},
--   {"type": "gruppo", "id": "uuid-gruppo-1", "nome": "Team Amministrativo"}
-- ]

COMMENT ON COLUMN scadenze_bandi_bandi.responsabili_scadenze_json IS
'Array JSON di responsabili (utenti e/o gruppi) per tutte le scadenze del bando. Formato: [{"type": "utente|gruppo", "id": "uuid", "nome": "...", "email": "..." (solo utenti)}]';

-- STEP 3: Rendi opzionale il campo responsabile_email nelle scadenze
-- (Già opzionale, ma aggiungiamo commento per chiarezza)
COMMENT ON COLUMN scadenze_bandi_scadenze.responsabile_email IS
'Email responsabile specifico per questa scadenza. Se NULL, si usano i responsabili_scadenze_json del bando.';

-- STEP 4: Aggiungi colonna attivo alla tabella gruppi se non esiste
ALTER TABLE scadenze_bandi_gruppi_utenti
ADD COLUMN IF NOT EXISTS attivo BOOLEAN DEFAULT true;

-- STEP 5: Crea indici per performance
CREATE INDEX IF NOT EXISTS idx_bandi_responsabili ON scadenze_bandi_bandi USING GIN (responsabili_scadenze_json);
CREATE INDEX IF NOT EXISTS idx_gruppi_attivo ON scadenze_bandi_gruppi_utenti(attivo) WHERE attivo = true;

-- STEP 6: Verifica risultato
SELECT
    'Sistema responsabili bando configurato!' as status,
    (SELECT COUNT(*) FROM scadenze_bandi_gruppi_utenti) as gruppi_totali,
    (SELECT COUNT(*) FROM scadenze_bandi_bandi WHERE responsabili_scadenze_json != '[]'::jsonb) as bandi_con_responsabili;
