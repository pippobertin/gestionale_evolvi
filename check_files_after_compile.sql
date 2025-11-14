-- Verifica files nel bucket dopo autocompilazione

-- 1. Verifica files nel bucket progetti-documenti
SELECT 'FILES NEL BUCKET:' as info;
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

-- 2. Verifica documenti progetti con auto_compilazione_completata
SELECT 'DOCUMENTI COMPILATI:' as info;
SELECT
    id,
    nome_file,
    auto_compilazione_completata,
    auto_compilazione_status,
    ereditato_da_bando,
    file_path,
    updated_at
FROM scadenze_bandi_documenti_progetto
WHERE auto_compilazione_completata = TRUE
ORDER BY updated_at DESC;

-- 3. Controlla se il campo file_path viene aggiornato
DO $$
DECLARE
    compiled_docs INTEGER;
    bucket_files INTEGER;
BEGIN
    SELECT COUNT(*) INTO compiled_docs
    FROM scadenze_bandi_documenti_progetto
    WHERE auto_compilazione_completata = TRUE;

    SELECT COUNT(*) INTO bucket_files
    FROM storage.objects
    WHERE bucket_id = 'progetti-documenti';

    RAISE NOTICE '========================================';
    RAISE NOTICE 'ANALISI POST-AUTOCOMPILAZIONE:';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📋 Documenti marcati come compilati: %', compiled_docs;
    RAISE NOTICE '📁 Files fisici nel bucket: %', bucket_files;

    IF compiled_docs > 0 AND bucket_files = 0 THEN
        RAISE NOTICE '❌ PROBLEMA: Documenti compilati ma NO files nel bucket';
        RAISE NOTICE '🔧 La funzione non sta salvando i file compilati';
        RAISE NOTICE '💡 SOLUZIONE: Aggiungere upload file alla funzione autocompilazione';
    ELSIF compiled_docs > 0 AND bucket_files > 0 THEN
        RAISE NOTICE '✅ Files presenti nel bucket';
        RAISE NOTICE '🔧 Verifica che i path siano corretti nel frontend';
    ELSE
        RAISE NOTICE '❌ Nessun documento compilato trovato';
    END IF;
    RAISE NOTICE '========================================';
END $$;