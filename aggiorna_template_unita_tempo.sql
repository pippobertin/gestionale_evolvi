-- Aggiunge supporto per unità tempo (giorni/mesi) nei template scadenze

-- 1. Aggiungi colonna unita_tempo alla tabella template_scadenze
ALTER TABLE scadenze_bandi_template_scadenze
ADD COLUMN IF NOT EXISTS unita_tempo TEXT DEFAULT 'giorni' CHECK (unita_tempo IN ('giorni', 'mesi'));

-- 2. Elimina e ricrea la vista per includere il nuovo campo
DROP VIEW IF EXISTS scadenze_bandi_template_view CASCADE;

CREATE VIEW scadenze_bandi_template_view AS
SELECT
    ts.*,
    b.nome as bando_nome,
    b.codice_bando,
    b.tipologia_bando,
    -- Informazioni dipendenza
    dep.nome as dipende_da_nome,
    dep.tipo_scadenza as dipende_da_tipo
FROM scadenze_bandi_template_scadenze ts
LEFT JOIN scadenze_bandi_bandi b ON ts.bando_id = b.id
LEFT JOIN scadenze_bandi_template_scadenze dep ON ts.dipende_da_template_id = dep.id
ORDER BY ts.ordine_sequenza, ts.giorni_da_evento;

-- 3. Aggiorna i template esistenti per usare unità mesi dove appropriato
UPDATE scadenze_bandi_template_scadenze
SET
    unita_tempo = 'mesi',
    giorni_da_evento = CASE
        WHEN giorni_da_evento = 60 THEN 2  -- 60 giorni -> 2 mesi
        WHEN giorni_da_evento = 90 THEN 3  -- 90 giorni -> 3 mesi
        WHEN giorni_da_evento = 180 THEN 6 -- 180 giorni -> 6 mesi
        WHEN giorni_da_evento = 365 THEN 12 -- 365 giorni -> 12 mesi
        ELSE ROUND(giorni_da_evento / 30.0) -- Altri casi: converti in mesi
    END
WHERE giorni_da_evento >= 60; -- Solo per durate lunghe

-- 4. Mantieni in giorni le scadenze brevi (< 60 giorni)
UPDATE scadenze_bandi_template_scadenze
SET unita_tempo = 'giorni'
WHERE giorni_da_evento < 60;

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'SUPPORTO UNITÀ TEMPO AGGIUNTO!';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Colonna unita_tempo aggiunta ai template';
    RAISE NOTICE 'Vista aggiornata per includere unita_tempo';
    RAISE NOTICE 'Template esistenti aggiornati:';
    RAISE NOTICE '- Scadenze lunghe convertite in mesi';
    RAISE NOTICE '- Scadenze brevi mantenute in giorni';
    RAISE NOTICE '====================================';
END $$;