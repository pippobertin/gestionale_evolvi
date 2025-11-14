-- Verifica struttura tabella progetti per trovare campo contributo corretto

-- 1. Mostra tutti i campi della tabella progetti
SELECT 'STRUTTURA TABELLA PROGETTI:' as info;
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'scadenze_bandi_progetti'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Cerca campi che potrebbero contenere il contributo
SELECT 'CAMPI CONTRIBUTO:' as info;
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'scadenze_bandi_progetti'
AND table_schema = 'public'
AND (
    column_name ILIKE '%contributo%' OR
    column_name ILIKE '%importo%' OR
    column_name ILIKE '%ammesso%'
)
ORDER BY column_name;

-- 3. Esempio record progetti per vedere i campi disponibili
SELECT 'ESEMPIO PROGETTO:' as info;
SELECT *
FROM scadenze_bandi_progetti
LIMIT 1;