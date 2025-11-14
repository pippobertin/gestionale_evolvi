-- Verifica stato storage buckets per documenti progetti

-- 1. Verifica buckets esistenti
SELECT 'BUCKETS STORAGE:' as info;
SELECT
    name,
    id,
    public,
    created_at
FROM storage.buckets
ORDER BY created_at;

-- 2. Verifica files nel bucket progetti-documenti
SELECT 'FILES BUCKET PROGETTI:' as info;
SELECT
    name,
    bucket_id,
    metadata,
    created_at
FROM storage.objects
WHERE bucket_id = 'progetti-documenti'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Verifica policies bucket progetti-documenti
SELECT 'POLICIES BUCKET PROGETTI:' as info;
SELECT
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname ILIKE '%progetti%';

-- 4. Controlla se il bucket progetti-documenti esiste
DO $$
DECLARE
    bucket_exists BOOLEAN;
    file_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT FROM storage.buckets
        WHERE name = 'progetti-documenti'
    ) INTO bucket_exists;

    IF bucket_exists THEN
        SELECT COUNT(*) INTO file_count
        FROM storage.objects
        WHERE bucket_id = 'progetti-documenti';

        RAISE NOTICE '✅ Bucket progetti-documenti ESISTE';
        RAISE NOTICE '📁 Files nel bucket: %', file_count;
        RAISE NOTICE '🔧 Verifica se mancano policies di accesso';
    ELSE
        RAISE NOTICE '❌ Bucket progetti-documenti NON ESISTE';
        RAISE NOTICE '🔧 DEVI CREARE IL BUCKET per il download';
    END IF;
END $$;