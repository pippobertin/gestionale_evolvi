-- Annulla 20261119_fase1_chiusura_colonne_sensibili.sql riportando i permessi
-- allo stato precedente (pieno accesso del ruolo pubblico). Usare solo in emergenza.
begin;
grant all on public.scadenze_bandi_utenti to anon, authenticated;
grant all on public.scadenze_bandi_system_settings to anon, authenticated;
create policy "Allow system settings access" on public.scadenze_bandi_system_settings
  for all to public using (true);
grant all on public.scadenze_bandi_sessioni to anon, authenticated;
grant all on public.scadenze_bandi_utenti_view to anon, authenticated;
-- La riattivazione dell'account di prova non è inclusa di proposito.
commit;
