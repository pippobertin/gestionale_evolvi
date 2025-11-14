-- Fix policy bucket progetti-documenti per permettere download

-- 1. Verifica policy attuali
SELECT 'POLICY ATTUALI PROGETTI-DOCUMENTI:' as info;
SELECT
    policyname,
    cmd,
    permissive,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'objects'
AND (
    policyname LIKE '%project%' OR
    qual LIKE '%progetti-documenti%' OR
    with_check LIKE '%progetti-documenti%'
)
ORDER BY policyname;

-- 2. Rimuovi policy esistenti che potrebbero dare conflitto
DROP POLICY IF EXISTS "Allow authenticated users to read project documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload project documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update project documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete project documents" ON storage.objects;

-- 3. Crea policy più permissive per progetti-documenti
CREATE POLICY "progetti_read_policy"
ON storage.objects FOR SELECT
USING (bucket_id = 'progetti-documenti');

CREATE POLICY "progetti_insert_policy"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'progetti-documenti');

CREATE POLICY "progetti_update_policy"
ON storage.objects FOR UPDATE
USING (bucket_id = 'progetti-documenti')
WITH CHECK (bucket_id = 'progetti-documenti');

CREATE POLICY "progetti_delete_policy"
ON storage.objects FOR DELETE
USING (bucket_id = 'progetti-documenti');

-- 4. Verifica RLS è abilitato
SELECT 'RLS STATUS:' as info;
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'objects'
AND schemaname = 'storage';

-- 5. Verifica policy finali
SELECT 'POLICY FINALI PROGETTI-DOCUMENTI:' as info;
SELECT
    policyname,
    cmd,
    permissive
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE 'progetti_%'
ORDER BY policyname;

-- Script completato
DO $$
BEGIN
    RAISE NOTICE '✅ Policy progetti-documenti sistemate!';
    RAISE NOTICE '🔍 Ora prova il download nel frontend';
END $$;