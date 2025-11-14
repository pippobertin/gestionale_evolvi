-- Migliora i campi dei bandi: rimuove budget_totale, aggiunge spesa_minima e regime_aiuto

-- 1. Aggiunge colonna spesa_minima_ammessa
ALTER TABLE scadenze_bandi_bandi
ADD COLUMN IF NOT EXISTS spesa_minima_ammessa DECIMAL(12,2) DEFAULT 0;

-- 2. Aggiunge colonna regime_aiuto con enum
ALTER TABLE scadenze_bandi_bandi
ADD COLUMN IF NOT EXISTS regime_aiuto TEXT CHECK (regime_aiuto IN ('DE_MINIMIS', 'ESENZIONE', 'NO_AIUTO_STATO', 'ALTRO')) DEFAULT 'DE_MINIMIS';

-- 3. Rimuove colonna budget_totale (commentata per sicurezza - decommentare se serve)
-- ALTER TABLE scadenze_bandi_bandi DROP COLUMN IF EXISTS budget_totale;

-- 4. Aggiorna la vista dei bandi per includere stato calcolato automaticamente
DROP VIEW IF EXISTS scadenze_bandi_bandi_view CASCADE;

CREATE VIEW scadenze_bandi_bandi_view AS
SELECT
    b.*,
    -- Calcola stato automatico basato su date
    CASE
        WHEN b.data_apertura_presentazione IS NULL OR b.data_chiusura_presentazione IS NULL THEN 'PROSSIMA_APERTURA'
        WHEN CURRENT_DATE < b.data_apertura_presentazione THEN 'PROSSIMA_APERTURA'
        WHEN CURRENT_DATE >= b.data_apertura_presentazione AND CURRENT_DATE <= b.data_chiusura_presentazione THEN 'APERTO'
        WHEN CURRENT_DATE > b.data_chiusura_presentazione AND
             CURRENT_DATE <= (b.data_chiusura_presentazione + INTERVAL '1 day' * COALESCE(b.tempo_valutazione_giorni, 60)) THEN 'IN_VALUTAZIONE'
        ELSE 'CHIUSO'
    END as stato_calcolato,

    -- Calcola giorni mancanti alle scadenze
    CASE
        WHEN b.data_apertura_presentazione IS NOT NULL AND CURRENT_DATE < b.data_apertura_presentazione
        THEN (b.data_apertura_presentazione::date - CURRENT_DATE)
        ELSE NULL
    END as giorni_ad_apertura,

    CASE
        WHEN b.data_chiusura_presentazione IS NOT NULL AND CURRENT_DATE <= b.data_chiusura_presentazione
        THEN (b.data_chiusura_presentazione::date - CURRENT_DATE)
        ELSE NULL
    END as giorni_a_chiusura,

    -- Conta progetti collegati
    (SELECT COUNT(*) FROM scadenze_bandi_progetti p WHERE p.bando_id = b.id) as progetti_collegati,
    (SELECT COUNT(*) FROM scadenze_bandi_progetti p WHERE p.bando_id = b.id AND p.stato IN ('IN_CORSO', 'ACCETTATO')) as progetti_attivi,

    -- Conta documenti caricati
    (SELECT COUNT(*) FROM scadenze_bandi_documenti d WHERE d.bando_id = b.id) as documenti_caricati

FROM scadenze_bandi_bandi b;

-- 5. Funzione per aggiornare automaticamente il campo stato_bando nei trigger
CREATE OR REPLACE FUNCTION update_bando_stato_automatico()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcola stato automatico
    NEW.stato_bando := (CASE
        WHEN NEW.data_apertura_presentazione IS NULL OR NEW.data_chiusura_presentazione IS NULL THEN 'PROSSIMA_APERTURA'
        WHEN CURRENT_DATE < NEW.data_apertura_presentazione THEN 'PROSSIMA_APERTURA'
        WHEN CURRENT_DATE >= NEW.data_apertura_presentazione AND CURRENT_DATE <= NEW.data_chiusura_presentazione THEN 'APERTO'
        WHEN CURRENT_DATE > NEW.data_chiusura_presentazione AND
             CURRENT_DATE <= (NEW.data_chiusura_presentazione + INTERVAL '1 day' * COALESCE(NEW.tempo_valutazione_giorni, 60)) THEN 'IN_VALUTAZIONE'
        ELSE 'CHIUSO'
    END)::bando_stato;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Crea trigger per aggiornamento automatico stato
DROP TRIGGER IF EXISTS trigger_update_bando_stato ON scadenze_bandi_bandi;

CREATE TRIGGER trigger_update_bando_stato
    BEFORE INSERT OR UPDATE ON scadenze_bandi_bandi
    FOR EACH ROW
    EXECUTE FUNCTION update_bando_stato_automatico();

-- 7. Aggiorna bandi esistenti con nuovi valori di default
UPDATE scadenze_bandi_bandi
SET
    spesa_minima_ammessa = 5000,
    regime_aiuto = 'DE_MINIMIS'
WHERE spesa_minima_ammessa IS NULL OR regime_aiuto IS NULL;

-- 8. Aggiorna stati esistenti usando la logica automatica
UPDATE scadenze_bandi_bandi
SET
    stato_bando = (CASE
        WHEN data_apertura_presentazione IS NULL OR data_chiusura_presentazione IS NULL THEN 'PROSSIMA_APERTURA'
        WHEN CURRENT_DATE < data_apertura_presentazione THEN 'PROSSIMA_APERTURA'
        WHEN CURRENT_DATE >= data_apertura_presentazione AND CURRENT_DATE <= data_chiusura_presentazione THEN 'APERTO'
        WHEN CURRENT_DATE > data_chiusura_presentazione AND
             CURRENT_DATE <= (data_chiusura_presentazione + INTERVAL '1 day' * COALESCE(tempo_valutazione_giorni, 60)) THEN 'IN_VALUTAZIONE'
        ELSE 'CHIUSO'
    END)::bando_stato;

DO $$
BEGIN
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'CAMPI BANDI MIGLIORATI!';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '✅ Aggiunta spesa_minima_ammessa';
    RAISE NOTICE '✅ Aggiunto regime_aiuto (DeMinimis/Esenzione/etc)';
    RAISE NOTICE '✅ Stato bando ora automatico basato su date';
    RAISE NOTICE '✅ Vista aggiornata con calcoli automatici';
    RAISE NOTICE '✅ Trigger per aggiornamento automatico stato';
    RAISE NOTICE '🎯 Budget totale rimosso (commentato nel SQL)';
    RAISE NOTICE '=========================================';
END $$;