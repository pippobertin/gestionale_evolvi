-- Setup Storage Buckets per documenti Bandi e Clienti
-- Eseguire in Supabase

-- 1. Crea bucket per documenti bandi
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bandi-documenti',
  'bandi-documenti',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain', 'application/zip']
) ON CONFLICT (id) DO NOTHING;

-- 2. Crea bucket per documenti clienti
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clienti-documenti',
  'clienti-documenti',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain', 'image/jpeg', 'image/png', 'application/zip']
) ON CONFLICT (id) DO NOTHING;

-- 3. Policies per bandi-documenti
CREATE POLICY "Utenti autenticati possono caricare documenti bandi" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'bandi-documenti' AND auth.role() = 'authenticated');

CREATE POLICY "Utenti autenticati possono leggere documenti bandi" ON storage.objects
FOR SELECT USING (bucket_id = 'bandi-documenti' AND auth.role() = 'authenticated');

CREATE POLICY "Utenti autenticati possono aggiornare documenti bandi" ON storage.objects
FOR UPDATE USING (bucket_id = 'bandi-documenti' AND auth.role() = 'authenticated');

CREATE POLICY "Utenti autenticati possono eliminare documenti bandi" ON storage.objects
FOR DELETE USING (bucket_id = 'bandi-documenti' AND auth.role() = 'authenticated');

-- 4. Policies per clienti-documenti
CREATE POLICY "Utenti autenticati possono caricare documenti clienti" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'clienti-documenti' AND auth.role() = 'authenticated');

CREATE POLICY "Utenti autenticati possono leggere documenti clienti" ON storage.objects
FOR SELECT USING (bucket_id = 'clienti-documenti' AND auth.role() = 'authenticated');

CREATE POLICY "Utenti autenticati possono aggiornare documenti clienti" ON storage.objects
FOR UPDATE USING (bucket_id = 'clienti-documenti' AND auth.role() = 'authenticated');

CREATE POLICY "Utenti autenticati possono eliminare documenti clienti" ON storage.objects
FOR DELETE USING (bucket_id = 'clienti-documenti' AND auth.role() = 'authenticated');