-- Analisi completa tabelle clienti per capire duplicazioni (FIXED)

-- 1. Lista TUTTE le tabelle che contengono "clienti" con prefisso corretto
SELECT 'TABELLE CLIENTI ESISTENTI:' as info;
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'scadenze_bandi_%client%'
ORDER BY table_name;

-- 2. Conta record e prime colonne di ogni tabella clienti
DO $$
DECLARE
    rec RECORD;
    record_count INTEGER;
    query_text TEXT;
    columns_list TEXT;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ANALISI TABELLE CLIENTI:';
    RAISE NOTICE '========================================';

    FOR rec IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE 'scadenze_bandi_%client%'
        ORDER BY table_name
    LOOP
        -- Conta record
        query_text := format('SELECT COUNT(*) FROM %I', rec.table_name);
        EXECUTE query_text INTO record_count;

        -- Ottieni prime colonne (fix per GROUP BY)
        SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
        INTO columns_list
        FROM (
            SELECT column_name, ordinal_position
            FROM information_schema.columns
            WHERE table_name = rec.table_name
            AND table_schema = 'public'
            ORDER BY ordinal_position
            LIMIT 3
        ) subq;

        RAISE NOTICE 'Tabella: %', rec.table_name;
        RAISE NOTICE '  Record: %', record_count;
        RAISE NOTICE '  Prime colonne: %', columns_list;
        RAISE NOTICE '----------------------------------------';
    END LOOP;
END $$;

-- 3. Verifica quale tabella usa la vista progetti
SELECT 'TABELLA COLLEGATA AI PROGETTI:' as info;
SELECT
    ccu.table_name AS tabella_clienti_usata,
    ccu.column_name AS colonna_riferimento
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'scadenze_bandi_progetti'
    AND kcu.column_name = 'cliente_id';

-- 4. Mostra struttura della tabella clienti principale
SELECT 'STRUTTURA TABELLA CLIENTI PRINCIPALE:' as info;
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'scadenze_bandi_clienti'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Verifica dati BLM per autocompilazione
SELECT 'DATI BLM PROJECT PER AUTOCOMPILAZIONE:' as info;
SELECT
    id,
    denominazione,
    email,
    partita_iva,
    codice_fiscale,
    telefono,
    indirizzo
FROM scadenze_bandi_clienti
WHERE denominazione ILIKE '%blm%' OR denominazione ILIKE '%project%'
LIMIT 1;