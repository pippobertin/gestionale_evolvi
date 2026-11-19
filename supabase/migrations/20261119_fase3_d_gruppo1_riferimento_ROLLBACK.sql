-- Annulla 20261119_fase3_d_gruppo1_riferimento.sql: ripristina lo stato del 19/11/2026
-- (RLS, policy e permessi di anon come prima). Usare solo in emergenza.

-- Tabelle che avevano RLS disattivata e nessuna policy
do $$ declare t text; begin
  foreach t in array array['scadenze_bandi_ateco_2025','scadenze_bandi_fondi_interprofessionali','scadenze_bandi_ccnl',
    'scadenze_bandi_sigle_sindacali','scadenze_bandi_ccnl_sigle','scadenze_bandi_tipologie_bando','scadenze_bandi_profiling_template'] loop
    execute format('drop policy if exists gestionale_accesso on public.%I', t);
    execute format('alter table public.%I disable row level security', t);
    execute format('grant all on public.%I to anon, authenticated', t);
  end loop;
end $$;

-- scadenze_bandi_eventi_catalogo (RLS attiva)
drop policy if exists gestionale_accesso on public.scadenze_bandi_eventi_catalogo;
grant all on public.scadenze_bandi_eventi_catalogo to anon, authenticated;
create policy "Tutti possono leggere eventi catalogo" on public.scadenze_bandi_eventi_catalogo for select to public using (true);
create policy "Utenti autenticati possono aggiornare eventi" on public.scadenze_bandi_eventi_catalogo for update to public using (auth.role() = 'authenticated'::text);
create policy "Utenti autenticati possono inserire eventi" on public.scadenze_bandi_eventi_catalogo for insert to public with check (auth.role() = 'authenticated'::text);

-- scadenze_bandi_tipologie_scadenze (RLS attiva)
drop policy if exists gestionale_accesso on public.scadenze_bandi_tipologie_scadenze;
grant all on public.scadenze_bandi_tipologie_scadenze to anon, authenticated;
create policy "Accesso anonimo lettura tipologie" on public.scadenze_bandi_tipologie_scadenze for select to anon using (true);
create policy "Utenti autenticati possono aggiornare tipologie scadenze" on public.scadenze_bandi_tipologie_scadenze for update to authenticated using (true) with check (true);
create policy "Utenti autenticati possono eliminare tipologie scadenze" on public.scadenze_bandi_tipologie_scadenze for delete to authenticated using (true);
create policy "Utenti autenticati possono inserire tipologie scadenze" on public.scadenze_bandi_tipologie_scadenze for insert to authenticated with check (true);
create policy "Utenti autenticati possono vedere tipologie scadenze" on public.scadenze_bandi_tipologie_scadenze for select to authenticated using (true);

-- scadenze_bandi_uffici_dipartimenti (RLS attiva)
drop policy if exists gestionale_accesso on public.scadenze_bandi_uffici_dipartimenti;
grant all on public.scadenze_bandi_uffici_dipartimenti to anon, authenticated;
create policy "Tutti possono leggere uffici" on public.scadenze_bandi_uffici_dipartimenti for select to public using (true);
create policy "Utenti autenticati possono gestire uffici" on public.scadenze_bandi_uffici_dipartimenti for all to public using (true);
