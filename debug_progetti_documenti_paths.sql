-- Debug: verifica path documenti vs files nel bucket

-- 1. Documenti nel database
SELECT 'DOCUMENTI NEL DATABASE:' as info;
SELECT
    id,
    nome_file,
    url_file as path_database,
    auto_compilazione_completata,
    file_path,
    nome_file_compilato,
    progetto_id
FROM scadenze_bandi_documenti_progetto
WHERE progetto_id = '0964a334-f473-419c-aefc-b1425309e36d'
ORDER BY created_at DESC;

-- 2. Files fisici nel bucket progetti-documenti
SELECT 'FILES NEL BUCKET PROGETTI-DOCUMENTI:' as info;
SELECT
    name as file_path_reale,
    bucket_id,
    created_at,
    updated_at,
    metadata
FROM storage.objects
WHERE bucket_id = 'progetti-documenti'
AND name LIKE '0964a334-f473-419c-aefc-b1425309e36d/%'
ORDER BY created_at DESC;

-- 3. Analisi mismatch
DO $$
DECLARE
    doc_path TEXT;
    file_exists BOOLEAN;
BEGIN
    RAISE NOTICE '======================================';
    RAISE NOTICE 'ANALISI PATH DOCUMENTI:';
    RAISE NOTICE '======================================';

    FOR doc_path IN
        SELECT url_file
        FROM scadenze_bandi_documenti_progetto
        WHERE progetto_id = '0964a334-f473-419c-aefc-b1425309e36d'
    LOOP
        SELECT EXISTS(
            SELECT 1 FROM storage.objects
            WHERE bucket_id = 'progetti-documenti'
            AND name = doc_path
        ) INTO file_exists;

        IF file_exists THEN
            RAISE NOTICE '✅ Path corretto: %', doc_path;
        ELSE
            RAISE NOTICE '❌ Path NON trovato: %', doc_path;
        END IF;
    END LOOP;

    RAISE NOTICE '======================================';
END $$;