-- =============================================================================
-- Fase 3, passaggio E: archivi dei file (Supabase Storage)
--
-- Bucket del gestionale: bandi-documenti, clienti-documenti, progetti-documenti,
-- clienti-amministrativi, contratti-firmati (file solo con badge del gestionale)
-- e firme-email (resta pubblico in lettura: le immagini delle firme sono
-- incorporate nelle email; si scrive solo dal server con la chiave riservata).
--
-- Le regole sui file sono condivise da tutte le app del progetto. Tre regole
-- generiche (lettura e caricamento per chiunque, pieno accesso per qualsiasi
-- utente autenticato) aprivano anche i bucket del gestionale: vengono
-- modificate in modo da escludere SOLO i bucket del gestionale, senza cambiare
-- nulla per i bucket delle altre app.
-- progetti-documenti smette di essere pubblico: il codice apre già i file con
-- link temporanei o download, mai con link pubblici.
-- Annullamento: 20261119_fase3_e_archivi_file_ROLLBACK.sql
-- =============================================================================

-- 1. Regole generiche: escludono i bucket del gestionale
alter policy "Allow all reads flreew_0" on storage.objects
  using (bucket_id <> all (array['bandi-documenti','clienti-documenti','progetti-documenti','clienti-amministrativi','contratti-firmati','firme-email']));

alter policy "Allow all uploads flreew_0" on storage.objects
  with check (bucket_id <> all (array['bandi-documenti','clienti-documenti','progetti-documenti','clienti-amministrativi','contratti-firmati','firme-email']));

alter policy authenticated_can_manage_storage_objects on storage.objects
  using (auth.role() = 'authenticated'
         and bucket_id <> all (array['bandi-documenti','clienti-documenti','progetti-documenti','clienti-amministrativi','contratti-firmati','firme-email']))
  with check (auth.role() = 'authenticated'
         and bucket_id <> all (array['bandi-documenti','clienti-documenti','progetti-documenti','clienti-amministrativi','contratti-firmati','firme-email']));

-- 2. Regole dei bucket del gestionale sostituite da un'unica regola con badge
drop policy if exists "Utenti autenticati possono aggiornare documenti bandi" on storage.objects;
drop policy if exists "Utenti autenticati possono caricare documenti bandi" on storage.objects;
drop policy if exists "Utenti autenticati possono eliminare documenti bandi" on storage.objects;
drop policy if exists "Utenti autenticati possono leggere documenti bandi" on storage.objects;
drop policy if exists "Utenti autenticati possono aggiornare documenti clienti" on storage.objects;
drop policy if exists "Utenti autenticati possono caricare documenti clienti" on storage.objects;
drop policy if exists "Utenti autenticati possono eliminare documenti clienti" on storage.objects;
drop policy if exists "Utenti autenticati possono leggere documenti clienti" on storage.objects;
drop policy if exists "Utenti autenticati possono aggiornare documenti progetti" on storage.objects;
drop policy if exists "Utenti autenticati possono caricare documenti progetti" on storage.objects;
drop policy if exists "Utenti autenticati possono eliminare documenti progetti" on storage.objects;
drop policy if exists "Utenti autenticati possono leggere documenti progetti" on storage.objects;
drop policy if exists "Authenticated users can read" on storage.objects;
drop policy if exists "Authenticated users can upload" on storage.objects;
drop policy if exists "Authenticated users can delete" on storage.objects;
drop policy if exists "Allow authenticated uploads" on storage.objects;

drop policy if exists gestionale_file on storage.objects;
create policy gestionale_file on storage.objects for all to authenticated
  using (bucket_id = any (array['bandi-documenti','clienti-documenti','progetti-documenti','clienti-amministrativi','contratti-firmati'])
         and (select public.gestionale_utente_id()) is not null)
  with check (bucket_id = any (array['bandi-documenti','clienti-documenti','progetti-documenti','clienti-amministrativi','contratti-firmati'])
         and (select public.gestionale_utente_id()) is not null);

-- 3. progetti-documenti non più pubblico
update storage.buckets set public = false where id = 'progetti-documenti';
