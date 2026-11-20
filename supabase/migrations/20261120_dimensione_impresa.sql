-- =============================================================================
-- Dimensione d'impresa e impresa unica (20/11/2026)
--
-- 1. Collegamenti aziendali: tipi allineati alla Raccomandazione 2003/361/CE.
--    Prima "COLLEGATA" indicava la partecipazione di minoranza (25-49,99%) e
--    "ASSOCIATA" il controllo (50% e oltre): il contrario della norma. Il calcolo
--    della dimensione era coerente con le percentuali, ma il de minimis prendeva
--    come impresa unica le partecipazioni di minoranza ed escludeva le
--    controllate. Ora: COLLEGATA = oltre il 50% o influenza dominante (somma al
--    100%, rientra nell'impresa unica); ASSOCIATA = dal 25 al 50% (somma in
--    proporzione).
-- 2. Colonna calcolata scadenze_bandi_clienti.dimensione: stessa regola
--    (ULA sotto soglia E fatturato OPPURE attivo entro il massimale), ma senza
--    dati sufficienti (ULA mancanti, oppure né fatturato né attivo) risulta NULL
--    invece di 'GRANDE'. Una colonna calcolata non si può modificare: si
--    ricrea, insieme all'indice e alle sei viste che la usano (stesse
--    definizioni, security_invoker e permessi). Nella vista
--    scadenze_bandi_clienti_con_dimensione_aggregata il campo
--    dimensione_aggregata diventa la stessa colonna (prima ripeteva il calcolo
--    con lo stesso difetto).
-- Annullamento: 20261120_dimensione_impresa_ROLLBACK.sql
-- =============================================================================
do $$
declare
  viste text[] := array['scadenze_bandi_clienti_completa','scadenze_bandi_clienti_con_dimensione_aggregata',
                        'scadenze_bandi_clienti_con_documenti','scadenze_bandi_clienti_con_referenti',
                        'vista_contributi_ottenuti','vista_rna_aiuti'];
  v text;
  definizioni jsonb := '{}'::jsonb;
  def text;
  nuova text;
begin
  -- 1. tipi dei collegamenti secondo la norma
  update public.scadenze_bandi_collegamenti_aziendali
  set tipo_collegamento = (case when coalesce(influenza_dominante, false) or coalesce(percentuale_partecipazione, 0) > 50
                                then 'COLLEGATA' else 'ASSOCIATA' end)::scadenze_bandi_tipo_collegamento;
  update public.scadenze_bandi_clienti
  set tipo_collegamento = (case when coalesce(influenza_dominante, false) or coalesce(percentuale_partecipazione, 0) > 50
                                then 'COLLEGATA' else 'ASSOCIATA' end)::scadenze_bandi_tipo_collegamento
  where tipo_collegamento in ('COLLEGATA', 'ASSOCIATA');

  -- 2. definizioni delle viste che usano la colonna
  foreach v in array viste loop
    definizioni := definizioni || jsonb_build_object(v, pg_get_viewdef(('public.' || v)::regclass, true));
    execute format('drop view public.%I', v);
  end loop;

  drop index if exists public.idx_clienti_dimensione;
  alter table public.scadenze_bandi_clienti drop column dimensione;
  alter table public.scadenze_bandi_clienti add column dimensione scadenze_bandi_dimensione_azienda
    generated always as (
      case
        when ula is null or (ultimo_fatturato is null and attivo_bilancio is null) then null
        when ula < 10 and (coalesce(ultimo_fatturato <= 2000000, false) or coalesce(attivo_bilancio <= 2000000, false))
          then 'MICRO'::scadenze_bandi_dimensione_azienda
        when ula < 50 and (coalesce(ultimo_fatturato <= 10000000, false) or coalesce(attivo_bilancio <= 10000000, false))
          then 'PICCOLA'::scadenze_bandi_dimensione_azienda
        when ula < 250 and (coalesce(ultimo_fatturato <= 50000000, false) or coalesce(attivo_bilancio <= 43000000, false))
          then 'MEDIA'::scadenze_bandi_dimensione_azienda
        else 'GRANDE'::scadenze_bandi_dimensione_azienda
      end
    ) stored;
  create index idx_clienti_dimensione on public.scadenze_bandi_clienti using btree (dimensione);

  foreach v in array viste loop
    def := definizioni ->> v;
    if v = 'scadenze_bandi_clienti_con_dimensione_aggregata' then
      nuova := regexp_replace(def, 'CASE\s+WHEN c\.ula < 10::numeric.*?END AS dimensione_aggregata',
                              'c.dimensione::text AS dimensione_aggregata', 's');
      if nuova = def then raise exception 'Vista % : calcolo di dimensione_aggregata non trovato', v; end if;
      def := nuova;
    end if;
    execute format('create view public.%I with (security_invoker = on) as %s', v, def);
    execute format('revoke all on public.%I from anon', v);
    execute format('grant all on public.%I to authenticated, service_role', v);
  end loop;
end $$;
