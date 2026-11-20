-- Annulla 20261120_dimensione_impresa.sql: tipi dei collegamenti come prima
-- (COLLEGATA = minoranza, ASSOCIATA = controllo) e colonna dimensione con
-- 'GRANDE' anche in mancanza di dati. Solo insieme al codice precedente.
do $$
declare
  viste text[] := array['scadenze_bandi_clienti_completa','scadenze_bandi_clienti_con_dimensione_aggregata',
                        'scadenze_bandi_clienti_con_documenti','scadenze_bandi_clienti_con_referenti',
                        'vista_contributi_ottenuti','vista_rna_aiuti'];
  v text; definizioni jsonb := '{}'::jsonb; def text;
begin
  update public.scadenze_bandi_collegamenti_aziendali
  set tipo_collegamento = (case when coalesce(percentuale_partecipazione, 0) >= 50 then 'ASSOCIATA' else 'COLLEGATA' end)::scadenze_bandi_tipo_collegamento;

  foreach v in array viste loop
    definizioni := definizioni || jsonb_build_object(v, pg_get_viewdef(('public.' || v)::regclass, true));
    execute format('drop view public.%I', v);
  end loop;
  drop index if exists public.idx_clienti_dimensione;
  alter table public.scadenze_bandi_clienti drop column dimensione;
  alter table public.scadenze_bandi_clienti add column dimensione scadenze_bandi_dimensione_azienda
    generated always as (
      case
        when ula < 10 and (ultimo_fatturato <= 2000000 or attivo_bilancio <= 2000000) then 'MICRO'::scadenze_bandi_dimensione_azienda
        when ula < 50 and (ultimo_fatturato <= 10000000 or attivo_bilancio <= 10000000) then 'PICCOLA'::scadenze_bandi_dimensione_azienda
        when ula < 250 and (ultimo_fatturato <= 50000000 or attivo_bilancio <= 43000000) then 'MEDIA'::scadenze_bandi_dimensione_azienda
        else 'GRANDE'::scadenze_bandi_dimensione_azienda
      end
    ) stored;
  create index idx_clienti_dimensione on public.scadenze_bandi_clienti using btree (dimensione);
  foreach v in array viste loop
    execute format('create view public.%I with (security_invoker = on) as %s', v, definizioni ->> v);
    execute format('revoke all on public.%I from anon', v);
    execute format('grant all on public.%I to authenticated, service_role', v);
  end loop;
end $$;
