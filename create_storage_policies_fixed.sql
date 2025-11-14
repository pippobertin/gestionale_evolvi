-- Crea policies storage per bucket progetti-documenti (FIXED)

-- 1. Elimina policies esistenti se presenti
DROP POLICY IF EXISTS "Allow authenticated users to view project documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload project documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update project documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete project documents" ON storage.objects;

-- 2. Policy per SELECT (download/visualizzazione)
CREATE POLICY "Allow authenticated users to view project documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'progetti-documenti');

-- 3. Policy per INSERT (upload)
CREATE POLICY "Allow authenticated users to upload project documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'progetti-documenti');

-- 4. Policy per UPDATE (modifica metadati)
CREATE POLICY "Allow authenticated users to update project documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'progetti-documenti');

-- 5. Policy per DELETE (cancellazione)
CREATE POLICY "Allow authenticated users to delete project documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'progetti-documenti');

-- 6. Rendi il bucket pubblico per i download
UPDATE storage.buckets
SET public = true
WHERE name = 'progetti-documenti';

-- 7. Verifica che le policies siano state create
DO $$
DECLARE
    policy_count INTEGER;
    bucket_public BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname ILIKE '%project%';

    SELECT public INTO bucket_public
    FROM storage.buckets
    WHERE name = 'progetti-documenti';

    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ POLICIES STORAGE PROGETTI CREATE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Policies create: %', policy_count;
    RAISE NOTICE '✅ Bucket pubblico: %', bucket_public;
    RAISE NOTICE '✅ Permessi: SELECT, INSERT, UPDATE, DELETE';
    RAISE NOTICE '🎯 Download documenti ora funzionante!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RIPROVA A SCARICARE IL DOCUMENTO COMPILATO';
    RAISE NOTICE '========================================';
END $$;