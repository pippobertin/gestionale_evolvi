-- Annulla 20261119_fase3_d_gruppo2_clienti_prospect_note.sql: ripristina lo stato
-- del 19/11/2026 (RLS, policy, permessi di anon, opzioni delle viste). Solo in emergenza.
do $$
declare t text; v text;
begin
  -- Tabelle che avevano RLS disattivata e nessuna policy
  foreach t in array array['scadenze_bandi_clienti','scadenze_bandi_collegamenti_aziendali','scadenze_bandi_contatti',
    'scadenze_bandi_legali_rappresentanti','scadenze_bandi_clienti_documenti','scadenze_bandi_documenti_cliente',
    'scadenze_bandi_documenti_amministrativi','scadenze_bandi_prospect','scadenze_bandi_prospect_history'] loop
    execute format('drop policy if exists gestionale_accesso on public.%I', t);
    execute format('alter table public.%I disable row level security', t);
    execute format('grant all on public.%I to anon, authenticated', t);
  end loop;

  -- Tabelle con RLS attiva e policy "Allow all operations for authenticated users" (public, true/true)
  foreach t in array array['scadenze_bandi_bandi_esterni','scadenze_bandi_clienti_bandi_esterni','scadenze_bandi_clienti_esigenze',
    'scadenze_bandi_clienti_note','scadenze_bandi_note_bandi','scadenze_bandi_note_progetti'] loop
    execute format('drop policy if exists gestionale_accesso on public.%I', t);
    execute format('grant all on public.%I to anon, authenticated', t);
    execute format('create policy "Allow all operations for authenticated users" on public.%I for all to public using (true) with check (true)', t);
  end loop;

  -- Viste: tornano come prima (le due vista_* erano già security_invoker)
  foreach v in array array['scadenze_bandi_bandi_view','scadenze_bandi_clienti_completa','scadenze_bandi_clienti_con_dimensione_aggregata',
    'scadenze_bandi_clienti_con_documenti','scadenze_bandi_clienti_con_referenti','scadenze_bandi_clienti_note_full',
    'scadenze_bandi_dashboard','scadenze_bandi_documenti_progetto_view','scadenze_bandi_progetti_view',
    'scadenze_bandi_template_view','scadenze_enhanced_simple','vista_match_bandi_clienti','vista_match_bandi_per_cliente'] loop
    execute format('alter view public.%I reset (security_invoker)', v);
    execute format('grant all on public.%I to anon, authenticated', v);
  end loop;
  execute 'grant all on public.vista_contributi_ottenuti to anon, authenticated';
  execute 'grant all on public.vista_rna_aiuti to anon, authenticated';
end $$;

drop policy if exists gestionale_accesso on public.scadenze_bandi_clienti_referenti;
grant all on public.scadenze_bandi_clienti_referenti to anon, authenticated;
create policy "Accesso completo referenti" on public.scadenze_bandi_clienti_referenti for all to public using (true);

drop policy if exists gestionale_accesso on public.scadenze_bandi_consulenti_clienti;
grant all on public.scadenze_bandi_consulenti_clienti to anon, authenticated;
create policy "Accesso completo consulenti_clienti" on public.scadenze_bandi_consulenti_clienti for all to public using (true);
