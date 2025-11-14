-- Verifica e crea bucket progetti-documenti se necessario

-- 1. Verifica buckets esistenti
SELECT 'BUCKETS ESISTENTI:' as info;
SELECT
    name,
    id,
    public,
    created_at
FROM storage.buckets
ORDER BY created_at DESC;

-- 2. Verifica se progetti-documenti esiste
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets
        WHERE name = 'progetti-documenti'
    ) THEN
        -- Crea il bucket
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('progetti-documenti', 'progetti-documenti', false);

        RAISE NOTICE '✅ Bucket progetti-documenti creato!';
    ELSE
        RAISE NOTICE 'ℹ️ Bucket progetti-documenti già esistente';
    END IF;
END $$;

-- 3. Crea policy per permettere lettura/scrittura ai documenti del progetto
DO $$
BEGIN
    -- Policy per lettura
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
        AND policyname = 'Allow authenticated users to read project documents'
    ) THEN
        EXECUTE 'CREATE POLICY "Allow authenticated users to read project documents"
                 ON storage.objects FOR SELECT
                 USING (bucket_id = ''progetti-documenti'')';
        RAISE NOTICE '✅ Policy lettura progetti-documenti creata!';
    END IF;

    -- Policy per upload
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
        AND policyname = 'Allow authenticated users to upload project documents'
    ) THEN
        EXECUTE 'CREATE POLICY "Allow authenticated users to upload project documents"
                 ON storage.objects FOR INSERT
                 WITH CHECK (bucket_id = ''progetti-documenti'')';
        RAISE NOTICE '✅ Policy upload progetti-documenti creata!';
    END IF;

    -- Policy per update
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
        AND policyname = 'Allow authenticated users to update project documents'
    ) THEN
        EXECUTE 'CREATE POLICY "Allow authenticated users to update project documents"
                 ON storage.objects FOR UPDATE
                 USING (bucket_id = ''progetti-documenti'')';
        RAISE NOTICE '✅ Policy update progetti-documenti creata!';
    END IF;

    -- Policy per delete
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
        AND policyname = 'Allow authenticated users to delete project documents'
    ) THEN
        EXECUTE 'CREATE POLICY "Allow authenticated users to delete project documents"
                 ON storage.objects FOR DELETE
                 USING (bucket_id = ''progetti-documenti'')';
        RAISE NOTICE '✅ Policy delete progetti-documenti creata!';
    END IF;
END $$;

-- 4. Verifica final
SELECT 'CONFIGURAZIONE FINALE:' as info;
SELECT
    name,
    public,
    created_at
FROM storage.buckets
WHERE name = 'progetti-documenti';

SELECT 'POLICIES PROGETTI-DOCUMENTI:' as info;
SELECT
    policyname,
    cmd,
    permissive
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%project documents%';