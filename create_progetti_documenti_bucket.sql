-- Script per creare bucket storage "progetti-documenti" e relative policy
-- NOTA: Eseguire nel SQL Editor di Supabase

-- 1. Crea bucket progetti-documenti (se non esiste)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'progetti-documenti',
    'progetti-documenti',
    false, -- privato
    10485760, -- 10MB in bytes
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
        'text/plain'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy per permettere upload agli utenti autenticati
CREATE POLICY "Utenti autenticati possono uploadare documenti progetto"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'progetti-documenti'
    AND auth.role() = 'authenticated'
);

-- 3. Policy per permettere lettura ai proprietari del progetto
CREATE POLICY "Utenti possono vedere i propri documenti progetto"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'progetti-documenti'
    AND auth.role() = 'authenticated'
);

-- 4. Policy per permettere aggiornamento ai proprietari
CREATE POLICY "Utenti possono aggiornare i propri documenti progetto"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'progetti-documenti'
    AND auth.role() = 'authenticated'
)
WITH CHECK (
    bucket_id = 'progetti-documenti'
    AND auth.role() = 'authenticated'
);

-- 5. Policy per permettere eliminazione ai proprietari
CREATE POLICY "Utenti possono eliminare i propri documenti progetto"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'progetti-documenti'
    AND auth.role() = 'authenticated'
);

-- Verifica creazione bucket
SELECT
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at
FROM storage.buckets
WHERE id = 'progetti-documenti';

DO $$
BEGIN
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'BUCKET PROGETTI-DOCUMENTI CREATO!';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '✅ Bucket: progetti-documenti (privato)';
    RAISE NOTICE '✅ File size limit: 10MB';
    RAISE NOTICE '✅ MIME types supportati: PDF, DOC, DOCX, XLS, XLSX, IMG';
    RAISE NOTICE '✅ Policy RLS configurate per utenti autenticati';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'PROSSIMO: Eseguire add_documenti_progetti_sistema.sql';
    RAISE NOTICE '=========================================';
END $$;