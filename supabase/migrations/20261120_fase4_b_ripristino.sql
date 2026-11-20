-- =============================================================================
-- Fase 4, passaggio B: ripristino di ciò che è stato eliminato
--
-- 1. Il registro annota la transazione di ogni operazione: le righe eliminate
--    insieme (un cliente con referenti, note, documenti) si ripristinano insieme.
-- 2. Le righe reinserite da un ripristino compaiono nel registro come
--    "ripristino", con il riferimento all'eliminazione d'origine.
-- 3. gestionale_ripristina(id): reinserisce le righe eliminate nella stessa
--    operazione, nell'ordine imposto dai collegamenti; ciò che non si può
--    reinserire (elemento collegato mancante, dato già presente) è riportato.
--    Ricollega anche le righe che l'eliminazione aveva solo staccato (collegamenti
--    "set null", per esempio le note di un cliente), se nel frattempo nessuno le
--    ha collegate ad altro. Solo il server (chiave di servizio) può chiamarla.
-- Utenti e registro dei backup non si ripristinano da qui.
-- Annullamento: 20261120_fase4_b_ripristino_ROLLBACK.sql
-- =============================================================================

alter table public.scadenze_bandi_registro_operazioni
  add column if not exists transazione bigint;
alter table public.scadenze_bandi_registro_operazioni
  alter column transazione set default txid_current();
create index if not exists idx_registro_transazione
  on public.scadenze_bandi_registro_operazioni (transazione) where evento = 'eliminazione';
create index if not exists idx_registro_ripristino_di
  on public.scadenze_bandi_registro_operazioni ((dettagli ->> 'ripristino_di')) where evento = 'ripristino';

-- Il trigger riconosce i reinserimenti fatti dal ripristino
create or replace function public.gestionale_registra_operazione()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  segrete constant text[] := array['password_hash', 'gmail_refresh_token', 'gmail_access_token',
                                   'token', 'token_hash', 'encrypted_password',
                                   'oauth_refresh_token', 'oauth_access_token'];
  tecniche constant text[] := array['updated_at', 'ultimo_accesso', 'gmail_access_token'];
  v_old jsonb; v_new jsonb; v_riga jsonb;
  v_prima jsonb := null; v_dopo jsonb := null; v_campi text[] := null; v_dettagli jsonb := null;
  v_evento text; v_autore uuid := public.gestionale_autore(); v_nome text; v_cliente uuid; k text;
  v_ripristino text := nullif(current_setting('gestionale.ripristino_di', true), '');
begin
  if tg_op = 'INSERT' then
    v_evento := 'inserimento'; v_new := to_jsonb(new) - segrete; v_riga := v_new; v_dopo := v_new;
    if v_ripristino is not null then
      v_evento := 'ripristino';
    end if;
  elsif tg_op = 'DELETE' then
    v_evento := 'eliminazione'; v_old := to_jsonb(old) - segrete; v_riga := v_old; v_prima := v_old;
  else
    v_evento := 'modifica'; v_old := to_jsonb(old); v_new := to_jsonb(new); v_riga := v_new - segrete;
    v_prima := '{}'::jsonb; v_dopo := '{}'::jsonb; v_campi := '{}';
    for k in select jsonb_object_keys(v_new) loop
      if (v_new -> k) is distinct from (v_old -> k) and not (k = any (tecniche)) then
        v_campi := v_campi || k;
        if k = any (segrete) then
          v_prima := v_prima || jsonb_build_object(k, '***');
          v_dopo := v_dopo || jsonb_build_object(k, '*** (modificato)');
        else
          v_prima := v_prima || jsonb_build_object(k, v_old -> k);
          v_dopo := v_dopo || jsonb_build_object(k, v_new -> k);
        end if;
      end if;
    end loop;
    if cardinality(v_campi) = 0 then return new; end if;
  end if;
  if v_ripristino is not null then
    v_dettagli := jsonb_build_object('ripristino_di', v_ripristino);
  end if;
  if v_autore is not null then
    select nullif(trim(coalesce(u.nome, '') || ' ' || coalesce(u.cognome, '')), '')
      into v_nome from scadenze_bandi_utenti u where u.id = v_autore;
  end if;
  if tg_table_name = 'scadenze_bandi_clienti' then
    v_cliente := (v_riga ->> 'id')::uuid;
  elsif (v_riga ->> 'cliente_id') ~ '^[0-9a-fA-F-]{36}$' then
    v_cliente := (v_riga ->> 'cliente_id')::uuid;
  end if;
  insert into scadenze_bandi_registro_operazioni
    (utente_id, utente_nome, canale, evento, tabella, record_id, cliente_id, descrizione, campi, prima, dopo, dettagli)
  values (
    v_autore, v_nome, public.gestionale_canale(), v_evento, tg_table_name, v_riga ->> 'id', v_cliente,
    left(coalesce(case when tg_table_name = 'scadenze_bandi_utenti'
                       then trim(coalesce(v_riga ->> 'nome', '') || ' ' || coalesce(v_riga ->> 'cognome', '')) end,
                  v_riga ->> 'denominazione', v_riga ->> 'nome_bando', v_riga ->> 'titolo_progetto',
                  v_riga ->> 'titolo', v_riga ->> 'nome_file', v_riga ->> 'nome_originale',
                  v_riga ->> 'nome_documento', v_riga ->> 'oggetto', v_riga ->> 'nome',
                  v_riga ->> 'email', v_riga ->> 'descrizione'), 200),
    v_campi, v_prima, v_dopo, v_dettagli);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $fn$;

-- Ripristino ---------------------------------------------------------------------
create or replace function public.gestionale_ripristina(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  non_ripristinabili constant text[] := array['scadenze_bandi_utenti', 'scadenze_bandi_backup_registro'];
  r record;
  rr record;
  v_id bigint;
  v_pendenti bigint[];
  v_ancora bigint[];
  v_colonne text;
  v_progresso boolean;
  v_ripristinati jsonb := '[]';
  v_saltati jsonb := '[]';
  v_errori jsonb := '[]';
  v_ricollegati jsonb := '[]';
  v_cols text;
  v_cond text;
  v_n integer;
begin
  select * into r from scadenze_bandi_registro_operazioni where id = p_id;
  if not found or r.evento <> 'eliminazione' or r.prima is null then
    raise exception 'Operazione non ripristinabile: non è un''eliminazione';
  end if;
  if r.tabella = any (non_ripristinabili) then
    raise exception 'Gli elementi di questo tipo non si ripristinano dal registro';
  end if;
  if exists (select 1 from scadenze_bandi_registro_operazioni x
             where x.evento = 'ripristino' and x.dettagli ->> 'ripristino_di' = p_id::text) then
    raise exception 'Questa eliminazione è già stata ripristinata';
  end if;

  -- Tutto ciò che è stato eliminato nella stessa operazione e non ancora ripristinato
  select array_agg(o.id order by o.id) into v_pendenti
  from scadenze_bandi_registro_operazioni o
  where o.evento = 'eliminazione' and o.prima is not null
    and not (o.tabella = any (non_ripristinabili))
    and (o.id = p_id or (r.transazione is not null and o.transazione = r.transazione))
    and not exists (select 1 from scadenze_bandi_registro_operazioni x
                    where x.evento = 'ripristino' and x.dettagli ->> 'ripristino_di' = o.id::text);

  -- Più passate: un elemento si reinserisce dopo quelli a cui è collegato
  loop
    v_progresso := false;
    v_ancora := '{}';
    foreach v_id in array v_pendenti loop
      select * into rr from scadenze_bandi_registro_operazioni where id = v_id;
      select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into v_colonne
      from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = rr.tabella
        and c.is_generated = 'NEVER' and c.identity_generation is distinct from 'ALWAYS';
      begin
        perform set_config('gestionale.ripristino_di', rr.id::text, true);
        execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)',
                       rr.tabella, v_colonne, v_colonne, rr.tabella)
          using rr.prima;
        v_ripristinati := v_ripristinati || jsonb_build_object(
          'registro_id', rr.id, 'tabella', rr.tabella, 'record_id', rr.record_id,
          'descrizione', rr.descrizione, 'prima', rr.prima);
        v_progresso := true;
      exception
        when foreign_key_violation then
          v_ancora := v_ancora || rr.id;
        when unique_violation then
          v_saltati := v_saltati || jsonb_build_object(
            'registro_id', rr.id, 'tabella', rr.tabella, 'descrizione', rr.descrizione,
            'motivo', 'esiste già un elemento con gli stessi dati');
        when others then
          v_errori := v_errori || jsonb_build_object(
            'registro_id', rr.id, 'tabella', rr.tabella, 'descrizione', rr.descrizione, 'motivo', sqlerrm);
      end;
    end loop;
    perform set_config('gestionale.ripristino_di', '', true);
    exit when not v_progresso or cardinality(v_ancora) = 0;
    v_pendenti := v_ancora;
  end loop;

  foreach v_id in array coalesce(v_ancora, '{}') loop
    select * into rr from scadenze_bandi_registro_operazioni where id = v_id;
    v_errori := v_errori || jsonb_build_object(
      'registro_id', rr.id, 'tabella', rr.tabella, 'descrizione', rr.descrizione,
      'motivo', 'manca un elemento collegato, eliminato in un''altra operazione: ripristinare prima quello');
  end loop;

  -- Righe staccate dall'eliminazione (collegamento azzerato): si ricollegano
  if r.transazione is not null then
    for rr in
      select o.* from scadenze_bandi_registro_operazioni o
      where o.transazione = r.transazione and o.evento = 'modifica'
        and coalesce(cardinality(o.campi), 0) > 0
        and not (o.tabella = any (non_ripristinabili))
        and not exists (select 1 from jsonb_each(o.dopo) e where e.value <> 'null'::jsonb)
      order by o.id
    loop
      select string_agg(quote_ident(c), ', '), string_agg('t.' || quote_ident(c) || ' is null', ' and ')
        into v_cols, v_cond
      from unnest(rr.campi) c;
      begin
        perform set_config('gestionale.ripristino_di', rr.id::text, true);
        execute format('update public.%I t set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where t.id::text = $2 and %s',
                       rr.tabella, v_cols, v_cols, rr.tabella, v_cond)
          using rr.prima, rr.record_id;
        get diagnostics v_n = row_count;
        if v_n > 0 then
          v_ricollegati := v_ricollegati || jsonb_build_object(
            'registro_id', rr.id, 'tabella', rr.tabella, 'record_id', rr.record_id, 'descrizione', rr.descrizione);
        end if;
      exception when others then
        v_errori := v_errori || jsonb_build_object(
          'registro_id', rr.id, 'tabella', rr.tabella, 'descrizione', rr.descrizione,
          'motivo', 'non ricollegata: ' || sqlerrm);
      end;
    end loop;
    perform set_config('gestionale.ripristino_di', '', true);
  end if;

  return jsonb_build_object('ripristinati', v_ripristinati, 'ricollegati', v_ricollegati,
                            'saltati', v_saltati, 'errori', v_errori);
end $fn$;

revoke all on function public.gestionale_ripristina(bigint) from public, anon, authenticated;
grant execute on function public.gestionale_ripristina(bigint) to service_role;
