-- Query per documentare la struttura completa delle tabelle scadenze_bandi_*
-- Eseguire questa query nel database PostgreSQL per ottenere la documentazione completa

-- 1. Lista di tutte le tabelle con prefisso scadenze_bandi_
SELECT
    schemaname,
    tablename,
    tableowner,
    tablespace,
    hasindexes,
    hasrules,
    hastriggers,
    rowsecurity
FROM pg_tables
WHERE tablename LIKE 'scadenze_bandi_%'
ORDER BY tablename;

-- 2. Struttura dettagliata di ogni tabella con tipi, constraints, default values
SELECT
    t.table_name,
    c.column_name,
    c.ordinal_position,
    c.column_default,
    c.is_nullable,
    c.data_type,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale,
    c.datetime_precision,
    tc.constraint_type,
    tc.constraint_name
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON c.table_name = t.table_name
LEFT JOIN information_schema.key_column_usage kcu ON kcu.table_name = t.table_name AND kcu.column_name = c.column_name
LEFT JOIN information_schema.table_constraints tc ON tc.constraint_name = kcu.constraint_name AND tc.table_name = t.table_name
WHERE t.table_name LIKE 'scadenze_bandi_%'
AND t.table_schema = 'public'
ORDER BY t.table_name, c.ordinal_position;

-- 3. Foreign Keys e relazioni tra tabelle
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name LIKE 'scadenze_bandi_%'
ORDER BY tc.table_name, kcu.column_name;

-- 4. Indici per ogni tabella
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename LIKE 'scadenze_bandi_%'
ORDER BY tablename, indexname;

-- 5. Enum types utilizzati nelle tabelle (se presenti)
SELECT
    t.typname as enum_name,
    e.enumlabel as enum_value,
    e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN (
    SELECT DISTINCT udt_name
    FROM information_schema.columns
    WHERE table_name LIKE 'scadenze_bandi_%'
    AND data_type = 'USER-DEFINED'
)
ORDER BY t.typname, e.enumsortorder;

-- 6. Views che utilizzano le tabelle scadenze_bandi_
SELECT
    viewname,
    definition
FROM pg_views
WHERE viewname LIKE 'scadenze_bandi_%'
OR definition LIKE '%scadenze_bandi_%'
ORDER BY viewname;

-- 7. Triggers sulle tabelle
SELECT
    schemaname,
    tablename,
    triggername,
    triggerdef
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname LIKE 'scadenze_bandi_%'
AND NOT tgisinternal
ORDER BY tablename, triggername;

-- 8. Statistiche sulle tabelle (numero di record)
SELECT
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE relname LIKE 'scadenze_bandi_%'
ORDER BY tablename;