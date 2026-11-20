-- Registro delle operazioni: il contenuto delle dichiarazioni degli interessi (colonna
-- sezioni) non viene conservato, come le password: all'OdV le dichiarazioni arrivano
-- solo in forma riepilogativa (modulo M.04). Resta registrato chi le presenta e quando.
create or replace function public.gestionale_registra_operazione()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  segrete constant text[] := array['password_hash', 'gmail_refresh_token', 'gmail_access_token',
                                   'token', 'token_hash', 'encrypted_password',
                                   'oauth_refresh_token', 'oauth_access_token',
                                   'sezioni'];  -- contenuto delle dichiarazioni degli interessi (riservato)
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
