-- Verifica ESATTA dei campi legale rappresentante nella tabella clienti

-- 1. Mostra TUTTI i campi che contengono "legale" o "rappresentante"
SELECT 'CAMPI LEGALE RAPPRESENTANTE:' as info;
SELECT
    column_name,
    data_type,
    is_nullable,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'scadenze_bandi_clienti'
AND table_schema = 'public'
AND (
    column_name ILIKE '%legale%' OR
    column_name ILIKE '%rappresentante%'
)
ORDER BY ordinal_position;

-- 2. Mostra TUTTI i campi della tabella per vedere la struttura completa
SELECT 'STRUTTURA COMPLETA TABELLA:' as info;
SELECT
    ordinal_position,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'scadenze_bandi_clienti'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Verifica se esistono funzioni che cercano campi sbagliati
SELECT 'FUNZIONI ESISTENTI:' as info;
SELECT
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_name ILIKE '%compila%'
AND routine_schema = 'public';