-- Script per analizzare la struttura della tabella scadenze esistente
-- Eseguire in Supabase per vedere cosa c'è già

-- 1. Mostra tutte le colonne della tabella scadenze
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'scadenze_bandi_scadenze'
ORDER BY ordinal_position;

-- 2. Mostra tutti gli ENUM esistenti che potrebbero essere collegati
SELECT
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE '%scadenze%' OR t.typname LIKE '%priorita%' OR t.typname LIKE '%stato%'
ORDER BY t.typname, e.enumsortorder;

-- 3. Mostra le foreign key esistenti
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'scadenze_bandi_scadenze';

-- 4. Mostra alcune righe di esempio per capire i dati
SELECT * FROM scadenze_bandi_scadenze LIMIT 3;