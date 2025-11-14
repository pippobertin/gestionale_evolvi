-- Fix SEMPLICE - solo quello che serve
-- Basta complicazioni!

-- 1. Aggiungi le colonne base se mancano
ALTER TABLE scadenze_bandi_scadenze
ADD COLUMN IF NOT EXISTS cliente_id UUID,
ADD COLUMN IF NOT EXISTS titolo TEXT;

-- 2. Popola i campi dalle relazioni esistenti
UPDATE scadenze_bandi_scadenze s
SET cliente_id = p.cliente_id
FROM scadenze_bandi_progetti p
WHERE s.progetto_id = p.id
AND s.cliente_id IS NULL;

UPDATE scadenze_bandi_scadenze
SET titolo = COALESCE(note, 'Scadenza')
WHERE titolo IS NULL;

-- 3. Funzione giorni semplice
CREATE OR REPLACE FUNCTION giorni_rimanenti(data_scadenza_input TIMESTAMP WITH TIME ZONE)
RETURNS INTEGER AS $$
BEGIN
    RETURN (data_scadenza_input::date - CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- 4. Vista semplice che funziona
CREATE OR REPLACE VIEW scadenze_enhanced_simple AS
SELECT
    s.*,
    giorni_rimanenti(s.data_scadenza) as giorni_rimanenti,
    CASE
        WHEN giorni_rimanenti(s.data_scadenza) <= 2 THEN 'URGENTE'
        WHEN giorni_rimanenti(s.data_scadenza) <= 7 THEN 'IMMINENTE'
        ELSE 'NORMALE'
    END as urgenza,
    c.denominazione as cliente_nome,
    c.email as cliente_email,
    ts.nome as tipo_scadenza_nome
FROM scadenze_bandi_scadenze s
LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
LEFT JOIN scadenze_bandi_clienti c ON COALESCE(s.cliente_id, p.cliente_id) = c.id
LEFT JOIN scadenze_bandi_tipologie_scadenze ts ON s.tipologia_scadenza_id = ts.id;

-- 5. Query semplice per alert (senza funzione complessa)
CREATE OR REPLACE VIEW scadenze_alert_view AS
SELECT
    s.id,
    COALESCE(s.titolo, s.note, 'Scadenza') as titolo,
    s.data_scadenza,
    giorni_rimanenti(s.data_scadenza) as giorni_rimanenti,
    c.denominazione as cliente_nome,
    s.responsabile_email,
    ts.nome as tipo_scadenza
FROM scadenze_bandi_scadenze s
LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
LEFT JOIN scadenze_bandi_clienti c ON COALESCE(s.cliente_id, p.cliente_id) = c.id
LEFT JOIN scadenze_bandi_tipologie_scadenze ts ON s.tipologia_scadenza_id = ts.id
WHERE s.stato IN ('non_iniziata', 'in_corso')
AND giorni_rimanenti(s.data_scadenza) >= 0
AND giorni_rimanenti(s.data_scadenza) <= 30;

-- 6. Test che funzioni
SELECT 'Scadenze totali:' as info, COUNT(*) as valore FROM scadenze_enhanced_simple
UNION ALL
SELECT 'Scadenze urgenti:', COUNT(*) FROM scadenze_enhanced_simple WHERE urgenza = 'URGENTE'
UNION ALL
SELECT 'Scadenze per alert:', COUNT(*) FROM scadenze_alert_view;