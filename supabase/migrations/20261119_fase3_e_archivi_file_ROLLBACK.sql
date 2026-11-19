-- Annulla 20261119_fase3_e_archivi_file.sql ripristinando le regole com'erano
-- il 19/11/2026 prima del passaggio E. Solo in emergenza.
alter policy "Allow all reads flreew_0" on storage.objects using (true);
alter policy "Allow all uploads flreew_0" on storage.objects with check (true);
alter policy authenticated_can_manage_storage_objects on storage.objects
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists gestionale_file on storage.objects;

create policy "Utenti autenticati possono aggiornare documenti bandi" on storage.objects for update to authenticated using (bucket_id = 'bandi-documenti') with check (bucket_id = 'bandi-documenti');
create policy "Utenti autenticati possono caricare documenti bandi" on storage.objects for insert to authenticated with check (bucket_id = 'bandi-documenti');
create policy "Utenti autenticati possono eliminare documenti bandi" on storage.objects for delete to authenticated using (bucket_id = 'bandi-documenti');
create policy "Utenti autenticati possono leggere documenti bandi" on storage.objects for select to authenticated using (bucket_id = 'bandi-documenti');
create policy "Utenti autenticati possono aggiornare documenti clienti" on storage.objects for update to public using ((bucket_id = 'clienti-documenti') and (auth.role() = 'authenticated'));
create policy "Utenti autenticati possono caricare documenti clienti" on storage.objects for insert to public with check ((bucket_id = 'clienti-documenti') and (auth.role() = 'authenticated'));
create policy "Utenti autenticati possono eliminare documenti clienti" on storage.objects for delete to public using ((bucket_id = 'clienti-documenti') and (auth.role() = 'authenticated'));
create policy "Utenti autenticati possono leggere documenti clienti" on storage.objects for select to public using ((bucket_id = 'clienti-documenti') and (auth.role() = 'authenticated'));
create policy "Utenti autenticati possono aggiornare documenti progetti" on storage.objects for update to authenticated using (bucket_id = 'progetti-documenti') with check (bucket_id = 'progetti-documenti');
create policy "Utenti autenticati possono caricare documenti progetti" on storage.objects for insert to authenticated with check (bucket_id = 'progetti-documenti');
create policy "Utenti autenticati possono eliminare documenti progetti" on storage.objects for delete to authenticated using (bucket_id = 'progetti-documenti');
create policy "Utenti autenticati possono leggere documenti progetti" on storage.objects for select to authenticated using (bucket_id = 'progetti-documenti');
create policy "Authenticated users can read" on storage.objects for select to authenticated using (bucket_id = any (array['clienti-amministrativi','contratti-firmati']));
create policy "Authenticated users can upload" on storage.objects for insert to authenticated with check (bucket_id = any (array['clienti-amministrativi','contratti-firmati']));
create policy "Authenticated users can delete" on storage.objects for delete to authenticated using (bucket_id = any (array['clienti-amministrativi','contratti-firmati']));
create policy "Allow authenticated uploads" on storage.objects for all to public using (bucket_id = 'firme-email') with check (bucket_id = 'firme-email');

update storage.buckets set public = true where id = 'progetti-documenti';
