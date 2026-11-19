-- Annulla 20261119_fase3_d_gruppo3_bandi_progetti_scadenze.sql: ripristina lo stato del
-- 19/11/2026 (RLS, policy, permessi di anon). Solo in emergenza.
do $$
declare t text;
begin
  -- Tabelle che avevano RLS disattivata (bandi e scadenze avevano policy, ma inattive)
  foreach t in array array['scadenze_bandi_bandi','scadenze_bandi_progetti','scadenze_bandi_scadenze','scadenze_bandi_template_scadenze',
    'scadenze_bandi_documenti','scadenze_bandi_documenti_bando','scadenze_bandi_documenti_progetto','scadenze_bandi_calendar_events',
    'scadenze_bandi_gruppi_utenti'] loop
    execute format('drop policy if exists gestionale_accesso on public.%I', t);
    execute format('alter table public.%I disable row level security', t);
    execute format('grant all on public.%I to anon, authenticated', t);
  end loop;
end $$;

create policy "Utenti autenticati possono vedere tutti i bandi" on public.scadenze_bandi_bandi for select to authenticated using (true);
create policy "Utenti autenticati possono inserire bandi" on public.scadenze_bandi_bandi for insert to authenticated with check (true);
create policy "Utenti autenticati possono aggiornare bandi" on public.scadenze_bandi_bandi for update to authenticated using (true) with check (true);
create policy "Utenti autenticati possono eliminare bandi" on public.scadenze_bandi_bandi for delete to authenticated using (true);
create policy "Utenti autenticati possono vedere tutte le scadenze" on public.scadenze_bandi_scadenze for select to authenticated using (true);
create policy "Utenti autenticati possono inserire scadenze" on public.scadenze_bandi_scadenze for insert to authenticated with check (true);
create policy "Utenti autenticati possono aggiornare scadenze" on public.scadenze_bandi_scadenze for update to authenticated using (true) with check (true);
create policy "Utenti autenticati possono eliminare scadenze" on public.scadenze_bandi_scadenze for delete to authenticated using (true);

-- scadenze_bandi_progetti_eventi (RLS attiva)
drop policy if exists gestionale_accesso on public.scadenze_bandi_progetti_eventi;
grant all on public.scadenze_bandi_progetti_eventi to anon, authenticated;
create policy "Utenti possono vedere eventi dei propri progetti" on public.scadenze_bandi_progetti_eventi for select to public using (auth.role() = 'authenticated'::text);
create policy "Utenti possono inserire eventi nei propri progetti" on public.scadenze_bandi_progetti_eventi for insert to public with check (auth.role() = 'authenticated'::text);
create policy "Utenti possono aggiornare eventi nei propri progetti" on public.scadenze_bandi_progetti_eventi for update to public using (auth.role() = 'authenticated'::text);
