-- Istruzioni per creare il bucket Supabase Storage per documenti clienti
-- DA ESEGUIRE NELLA SEZIONE STORAGE DI SUPABASE (non SQL Editor)

-- 1. Vai su Supabase Dashboard → Storage
-- 2. Clicca "New bucket"
-- 3. Nome bucket: "clienti-documenti"
-- 4. Rendi pubblico: NO (privato per sicurezza)
-- 5. Clicca "Create bucket"

-- CONFIGURAZIONE POLICY TRAMITE DASHBOARD SUPABASE:

-- METODO 1: Tramite Dashboard (RACCOMANDATO)
-- 1. Vai su Supabase Dashboard → Storage → clienti-documenti
-- 2. Clicca sulla tab "Policies"
-- 3. Clicca "New Policy"
-- 4. Seleziona "Custom" e configura le seguenti policy:

-- Policy SELECT (per visualizzare/scaricare):
-- Nome: Allow authenticated SELECT
-- Target roles: authenticated
-- Using expression: true
-- Operation: SELECT

-- Policy INSERT (per upload):
-- Nome: Allow authenticated INSERT
-- Target roles: authenticated
-- With check: true
-- Operation: INSERT

-- Policy UPDATE (per aggiornamenti):
-- Nome: Allow authenticated UPDATE
-- Target roles: authenticated
-- Using expression: true
-- With check: true
-- Operation: UPDATE

-- Policy DELETE (per eliminazione):
-- Nome: Allow authenticated DELETE
-- Target roles: authenticated
-- Using expression: true
-- Operation: DELETE

-- METODO 2: Se preferisci SQL (esegui UNA SOLA VOLTA nel SQL Editor):
-- ATTENZIONE: Sostituisci 'YOUR_PROJECT_REF' con il reference del tuo progetto

-- SELECT storage.foldername('clienti-documenti');

-- CREATE POLICY "Allow authenticated users full access to clienti documents" ON storage.objects
-- AS PERMISSIVE FOR ALL TO authenticated
-- USING (bucket_id = 'clienti-documenti')
-- WITH CHECK (bucket_id = 'clienti-documenti');