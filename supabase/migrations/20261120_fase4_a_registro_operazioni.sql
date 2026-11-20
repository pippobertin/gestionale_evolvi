-- =============================================================================
-- Fase 4, passaggio A: registro delle operazioni (Modello 231)
--
-- Una sola tabella, non modificabile, con chi ha fatto che cosa e quando:
-- - le modifiche ai dati (inserimento, modifica, eliminazione) le scrive un
--   trigger su ogni tabella del gestionale, con i valori prima e dopo;
-- - gli eventi che non toccano i dati (accessi, uscite, cambi di password,
--   email inviate) li scrive il server.
--
-- Chi è l'autore:
-- - dal browser (badge del gestionale): gestionale_utente_id();
-- - dal server (chiave di servizio): l'intestazione x-gestionale-utente, che il
--   server ricava dalla sessione verificata. È accettata solo con la chiave di
--   servizio, che il browser non possiede;
-- - senza utente: "sistema" (cron, automatismi) o "database" (SQL diretto).
--
-- Le eliminazioni conservano la riga intera: è la base del ripristino (4B).
-- Annullamento: 20261120_fase4_a_registro_operazioni_ROLLBACK.sql
-- =============================================================================

create table if not exists public.scadenze_bandi_registro_operazioni (
  id bigint generated always as identity primary key,
  quando timestamptz not null default clock_timestamp(),
  utente_id uuid,                 -- senza vincolo: la riga resta anche se l'utente viene eliminato
  utente_nome text,               -- nome al momento dell'operazione
  canale text not null check (canale in ('interfaccia', 'server', 'sistema', 'database')),
  evento text not null,           -- inserimento, modifica, eliminazione, accesso, uscita, ...
  tabella text,
  record_id text,
  cliente_id uuid,
  descrizione text,
  campi text[],
  prima jsonb,
  dopo jsonb,
  esito text not null default 'ok' check (esito in ('ok', 'negato', 'errore')),
  dettagli jsonb
);

create index if not exists idx_registro_quando on public.scadenze_bandi_registro_operazioni (quando desc);
create index if not exists idx_registro_utente on public.scadenze_bandi_registro_operazioni (utente_id, quando desc);
create index if not exists idx_registro_cliente on public.scadenze_bandi_registro_operazioni (cliente_id, quando desc) where cliente_id is not null;
create index if not exists idx_registro_tabella on public.scadenze_bandi_registro_operazioni (tabella, record_id);
create index if not exists idx_registro_evento on public.scadenze_bandi_registro_operazioni (evento, quando desc);

-- Non modificabile: niente modifiche né cancellazioni, per nessuno ---------------
create or replace function public.gestionale_registro_immutabile()
returns trigger
language plpgsql
as $fn$
begin
  raise exception 'Il registro delle operazioni non può essere modificato né cancellato';
end $fn$;

drop trigger if exists trg_registro_immutabile on public.scadenze_bandi_registro_operazioni;
create trigger trg_registro_immutabile
  before update or delete on public.scadenze_bandi_registro_operazioni
  for each row execute function public.gestionale_registro_immutabile();

drop trigger if exists trg_registro_no_truncate on public.scadenze_bandi_registro_operazioni;
create trigger trg_registro_no_truncate
  before truncate on public.scadenze_bandi_registro_operazioni
  for each statement execute function public.gestionale_registro_immutabile();

alter table public.scadenze_bandi_registro_operazioni enable row level security;
revoke all on public.scadenze_bandi_registro_operazioni from public, anon, authenticated;
revoke update, delete, truncate on public.scadenze_bandi_registro_operazioni from service_role;
grant select, insert on public.scadenze_bandi_registro_operazioni to service_role;
grant select on public.scadenze_bandi_registro_operazioni to authenticated;

drop policy if exists gestionale_registro_lettura on public.scadenze_bandi_registro_operazioni;
create policy gestionale_registro_lettura on public.scadenze_bandi_registro_operazioni
  for select to authenticated
  using ((select public.gestionale_is_admin()));

-- Autore dell'operazione ---------------------------------------------------------
create or replace function public.gestionale_canale()
returns text
language sql
stable
as $fn$
  select case coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '')
    when 'authenticated' then 'interfaccia'
    when 'service_role' then
      case when coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-gestionale-utente', '')
                ~ '^[0-9a-fA-F-]{36}$'
           then 'server' else 'sistema' end
    else 'database'
  end
$fn$;

create or replace function public.gestionale_autore()
returns uuid
language plpgsql
stable security definer
set search_path to 'public'
as $fn$
declare
  ruolo text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '');
  dichiarato text;
begin
  if ruolo = 'authenticated' then
    return public.gestionale_utente_id();
  elsif ruolo = 'service_role' then
    dichiarato := nullif(current_setting('request.headers', true), '')::json ->> 'x-gestionale-utente';
    if dichiarato ~ '^[0-9a-fA-F-]{36}$' then
      return dichiarato::uuid;
    end if;
  end if;
  return null;
end $fn$;

revoke all on function public.gestionale_autore() from public, anon;
grant execute on function public.gestionale_autore() to authenticated, service_role;

-- Trigger generico sulle tabelle del gestionale ----------------------------------
create or replace function public.gestionale_registra_operazione()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  -- colonne con segreti: mai registrate, si annota solo che sono cambiate
  segrete constant text[] := array['password_hash', 'gmail_refresh_token', 'gmail_access_token',
                                   'token', 'token_hash', 'encrypted_password',
                                   'oauth_refresh_token', 'oauth_access_token'];
  -- colonne tecniche che da sole non fanno una modifica
  tecniche constant text[] := array['updated_at', 'ultimo_accesso', 'gmail_access_token'];
  v_old jsonb;
  v_new jsonb;
  v_riga jsonb;
  v_prima jsonb := null;
  v_dopo jsonb := null;
  v_campi text[] := null;
  v_evento text;
  v_autore uuid := public.gestionale_autore();
  v_nome text;
  v_cliente uuid;
  k text;
begin
  if tg_op = 'INSERT' then
    v_evento := 'inserimento';
    v_new := to_jsonb(new) - segrete;
    v_riga := v_new;
    v_dopo := v_new;
  elsif tg_op = 'DELETE' then
    v_evento := 'eliminazione';
    v_old := to_jsonb(old) - segrete;
    v_riga := v_old;
    v_prima := v_old;
  else
    v_evento := 'modifica';
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_riga := v_new - segrete;
    v_prima := '{}'::jsonb;
    v_dopo := '{}'::jsonb;
    v_campi := '{}';
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
    if cardinality(v_campi) = 0 then
      return new;   -- cambiate solo colonne tecniche: niente da registrare
    end if;
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
    (utente_id, utente_nome, canale, evento, tabella, record_id, cliente_id, descrizione, campi, prima, dopo)
  values (
    v_autore, v_nome, public.gestionale_canale(), v_evento, tg_table_name, v_riga ->> 'id', v_cliente,
    left(coalesce(case when tg_table_name = 'scadenze_bandi_utenti'
                       then trim(coalesce(v_riga ->> 'nome', '') || ' ' || coalesce(v_riga ->> 'cognome', '')) end,
                  v_riga ->> 'denominazione', v_riga ->> 'nome_bando', v_riga ->> 'titolo_progetto',
                  v_riga ->> 'titolo', v_riga ->> 'nome_file', v_riga ->> 'nome_originale',
                  v_riga ->> 'nome_documento', v_riga ->> 'oggetto', v_riga ->> 'nome',
                  v_riga ->> 'email', v_riga ->> 'descrizione'), 200),
    v_campi, v_prima, v_dopo
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $fn$;

revoke all on function public.gestionale_registra_operazione() from public, anon, authenticated;

-- Il registro delle modifiche ai dati dimensionali ora riconosce anche il server
create or replace function public.gestionale_log_dati_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  autore uuid := public.gestionale_autore();
begin
  if tg_table_name = 'scadenze_bandi_clienti' then
    if new.ula is distinct from old.ula then
      insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
      values (new.id, 'cliente', 'ula', old.ula::text, new.ula::text, autore);
    end if;
    if new.ultimo_fatturato is distinct from old.ultimo_fatturato then
      insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
      values (new.id, 'cliente', 'fatturato', old.ultimo_fatturato::text, new.ultimo_fatturato::text, autore);
    end if;
    if new.attivo_bilancio is distinct from old.attivo_bilancio then
      insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
      values (new.id, 'cliente', 'attivo', old.attivo_bilancio::text, new.attivo_bilancio::text, autore);
    end if;
    if new.esercizio_riferimento is distinct from old.esercizio_riferimento then
      insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
      values (new.id, 'cliente', 'esercizio_riferimento', old.esercizio_riferimento::text, new.esercizio_riferimento::text, autore);
    end if;
  elsif tg_op = 'INSERT' then
    insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
    values (new.cliente_id, 'esercizio ' || new.esercizio, 'inserimento',
            null, format('ULA %s, fatturato %s, attivo %s (%s)', coalesce(new.ula::text, '-'), coalesce(new.fatturato::text, '-'), coalesce(new.attivo::text, '-'), new.fonte), autore);
  elsif tg_op = 'UPDATE' then
    insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
    select new.cliente_id, 'esercizio ' || new.esercizio, c.campo, c.prima, c.dopo, autore
    from (values ('ula', old.ula::text, new.ula::text),
                 ('fatturato', old.fatturato::text, new.fatturato::text),
                 ('attivo', old.attivo::text, new.attivo::text),
                 ('fonte', old.fonte, new.fonte)) as c(campo, prima, dopo)
    where c.prima is distinct from c.dopo;
  elsif tg_op = 'DELETE' then
    insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
    values (old.cliente_id, 'esercizio ' || old.esercizio, 'eliminazione',
            format('ULA %s, fatturato %s, attivo %s', coalesce(old.ula::text, '-'), coalesce(old.fatturato::text, '-'), coalesce(old.attivo::text, '-')), null, autore);
    return old;
  end if;
  return new;
end $fn$;

-- Aggancio del trigger: tutte le tabelle del gestionale tranne registri,
-- tabelle di riferimento importate, code tecniche e vecchio client di posta
do $do$
declare
  t text;
  escluse constant text[] := array[
    'scadenze_bandi_registro_operazioni',
    'scadenze_bandi_sessioni',
    'scadenze_bandi_system_settings',
    'scadenze_bandi_notification_log',
    'scadenze_bandi_email_queue',
    'scadenze_bandi_clienti_dati_log',
    'scadenze_bandi_scadenze_contrattuali_log',
    'scadenze_bandi_prospect_history',
    'scadenze_bandi_rna_aiuti',
    'scadenze_bandi_rna_import_log',
    'scadenze_bandi_rna_richieste',
    'scadenze_bandi_rna_agente',
    'scadenze_bandi_ateco_2025',
    'scadenze_bandi_ccnl',
    'scadenze_bandi_ccnl_sigle',
    'scadenze_bandi_sigle_sindacali',
    'scadenze_bandi_email_accounts',
    'scadenze_bandi_email_messages',
    'scadenze_bandi_email_attachments',
    'scadenze_bandi_email_folders',
    'scadenze_bandi_email_links',
    'scadenze_bandi_email_sync_logs'
  ];
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
      and table_name like 'scadenze\_bandi\_%'
      and not (table_name = any (escluse))
  loop
    execute format('drop trigger if exists trg_registro_operazioni on public.%I', t);
    execute format('create trigger trg_registro_operazioni after insert or update or delete on public.%I
                    for each row execute function public.gestionale_registra_operazione()', t);
  end loop;
end $do$;

-- Storia pregressa: gli accessi già registrati nelle sessioni
insert into public.scadenze_bandi_registro_operazioni
  (quando, utente_id, utente_nome, canale, evento, tabella, record_id, descrizione, dettagli)
select s.created_at, s.utente_id,
       nullif(trim(coalesce(u.nome, '') || ' ' || coalesce(u.cognome, '')), ''),
       'server', 'accesso', 'scadenze_bandi_sessioni', s.id::text,
       case s.metodo when 'google' then 'Accesso con Google' when 'password' then 'Accesso con password' else 'Accesso' end,
       jsonb_build_object('ip', s.ip_address, 'dispositivo', s.user_agent, 'storico', true)
from public.scadenze_bandi_sessioni s
left join public.scadenze_bandi_utenti u on u.id = s.utente_id
order by s.created_at;

insert into public.scadenze_bandi_registro_operazioni
  (quando, utente_id, utente_nome, canale, evento, tabella, record_id, descrizione, dettagli)
select s.revoked_at, s.utente_id,
       nullif(trim(coalesce(u.nome, '') || ' ' || coalesce(u.cognome, '')), ''),
       'server', 'uscita', 'scadenze_bandi_sessioni', s.id::text,
       'Sessione chiusa (uscita o revoca)',
       jsonb_build_object('storico', true)
from public.scadenze_bandi_sessioni s
left join public.scadenze_bandi_utenti u on u.id = s.utente_id
where s.revoked_at is not null
order by s.revoked_at;
