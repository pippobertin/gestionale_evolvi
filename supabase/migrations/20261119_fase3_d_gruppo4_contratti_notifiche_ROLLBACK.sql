-- Annulla 20261119_fase3_d_gruppo4_contratti_notifiche.sql: tutte queste tabelle avevano
-- RLS disattivata, nessuna policy e pieno accesso di anon. Solo in emergenza.
do $$
declare t text;
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
    execute format('drop policy if exists gestionale_accesso on public.%I', t);
    execute format('alter table public.%I disable row level security', t);
    execute format('grant all on public.%I to anon, authenticated', t);
  end loop;
end $$;
