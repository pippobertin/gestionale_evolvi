-- =============================================================================
-- Fase 3, passaggio D, gruppo 1: tabelle di riferimento
--
-- Regola: accesso (lettura e scrittura) solo agli utenti attivi del gestionale,
-- riconosciuti dal badge (funzione gestionale_utente_id). La chiave pubblica da
-- sola non legge più queste tabelle. Il server usa la chiave riservata e non
-- è soggetto alle regole. Un solo livello di accesso, come oggi.
-- Annullamento: 20261119_fase3_d_gruppo1_riferimento_ROLLBACK.sql
-- =============================================================================
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'scadenze_bandi_ateco_2025', 'scadenze_bandi_fondi_interprofessionali', 'scadenze_bandi_ccnl',
    'scadenze_bandi_sigle_sindacali', 'scadenze_bandi_ccnl_sigle', 'scadenze_bandi_uffici_dipartimenti',
    'scadenze_bandi_tipologie_scadenze', 'scadenze_bandi_eventi_catalogo', 'scadenze_bandi_tipologie_bando',
    'scadenze_bandi_profiling_template'
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
