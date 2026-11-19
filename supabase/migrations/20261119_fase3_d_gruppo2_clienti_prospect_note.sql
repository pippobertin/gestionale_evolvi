-- =============================================================================
-- Fase 3, passaggio D, gruppo 2: clienti, prospect, consulenti, note,
-- esigenze e bandi esterni + tutte le viste del gestionale
--
-- Tabelle: accesso (lettura e scrittura) solo agli utenti attivi del gestionale
-- riconosciuti dal badge; nessun accesso con la sola chiave pubblica né per gli
-- utenti di altre applicazioni del progetto. Il server usa la chiave riservata.
--
-- Viste: diventano "security_invoker" (applicano le regole di chi le interroga,
-- non del proprietario) e non sono più leggibili con la sola chiave pubblica.
-- Senza questo, la lista clienti resterebbe leggibile attraverso le viste.
-- La vista utenti (già chiusa e non usata dal codice) non viene toccata.
-- Annullamento: 20261119_fase3_d_gruppo2_clienti_prospect_note_ROLLBACK.sql
-- =============================================================================
do $$
declare
  t text;
  v text;
  p record;
begin
  foreach t in array array[
    'scadenze_bandi_clienti', 'scadenze_bandi_clienti_referenti', 'scadenze_bandi_collegamenti_aziendali',
    'scadenze_bandi_contatti', 'scadenze_bandi_legali_rappresentanti', 'scadenze_bandi_clienti_documenti',
    'scadenze_bandi_documenti_cliente', 'scadenze_bandi_documenti_amministrativi', 'scadenze_bandi_prospect',
    'scadenze_bandi_prospect_history', 'scadenze_bandi_consulenti_clienti', 'scadenze_bandi_clienti_note',
    'scadenze_bandi_note_bandi', 'scadenze_bandi_note_progetti', 'scadenze_bandi_clienti_esigenze',
    'scadenze_bandi_bandi_esterni', 'scadenze_bandi_clienti_bandi_esterni'
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

  foreach v in array array[
    'scadenze_bandi_bandi_view', 'scadenze_bandi_clienti_completa', 'scadenze_bandi_clienti_con_dimensione_aggregata',
    'scadenze_bandi_clienti_con_documenti', 'scadenze_bandi_clienti_con_referenti', 'scadenze_bandi_clienti_note_full',
    'scadenze_bandi_dashboard', 'scadenze_bandi_documenti_progetto_view', 'scadenze_bandi_progetti_view',
    'scadenze_bandi_template_view', 'scadenze_enhanced_simple', 'vista_match_bandi_clienti',
    'vista_match_bandi_per_cliente', 'vista_contributi_ottenuti', 'vista_rna_aiuti'
  ] loop
    execute format('alter view public.%I set (security_invoker = on)', v);
    execute format('revoke all on public.%I from anon', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;
