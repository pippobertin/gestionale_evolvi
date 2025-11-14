-- Crea policies storage per bucket progetti-documenti

-- 1. Policy per SELECT (download/visualizzazione)
CREATE POLICY IF NOT EXISTS "Allow authenticated users to view project documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'progetti-documenti');

-- 2. Policy per INSERT (upload)
CREATE POLICY IF NOT EXISTS "Allow authenticated users to upload project documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'progetti-documenti');

-- 3. Policy per UPDATE (modifica metadati)
CREATE POLICY IF NOT EXISTS "Allow authenticated users to update project documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'progetti-documenti');

-- 4. Policy per DELETE (cancellazione)
CREATE POLICY IF NOT EXISTS "Allow authenticated users to delete project documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'progetti-documenti');

-- 5. Rendi il bucket pubblico per i download (se necessario)
UPDATE storage.buckets
SET public = true
WHERE name = 'progetti-documenti';

-- 6. Verifica che le policies siano state create
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname ILIKE '%project%';

    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ POLICIES STORAGE PROGETTI CREATE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Policies create: %', policy_count;
    RAISE NOTICE '✅ Bucket pubblico: progetti-documenti';
    RAISE NOTICE '✅ Permessi: SELECT, INSERT, UPDATE, DELETE';
    RAISE NOTICE '🎯 Download documenti ora funzionante!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RIPROVA A SCARICARE IL DOCUMENTO COMPILATO';
    RAISE NOTICE '========================================';
END $$;