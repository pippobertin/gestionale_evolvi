-- =============================================================================
-- Fase 3, passaggio D, gruppo 4: contratti, fatture, scadenze contrattuali, notifiche
--
-- Contratti Evolvi, fatture, tracciamento contratti, scadenze contrattuali e
-- registro, impostazioni e registro notifiche, coda email, destinatari
-- aggiuntivi: accesso solo agli utenti attivi del gestionale con badge.
-- Annullamento: 20261119_fase3_d_gruppo4_contratti_notifiche_ROLLBACK.sql
-- =============================================================================
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'scadenze_bandi_contratti_evolvi',
    'scadenze_bandi_evolvi_fatture',
    'scadenze_bandi_contract_tracking',
    'scadenze_bandi_scadenze_contrattuali',
    'scadenze_bandi_scadenze_contrattuali_log',
    'scadenze_bandi_notification_settings',
    'scadenze_bandi_notification_log',
    'scadenze_bandi_email_queue',
    'scadenze_bandi_additional_recipients'
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
