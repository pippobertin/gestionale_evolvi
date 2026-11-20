-- =============================================================================
-- Fase 4, passaggio C1: ruoli e permessi configurabili (Modello 231)
--
-- 1. Ruoli: admin, collaboratore, collaboratore_limitato, odv (l'OdV arriva
--    con il passaggio C2: qui è solo ammesso dal vincolo).
-- 2. Catalogo dei permessi e matrice per ruolo, modificabile dagli
--    amministratori (Impostazioni > Ruoli e permessi). Gli amministratori hanno
--    sempre tutti i permessi.
-- 3. Un controllo nel database, prima di ogni scrittura, verifica il permesso
--    di chi sta operando, dal browser o dal server (l'autore è quello del
--    registro, fase 4A). Le operazioni automatiche senza utente non sono
--    toccate; le cancellazioni a cascata seguono il permesso dell'operazione
--    che le ha avviate.
-- 4. Contratti: chi genera la bozza non la approva, salvo deroga motivata.
-- 5. Interruttore (system_settings.permessi_attivi): 'anteprima' applica il
--    controllo solo alle richieste dell'anteprima (badge con amb=preview o
--    intestazione x-gestionale-ambiente del server), 'tutti' anche alla
--    produzione, 'no' lo spegne. Anteprima e produzione condividono il database:
--    si passa a 'tutti' quando il codice è pubblicato su main.
-- Annullamento: 20261120_fase4_c1_permessi_ROLLBACK.sql
-- =============================================================================

-- 1. Ruoli ---------------------------------------------------------------------
-- La colonna era varchar(20): "collaboratore_limitato" ha 22 caratteri. La vista
-- che la usa va ricreata identica.
drop view if exists public.scadenze_bandi_utenti_view;
alter table public.scadenze_bandi_utenti alter column livello_permessi type varchar(30);
create view public.scadenze_bandi_utenti_view with (security_invoker = on) as
  select id, email, nome, cognome, livello_permessi, attivo, ultimo_accesso, created_at, updated_at, created_by,
         concat(nome, ' ', cognome) as nome_completo
  from public.scadenze_bandi_utenti where attivo = true;
revoke all on public.scadenze_bandi_utenti_view from public, anon, authenticated;
grant all on public.scadenze_bandi_utenti_view to service_role;

alter table public.scadenze_bandi_utenti drop constraint if exists scadenze_bandi_utenti_livello_permessi_check;
alter table public.scadenze_bandi_utenti add constraint scadenze_bandi_utenti_livello_permessi_check
  check (livello_permessi::text = any (array['admin', 'collaboratore', 'collaboratore_limitato', 'odv']));

-- 2. Catalogo e matrice ----------------------------------------------------------
create table if not exists public.scadenze_bandi_permessi_catalogo (
  chiave text primary key,
  etichetta text not null,
  descrizione text not null,
  ordine integer not null
);

create table if not exists public.scadenze_bandi_permessi_ruolo (
  ruolo text not null check (ruolo in ('collaboratore', 'collaboratore_limitato')),
  permesso text not null references public.scadenze_bandi_permessi_catalogo(chiave) on delete cascade,
  consentito boolean not null,
  aggiornato_da uuid,
  aggiornato_il timestamptz not null default now(),
  primary key (ruolo, permesso)
);

insert into public.scadenze_bandi_permessi_catalogo (chiave, etichetta, descrizione, ordine) values
  ('dati.modifica', 'Creare e modificare i dati',
   'Clienti, prospect, bandi, progetti, scadenze, documenti, note e formazione', 10),
  ('dati_economici.modifica', 'Modificare i dati di bilancio',
   'ULA, fatturato, attivo ed esercizi: da questi dati dipende la dimensione d''impresa', 20),
  ('elementi.elimina', 'Eliminare elementi',
   'Note, documenti, scadenze, referenti e altri elementi collegati (restano ripristinabili)', 30),
  ('entita.elimina', 'Eliminare clienti, prospect, progetti, bandi e contratti',
   'Con tutto ciò che vi è collegato (restano ripristinabili dal registro)', 40),
  ('contratti.genera', 'Generare le bozze dei contratti',
   'Contratti di progetto e del Metodo Evolvi', 50),
  ('contratti.approva', 'Approvare e inviare i contratti',
   'Anche solleciti e rinnovi Evolvi. Chi ha generato la bozza non la approva, salvo deroga motivata', 60),
  ('contratti.registra_firmato', 'Registrare il contratto firmato',
   'Caricamento del contratto ricevuto firmato dal cliente', 70),
  ('email.invia', 'Inviare email dal gestionale',
   'Email singole, invii multipli dalle interrogazioni e questionari ai clienti', 80),
  ('riferimento.modifica', 'Modificare le tabelle di riferimento',
   'Tipologie e modelli di scadenza, catalogo eventi, tipologie di bando, fondi, gruppi e uffici', 90)
on conflict (chiave) do update
  set etichetta = excluded.etichetta, descrizione = excluded.descrizione, ordine = excluded.ordine;

insert into public.scadenze_bandi_permessi_ruolo (ruolo, permesso, consentito) values
  ('collaboratore', 'dati.modifica', true),
  ('collaboratore', 'dati_economici.modifica', true),
  ('collaboratore', 'elementi.elimina', true),
  ('collaboratore', 'entita.elimina', false),
  ('collaboratore', 'contratti.genera', true),
  ('collaboratore', 'contratti.approva', false),
  ('collaboratore', 'contratti.registra_firmato', true),
  ('collaboratore', 'email.invia', true),
  ('collaboratore', 'riferimento.modifica', false),
  ('collaboratore_limitato', 'dati.modifica', true),
  ('collaboratore_limitato', 'dati_economici.modifica', false),
  ('collaboratore_limitato', 'elementi.elimina', false),
  ('collaboratore_limitato', 'entita.elimina', false),
  ('collaboratore_limitato', 'contratti.genera', false),
  ('collaboratore_limitato', 'contratti.approva', false),
  ('collaboratore_limitato', 'contratti.registra_firmato', false),
  ('collaboratore_limitato', 'email.invia', false),
  ('collaboratore_limitato', 'riferimento.modifica', false)
on conflict (ruolo, permesso) do nothing;

alter table public.scadenze_bandi_permessi_catalogo enable row level security;
alter table public.scadenze_bandi_permessi_ruolo enable row level security;
revoke all on public.scadenze_bandi_permessi_catalogo, public.scadenze_bandi_permessi_ruolo from public, anon, authenticated;
grant select on public.scadenze_bandi_permessi_catalogo, public.scadenze_bandi_permessi_ruolo to authenticated;
drop policy if exists gestionale_lettura on public.scadenze_bandi_permessi_catalogo;
create policy gestionale_lettura on public.scadenze_bandi_permessi_catalogo for select to authenticated
  using ((select public.gestionale_utente_id()) is not null);
drop policy if exists gestionale_lettura on public.scadenze_bandi_permessi_ruolo;
create policy gestionale_lettura on public.scadenze_bandi_permessi_ruolo for select to authenticated
  using ((select public.gestionale_utente_id()) is not null);

-- 3. Funzioni ----------------------------------------------------------------------
create or replace function public.gestionale_ruolo(p_utente uuid)
returns text language sql stable security definer set search_path to 'public' as $fn$
  select u.livello_permessi::text from scadenze_bandi_utenti u where u.id = p_utente
$fn$;

create or replace function public.gestionale_ha_permesso(p_permesso text, p_utente uuid)
returns boolean language plpgsql stable security definer set search_path to 'public' as $fn$
declare
  v_ruolo text := public.gestionale_ruolo(p_utente);
begin
  if v_ruolo = 'admin' then return true; end if;
  if v_ruolo is null or v_ruolo = 'odv' then return false; end if;
  return coalesce((select pr.consentito from scadenze_bandi_permessi_ruolo pr
                   where pr.ruolo = v_ruolo and pr.permesso = p_permesso), false);
end $fn$;

revoke all on function public.gestionale_ruolo(uuid) from public, anon, authenticated;
revoke all on function public.gestionale_ha_permesso(text, uuid) from public, anon, authenticated;
grant execute on function public.gestionale_ruolo(uuid) to service_role;
grant execute on function public.gestionale_ha_permesso(text, uuid) to service_role;

-- Ambiente della richiesta: preview, production o development (null se non indicato)
create or replace function public.gestionale_ambiente()
returns text language sql stable as $fn$
  select case coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '')
    when 'authenticated' then nullif(current_setting('request.jwt.claims', true), '')::json ->> 'amb'
    when 'service_role' then nullif(current_setting('request.headers', true), '')::json ->> 'x-gestionale-ambiente'
    else null end
$fn$;

insert into public.scadenze_bandi_system_settings (key, value, description, encrypted)
select 'permessi_attivi', 'anteprima',
       'Controllo dei permessi nel database: no, anteprima (solo richieste dall''anteprima), tutti', false
where not exists (select 1 from public.scadenze_bandi_system_settings where key = 'permessi_attivi');

create or replace function public.gestionale_controlla_permesso()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  entita constant text[] := array['scadenze_bandi_clienti', 'scadenze_bandi_prospect', 'scadenze_bandi_progetti',
    'scadenze_bandi_bandi', 'scadenze_bandi_contratti_evolvi', 'scadenze_bandi_contract_tracking'];
  riferimento constant text[] := array['scadenze_bandi_tipologie_scadenze', 'scadenze_bandi_template_scadenze',
    'scadenze_bandi_eventi_catalogo', 'scadenze_bandi_tipologie_bando', 'scadenze_bandi_fondi_interprofessionali',
    'scadenze_bandi_profiling_template', 'scadenze_bandi_uffici_dipartimenti', 'scadenze_bandi_gruppi_utenti',
    'scadenze_bandi_ateco_2025', 'scadenze_bandi_ccnl', 'scadenze_bandi_ccnl_sigle', 'scadenze_bandi_sigle_sindacali'];
  personali constant text[] := array['scadenze_bandi_notification_settings', 'scadenze_bandi_calendar_events',
    'scadenze_bandi_additional_recipients'];
  contratti constant text[] := array['scadenze_bandi_contratti_evolvi', 'scadenze_bandi_contract_tracking'];
  v_utente uuid;
  v_ruolo text;
  v_permesso text;
  v_ok boolean;
  v_modo text;
begin
  -- Cascate e trigger annidati: vale il controllo fatto sull'operazione di partenza
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_modo := coalesce((select value from scadenze_bandi_system_settings where key = 'permessi_attivi' limit 1), 'no');
  if v_modo = 'no' or (v_modo = 'anteprima' and coalesce(public.gestionale_ambiente(), '') <> 'preview') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_utente := public.gestionale_autore();
  if v_utente is null then
    return case when tg_op = 'DELETE' then old else new end;   -- automatismi e SQL diretto
  end if;
  v_ruolo := public.gestionale_ruolo(v_utente);
  if v_ruolo = 'admin' or tg_table_name = any (personali) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    v_permesso := case
      when tg_table_name = any (entita) then 'entita.elimina'
      when tg_table_name = any (riferimento) then 'riferimento.modifica'
      else 'elementi.elimina' end;
    v_ok := public.gestionale_ha_permesso(v_permesso, v_utente);
  elsif tg_table_name = any (riferimento) then
    v_permesso := 'riferimento.modifica';
    v_ok := public.gestionale_ha_permesso(v_permesso, v_utente);
  elsif tg_table_name = any (contratti) then
    -- Le operazioni sui contratti seguono i permessi dei contratti
    v_permesso := 'contratti.genera';
    v_ok := public.gestionale_ha_permesso('dati.modifica', v_utente)
         or public.gestionale_ha_permesso('contratti.genera', v_utente)
         or public.gestionale_ha_permesso('contratti.approva', v_utente)
         or public.gestionale_ha_permesso('contratti.registra_firmato', v_utente);
  elsif tg_table_name = 'scadenze_bandi_clienti_esercizi' then
    v_permesso := 'dati_economici.modifica';
    v_ok := public.gestionale_ha_permesso(v_permesso, v_utente);
  else
    v_permesso := 'dati.modifica';
    v_ok := public.gestionale_ha_permesso(v_permesso, v_utente);
    if v_ok and tg_op = 'UPDATE' and tg_table_name = 'scadenze_bandi_clienti'
       and (to_jsonb(new) -> 'ula', to_jsonb(new) -> 'ultimo_fatturato', to_jsonb(new) -> 'attivo_bilancio', to_jsonb(new) -> 'esercizio_riferimento')
           is distinct from
           (to_jsonb(old) -> 'ula', to_jsonb(old) -> 'ultimo_fatturato', to_jsonb(old) -> 'attivo_bilancio', to_jsonb(old) -> 'esercizio_riferimento') then
      v_permesso := 'dati_economici.modifica';
      v_ok := public.gestionale_ha_permesso(v_permesso, v_utente);
    end if;
  end if;

  if not v_ok then
    raise exception 'Permesso negato: %', coalesce(
      (select lower(c.etichetta) from scadenze_bandi_permessi_catalogo c where c.chiave = v_permesso), v_permesso)
      using errcode = '42501', hint = v_permesso;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $fn$;

revoke all on function public.gestionale_controlla_permesso() from public, anon, authenticated;

-- Aggancio: tabelle operative del gestionale (esclusi registri, sessioni, utenti,
-- impostazioni di sistema, code tecniche, log e vecchio client di posta)
do $do$
declare
  t text;
  escluse constant text[] := array[
    'scadenze_bandi_registro_operazioni', 'scadenze_bandi_sessioni', 'scadenze_bandi_utenti',
    'scadenze_bandi_system_settings', 'scadenze_bandi_notification_log', 'scadenze_bandi_email_queue',
    'scadenze_bandi_clienti_dati_log', 'scadenze_bandi_scadenze_contrattuali_log', 'scadenze_bandi_prospect_history',
    'scadenze_bandi_rna_import_log', 'scadenze_bandi_rna_agente', 'scadenze_bandi_backup_registro',
    'scadenze_bandi_rna_aiuti', 'scadenze_bandi_rna_richieste',
    'scadenze_bandi_permessi_catalogo', 'scadenze_bandi_permessi_ruolo',
    'scadenze_bandi_email_accounts', 'scadenze_bandi_email_messages', 'scadenze_bandi_email_attachments',
    'scadenze_bandi_email_folders', 'scadenze_bandi_email_links', 'scadenze_bandi_email_sync_logs'];
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
      and table_name like 'scadenze\_bandi\_%' and not (table_name = any (escluse))
  loop
    execute format('drop trigger if exists trg_controlla_permesso on public.%I', t);
    execute format('create trigger trg_controlla_permesso before insert or update or delete on public.%I
                    for each row execute function public.gestionale_controlla_permesso()', t);
  end loop;
end $do$;

-- 4. Contratti: chi genera, chi approva, deroga ---------------------------------------
alter table public.scadenze_bandi_contract_tracking
  add column if not exists contract_file_id text,
  add column if not exists generato_da uuid,
  add column if not exists generato_il timestamptz,
  add column if not exists approvato_da uuid,
  add column if not exists approvato_il timestamptz,
  add column if not exists deroga_approvazione text;

alter table public.scadenze_bandi_contratti_evolvi
  add column if not exists generato_da uuid,
  add column if not exists approvato_da_utente uuid,
  add column if not exists deroga_approvazione text;

create index if not exists idx_tracking_contract_file on public.scadenze_bandi_contract_tracking (contract_file_id)
  where contract_file_id is not null;
