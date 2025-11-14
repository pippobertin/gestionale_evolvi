-- Verifica se i file compilati sono stati creati nel bucket

-- 1. Verifica documenti marcati come compilati
SELECT 'DOCUMENTI COMPILATI:' as info;
SELECT
    id,
    nome_file,
    auto_compilazione_completata,
    auto_compilazione_status,
    file_path,
    nome_file_compilato,
    updated_at
FROM scadenze_bandi_documenti_progetto
WHERE auto_compilazione_completata = TRUE
ORDER BY updated_at DESC;

-- 2. Verifica files fisici nel bucket progetti-documenti
SELECT 'FILES NEL BUCKET PROGETTI:' as info;
SELECT
    name as file_name,
    bucket_id,
    owner,
    created_at,
    updated_at,
    metadata
FROM storage.objects
WHERE bucket_id = 'progetti-documenti'
ORDER BY created_at DESC;

-- 3. Analisi stato compilazione
DO $$
DECLARE
    compiled_docs INTEGER;
    bucket_files INTEGER;
    latest_compiled RECORD;
BEGIN
    SELECT COUNT(*) INTO compiled_docs
    FROM scadenze_bandi_documenti_progetto
    WHERE auto_compilazione_completata = TRUE;

    SELECT COUNT(*) INTO bucket_files
    FROM storage.objects
    WHERE bucket_id = 'progetti-documenti';

    SELECT
        nome_file,
        auto_compilazione_status,
        file_path,
        nome_file_compilato
    INTO latest_compiled
    FROM scadenze_bandi_documenti_progetto
    WHERE auto_compilazione_completata = TRUE
    ORDER BY updated_at DESC
    LIMIT 1;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'ANALISI COMPILAZIONE E UPLOAD:';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📋 Documenti marcati come compilati: %', compiled_docs;
    RAISE NOTICE '📁 Files fisici nel bucket progetti: %', bucket_files;

    IF compiled_docs > 0 THEN
        RAISE NOTICE '🔍 Ultimo documento compilato:';
        RAISE NOTICE '   Nome file: %', latest_compiled.nome_file;
        RAISE NOTICE '   Status: %', latest_compiled.auto_compilazione_status;
        RAISE NOTICE '   File path: %', latest_compiled.file_path;
        RAISE NOTICE '   Nome compilato: %', latest_compiled.nome_file_compilato;

        IF bucket_files = 0 THEN
            RAISE NOTICE '❌ PROBLEMA: Compilazione OK ma upload FALLITO';
            RAISE NOTICE '🔧 Frontend non ha caricato il file compilato nel bucket';
        ELSE
            RAISE NOTICE '✅ Files presenti nel bucket - verifica path corretto';
        END IF;
    END IF;
    RAISE NOTICE '========================================';
END $$;