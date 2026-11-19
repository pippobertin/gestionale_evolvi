-- =============================================================================
-- Fase 3, passaggio D, gruppo 3: bandi, progetti, scadenze, documenti, calendario
--
-- Bandi, progetti, scadenze, template delle scadenze, documenti di bandi e
-- progetti, eventi di calendario e di progetto, gruppi di utenti: accesso solo
-- agli utenti attivi del gestionale riconosciuti dal badge; nessun accesso con
-- la sola chiave pubblica né per gli utenti di altre applicazioni del progetto.
-- Annullamento: 20261119_fase3_d_gruppo3_bandi_progetti_scadenze_ROLLBACK.sql
-- =============================================================================
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'scadenze_bandi_bandi',
    'scadenze_bandi_progetti',
    'scadenze_bandi_scadenze',
    'scadenze_bandi_template_scadenze',
    'scadenze_bandi_documenti',
    'scadenze_bandi_documenti_bando',
    'scadenze_bandi_documenti_progetto',
    'scadenze_bandi_calendar_events',
    'scadenze_bandi_progetti_eventi',
    'scadenze_bandi_gruppi_utenti'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy gestionale_accesso on public.%I for all to authenticated '
      || 'using ((select public.gestionale_utente_id()) is not null) '
      || 'with check ((select public.gestionale_utente_id()) is not null)', t);
  end loop;
end $$;
