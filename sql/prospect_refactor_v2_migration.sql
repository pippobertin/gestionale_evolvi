-- Prospect Refactor V2: Congelamento, Archiviazione, Nuova Macchina a Stati
-- Eseguire su Supabase SQL Editor

BEGIN;

-- 1. Aggiungere colonne congelamento
ALTER TABLE scadenze_bandi_prospect
  ADD COLUMN IF NOT EXISTS congelato_il TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scongela_il DATE,
  ADD COLUMN IF NOT EXISTS stato_pre_congelamento TEXT,
  ADD COLUMN IF NOT EXISTS motivo_congelamento TEXT;

-- 2. Aggiungere colonne archiviazione
ALTER TABLE scadenze_bandi_prospect
  ADD COLUMN IF NOT EXISTS archiviato_il TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_archiviazione TEXT;

-- 3. Migrare dati: scartato -> archiviato (copiare motivo_rifiuto in motivo_archiviazione)
UPDATE scadenze_bandi_prospect
SET stato = 'archiviato',
    archiviato_il = COALESCE(data_decisione::timestamptz, NOW()),
    motivo_archiviazione = COALESCE(motivo_rifiuto, 'Migrato da stato scartato')
WHERE stato = 'scartato';

-- 4. Unificare note: copiare note_valutazione in note_qualitative dove vuoto
UPDATE scadenze_bandi_prospect
SET note_qualitative = note_valutazione
WHERE (note_qualitative IS NULL OR note_qualitative = '')
  AND note_valutazione IS NOT NULL
  AND note_valutazione != '';

-- 5. Rimuovere colonna note_valutazione
ALTER TABLE scadenze_bandi_prospect
  DROP COLUMN IF EXISTS note_valutazione;

-- 6. Aggiornare CHECK constraint su stato
ALTER TABLE scadenze_bandi_prospect
  DROP CONSTRAINT IF EXISTS scadenze_bandi_prospect_stato_check;

ALTER TABLE scadenze_bandi_prospect
  ADD CONSTRAINT scadenze_bandi_prospect_stato_check
  CHECK (stato IN ('bozza', 'qualificato', 'in_decisione', 'preso_in_carico', 'convertito', 'congelato', 'archiviato'));

-- 7. Fixare history: nuovo -> bozza, scartato/rifiutato -> archiviato
UPDATE scadenze_bandi_prospect_history
SET stato_nuovo = 'bozza'
WHERE stato_nuovo = 'nuovo';

UPDATE scadenze_bandi_prospect_history
SET stato_precedente = 'bozza'
WHERE stato_precedente = 'nuovo';

UPDATE scadenze_bandi_prospect_history
SET stato_nuovo = 'archiviato'
WHERE stato_nuovo IN ('scartato', 'rifiutato');

UPDATE scadenze_bandi_prospect_history
SET stato_precedente = 'archiviato'
WHERE stato_precedente IN ('scartato', 'rifiutato');

COMMIT;
