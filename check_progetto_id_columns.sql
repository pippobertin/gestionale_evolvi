-- Verifica quali tabelle hanno colonna progetto_id

-- 1. Trova tutte le tabelle con colonna progetto_id
SELECT 'TABELLE CON PROGETTO_ID:' as info;
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE column_name = 'progetto_id'
AND table_schema = 'public'
ORDER BY table_name;

-- 2. Verifica struttura specifica tabelle nel JOIN
SELECT 'SCADENZE_BANDI_DOCUMENTI_PROGETTO:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'scadenze_bandi_documenti_progetto'
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'SCADENZE_BANDI_DOCUMENTI:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'scadenze_bandi_documenti'
AND table_schema = 'public'
AND column_name ILIKE '%progetto%'
ORDER BY ordinal_position;