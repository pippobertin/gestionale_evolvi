-- Prequalifica Prospect Migration
-- Adds 15 new columns to scadenze_bandi_prospect for the prequalifica workflow
-- and migrates existing states to the new state machine.
--
-- Run this ONCE in Supabase SQL Editor before using the new UI.

-- 1. Drop old CHECK constraint on stato and replace with new values
ALTER TABLE scadenze_bandi_prospect
  DROP CONSTRAINT IF EXISTS scadenze_bandi_prospect_stato_check;

ALTER TABLE scadenze_bandi_prospect
  ADD CONSTRAINT scadenze_bandi_prospect_stato_check
  CHECK (stato IN ('bozza', 'qualificato', 'in_decisione', 'preso_in_carico', 'scartato', 'convertito',
                   'nuovo', 'in_valutazione', 'valutato', 'approvato', 'rifiutato'));

-- 1b. Update CHECK constraint on fonte_acquisizione with new channels
ALTER TABLE scadenze_bandi_prospect
  DROP CONSTRAINT IF EXISTS scadenze_bandi_prospect_fonte_acquisizione_check;

ALTER TABLE scadenze_bandi_prospect
  ADD CONSTRAINT scadenze_bandi_prospect_fonte_acquisizione_check
  CHECK (fonte_acquisizione IN ('referral', 'web', 'evento', 'cold_call', 'altro', 'telefonata', 'email_inbound', 'linkedin'));

-- 2. Add new columns (17 total)
ALTER TABLE scadenze_bandi_prospect
  ADD COLUMN IF NOT EXISTS data_contatto date,
  ADD COLUMN IF NOT EXISTS ricevuto_da text,
  ADD COLUMN IF NOT EXISTS referente_nome text,
  ADD COLUMN IF NOT EXISTS tipologia_soggetto text,
  ADD COLUMN IF NOT EXISTS area_interesse text,
  ADD COLUMN IF NOT EXISTS natura_interesse text,
  ADD COLUMN IF NOT EXISTS bisogno_dichiarato text,
  ADD COLUMN IF NOT EXISTS bisogno_interpretato text,
  ADD COLUMN IF NOT EXISTS affidabilita_percepita text,
  ADD COLUMN IF NOT EXISTS potenziale_economico text,
  ADD COLUMN IF NOT EXISTS budget_dichiarato boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tempi_decisione text,
  ADD COLUMN IF NOT EXISTS note_qualitative text,
  ADD COLUMN IF NOT EXISTS raccomandazione text,
  ADD COLUMN IF NOT EXISTS motivazione_raccomandazione text,
  ADD COLUMN IF NOT EXISTS responsabile_qualificazione text,
  ADD COLUMN IF NOT EXISTS data_riunione_prevista date;

-- 3. Migrate existing states to new state machine
UPDATE scadenze_bandi_prospect SET stato = 'bozza' WHERE stato = 'nuovo';
UPDATE scadenze_bandi_prospect SET stato = 'qualificato' WHERE stato = 'in_valutazione';
UPDATE scadenze_bandi_prospect SET stato = 'in_decisione' WHERE stato = 'valutato';
UPDATE scadenze_bandi_prospect SET stato = 'preso_in_carico' WHERE stato = 'approvato';
UPDATE scadenze_bandi_prospect SET stato = 'scartato' WHERE stato = 'rifiutato';
-- 'convertito' remains unchanged

-- 4. Fix trigger function to bypass RLS when counting existing prospects
CREATE OR REPLACE FUNCTION generate_numero_prospect()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  next_num INTEGER;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_prospect FROM 11) AS INTEGER)), 0) + 1
  INTO next_num
  FROM scadenze_bandi_prospect
  WHERE numero_prospect LIKE 'PROS-' || current_year || '-%';
  NEW.numero_prospect := 'PROS-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Tighten CHECK constraint to only allow new states
ALTER TABLE scadenze_bandi_prospect
  DROP CONSTRAINT IF EXISTS scadenze_bandi_prospect_stato_check;

ALTER TABLE scadenze_bandi_prospect
  ADD CONSTRAINT scadenze_bandi_prospect_stato_check
  CHECK (stato IN ('bozza', 'qualificato', 'in_decisione', 'preso_in_carico', 'scartato', 'convertito'));
