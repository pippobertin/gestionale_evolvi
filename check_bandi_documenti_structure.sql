-- Verifica struttura tabella documenti bandi per capire il campo corretto

-- 1. Mostra struttura tabella documenti bandi
SELECT 'STRUTTURA scadenze_bandi_documenti:' as info;
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'scadenze_bandi_documenti'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Esempio record documenti bandi
SELECT 'ESEMPIO DOCUMENTO BANDO:' as info;
SELECT *
FROM scadenze_bandi_documenti
WHERE categoria = 'allegato'
AND tipo_documento IN ('allegato', 'modulistica')
LIMIT 1;

-- 3. Trova campo che contiene il path del file
DO $$
DECLARE
    path_field TEXT;
    url_field TEXT;
BEGIN
    -- Cerca campi che potrebbero contenere il path
    SELECT column_name INTO path_field
    FROM information_schema.columns
    WHERE table_name = 'scadenze_bandi_documenti'
    AND table_schema = 'public'
    AND (
        column_name ILIKE '%path%' OR
        column_name ILIKE '%url%' OR
        column_name ILIKE '%file%'
    )
    ORDER BY
        CASE
            WHEN column_name ILIKE '%path%' THEN 1
            WHEN column_name ILIKE '%url%' THEN 2
            ELSE 3
        END
    LIMIT 1;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'CAMPO PER PATH FILE TROVATO:';
    RAISE NOTICE '========================================';

    IF path_field IS NOT NULL THEN
        RAISE NOTICE '✅ Campo path: %', path_field;
        RAISE NOTICE '🔧 Usa questo campo nella funzione autocompilazione';
    ELSE
        RAISE NOTICE '❌ Nessun campo path trovato';
        RAISE NOTICE '🔧 Controlla nomi campi nella tabella';
    END IF;
    RAISE NOTICE '========================================';
END $$;