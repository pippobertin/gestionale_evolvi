-- Analisi completa tabelle clienti per capire duplicazioni

-- 1. Lista TUTTE le tabelle che contengono "clienti"
SELECT 'TABELLE CLIENTI ESISTENTI:' as info;
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%client%'
ORDER BY table_name;

-- 2. Conta record in ogni tabella clienti
DO $$
DECLARE
    rec RECORD;
    record_count INTEGER;
    query_text TEXT;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ANALISI TABELLE CLIENTI:';
    RAISE NOTICE '========================================';

    FOR rec IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE '%client%'
        ORDER BY table_name
    LOOP
        -- Conta record in ogni tabella
        query_text := format('SELECT COUNT(*) FROM %I', rec.table_name);
        EXECUTE query_text INTO record_count;

        RAISE NOTICE 'Tabella: % - Record: %', rec.table_name, record_count;

        -- Mostra prime 2 colonne per capire la struttura
        query_text := format('SELECT column_name FROM information_schema.columns WHERE table_name = %L AND table_schema = %L ORDER BY ordinal_position LIMIT 3', rec.table_name, 'public');
        RAISE NOTICE 'Prime colonne: %', (
            SELECT string_agg(column_name, ', ')
            FROM information_schema.columns
            WHERE table_name = rec.table_name
            AND table_schema = 'public'
            ORDER BY ordinal_position
            LIMIT 3
        );
        RAISE NOTICE '----------------------------------------';
    END LOOP;
END $$;

-- 3. Verifica quale tabella usa il frontend progetti
SELECT 'TABELLA USATA DAI PROGETTI:' as info;
SELECT DISTINCT
    tc.table_name as tabella_clienti,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'scadenze_bandi_progetti'
    AND kcu.column_name = 'cliente_id';

-- 4. Raccomandazione
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RACCOMANDAZIONE:';
    RAISE NOTICE '========================================';
    RAISE NOTICE '1. Identifica la tabella clienti PRINCIPALE';
    RAISE NOTICE '2. Elimina tabelle duplicate/inutilizzate';
    RAISE NOTICE '3. Consolida dati se necessario';
    RAISE NOTICE '4. Aggiorna riferimenti foreign key';
    RAISE NOTICE '========================================';
END $$;