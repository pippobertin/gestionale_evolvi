-- =============================================================================
-- Pratica di finanza agevolata guidata, passaggio A (Modello 231, PR.01 e PR.02)
--
-- Fasi prima dell'invio, sulla pratica (scadenze_bandi_progetti):
--   incarico -> progettazione -> controllo_preinvio -> invio -> inviata
-- poi proseguono gli stati esistenti (decreto atteso, ricevuto, ...).
--
-- Passaggi controllati (si superano solo con i requisiti; un amministratore può
-- derogare con motivazione, che resta nella cronologia e nel registro):
--   -> progettazione: contratto firmato oppure ordine di lavoro confermato;
--                     RP e REV assegnati e diversi; per le domande di BLM in
--                     proprio RP e REV diversi dall'AU; se il REV segue anche
--                     una pratica concorrente sullo stesso bando, motivazione.
--   -> invio:         checklist pre-invio confermata dal REV.
--   -> inviata:       conferma scritta del cliente sulla versione finale,
--                     delega se trasmette BLM, ricevuta di invio.
-- I tornare indietro di fase è sempre possibile (per esempio dopo il controllo
-- del REV). La fase si cambia solo con gestionale_cambia_fase().
-- Annullamento: 20261121_pratica_guidata_a_ROLLBACK.sql
-- =============================================================================

-- 1. Pratica -----------------------------------------------------------------------
alter table public.scadenze_bandi_progetti
  add column if not exists fase text,
  add column if not exists rp_id uuid references public.scadenze_bandi_utenti(id),
  add column if not exists rev_id uuid references public.scadenze_bandi_utenti(id),
  add column if not exists pratica_propria boolean not null default false,
  add column if not exists trasmissione text check (trasmissione in ('blm', 'cliente')),
  add column if not exists motivazione_stesso_bando text,
  add column if not exists data_invio date;

-- Le pratiche esistenti sono già state inviate
update public.scadenze_bandi_progetti set fase = 'inviata' where fase is null;
alter table public.scadenze_bandi_progetti alter column fase set default 'incarico';
alter table public.scadenze_bandi_progetti alter column fase set not null;
alter table public.scadenze_bandi_progetti drop constraint if exists progetti_fase_check;
alter table public.scadenze_bandi_progetti add constraint progetti_fase_check
  check (fase in ('incarico', 'progettazione', 'controllo_preinvio', 'invio', 'inviata'));
alter table public.scadenze_bandi_progetti drop constraint if exists progetti_rp_rev_diversi;
alter table public.scadenze_bandi_progetti add constraint progetti_rp_rev_diversi
  check (rp_id is null or rev_id is null or rp_id <> rev_id);
create index if not exists idx_progetti_bando_fase on public.scadenze_bandi_progetti (bando_id, fase);

-- AU della società (per le domande di BLM in proprio)
insert into public.scadenze_bandi_system_settings (key, value, description, encrypted)
select 'utente_au', (select id::text from public.scadenze_bandi_utenti where nome = 'Chiara' and cognome = 'Canzi' limit 1),
       'Utente che ricopre il ruolo di Amministratrice Unica (Modello 231)', false
where not exists (select 1 from public.scadenze_bandi_system_settings where key = 'utente_au');

-- 2. Ordini di lavoro (clienti con accordo quadro) --------------------------------------
create table if not exists public.scadenze_bandi_ordini_lavoro (
  id uuid primary key default gen_random_uuid(),
  progetto_id uuid not null references public.scadenze_bandi_progetti(id) on delete cascade,
  cliente_id uuid references public.scadenze_bandi_clienti(id) on delete cascade,
  contratto_evolvi_id uuid references public.scadenze_bandi_contratti_evolvi(id) on delete set null,
  numero text,
  data_ordine date not null default current_date,
  attivita text,
  rendicontazione text not null,
  success_fee text,
  file_drive_id text,
  file_url text,
  confermato boolean not null default false,
  conferma_data date,
  conferma_canale text,
  conferma_file_drive_id text,
  conferma_file_url text,
  note text,
  generato_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  confermato_registrato_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ordini_lavoro_progetto on public.scadenze_bandi_ordini_lavoro (progetto_id);

-- 3. Contatti rilevanti con la PA e gli enti (PR.02 §4.1) --------------------------------
create table if not exists public.scadenze_bandi_contatti_pa (
  id uuid primary key default gen_random_uuid(),
  progetto_id uuid not null references public.scadenze_bandi_progetti(id) on delete cascade,
  cliente_id uuid references public.scadenze_bandi_clienti(id) on delete cascade,
  data date not null,
  ente text not null,
  persona text,
  tipo text not null check (tipo in ('richiesta_formale', 'comunicazione_esito', 'controllo', 'incontro', 'altro')),
  oggetto text not null,
  esito text,
  allegato_drive_id text,
  allegato_url text,
  registrato_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_contatti_pa_progetto on public.scadenze_bandi_contatti_pa (progetto_id, data desc);

-- 4. Verifiche della pratica: checklist del REV, conferma del cliente, delega, ricevuta -------
create table if not exists public.scadenze_bandi_pratica_verifiche (
  id uuid primary key default gen_random_uuid(),
  progetto_id uuid not null references public.scadenze_bandi_progetti(id) on delete cascade,
  tipo text not null check (tipo in ('checklist_preinvio', 'conferma_cliente', 'delega', 'ricevuta_invio')),
  voci jsonb,                -- checklist: [{chiave, etichetta, ok}]
  vale_anche_come_delega boolean not null default false,
  data date not null default current_date,
  file_drive_id text,
  file_url text,
  note text,
  eseguito_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_pratica_verifiche on public.scadenze_bandi_pratica_verifiche (progetto_id, tipo, created_at desc);

create table if not exists public.scadenze_bandi_checklist_voci (
  tipo text not null,
  chiave text not null,
  etichetta text not null,
  ordine integer not null,
  attiva boolean not null default true,
  primary key (tipo, chiave)
);
insert into public.scadenze_bandi_checklist_voci (tipo, chiave, etichetta, ordine) values
  ('checklist_preinvio', 'formulario', 'Formulario completo e coerente con il bando (requisiti, scadenza, modalità di invio)', 10),
  ('checklist_preinvio', 'dati', 'Dati e dichiarazioni riscontrati sui documenti del cliente', 20),
  ('checklist_preinvio', 'allegati', 'Allegati completi e firmati da chi ne ha i poteri', 30)
on conflict (tipo, chiave) do nothing;

-- 5. Cronologia dei passaggi di fase --------------------------------------------------------
create table if not exists public.scadenze_bandi_pratica_passaggi (
  id uuid primary key default gen_random_uuid(),
  progetto_id uuid not null references public.scadenze_bandi_progetti(id) on delete cascade,
  da_fase text,
  a_fase text not null,
  utente_id uuid references public.scadenze_bandi_utenti(id) on delete set null,
  deroga text,
  mancanti jsonb,
  note text,
  quando timestamptz not null default now()
);
create index if not exists idx_pratica_passaggi on public.scadenze_bandi_pratica_passaggi (progetto_id, quando desc);

-- Protezione e registro come le altre tabelle del gestionale
do $do$
declare t text;
begin
  foreach t in array array['scadenze_bandi_ordini_lavoro', 'scadenze_bandi_contatti_pa',
                           'scadenze_bandi_pratica_verifiche', 'scadenze_bandi_pratica_passaggi',
                           'scadenze_bandi_checklist_voci'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists gestionale_accesso on public.%I', t);
    execute format('create policy gestionale_accesso on public.%I for all to authenticated
                    using ((select public.gestionale_utente_id()) is not null)
                    with check ((select public.gestionale_utente_id()) is not null)', t);
    execute format('drop trigger if exists trg_registro_operazioni on public.%I', t);
    execute format('create trigger trg_registro_operazioni after insert or update or delete on public.%I
                    for each row execute function public.gestionale_registra_operazione()', t);
    execute format('drop trigger if exists trg_controlla_permesso on public.%I', t);
    execute format('create trigger trg_controlla_permesso before insert or update or delete on public.%I
                    for each row execute function public.gestionale_controlla_permesso()', t);
  end loop;
end $do$;

-- La cronologia dei passaggi non si modifica
create or replace function public.gestionale_passaggi_immutabili()
returns trigger language plpgsql as $fn$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;  -- eliminazione della pratica
  raise exception 'La cronologia dei passaggi della pratica non può essere modificata';
end $fn$;
drop trigger if exists trg_passaggi_immutabili on public.scadenze_bandi_pratica_passaggi;
create trigger trg_passaggi_immutabili before update or delete on public.scadenze_bandi_pratica_passaggi
  for each row execute function public.gestionale_passaggi_immutabili();

-- La checklist pre-invio la conferma solo il REV della pratica
create or replace function public.gestionale_verifica_rev()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_rev uuid; v_autore uuid := public.gestionale_autore();
begin
  if new.tipo = 'checklist_preinvio' and v_autore is not null then
    select rev_id into v_rev from scadenze_bandi_progetti where id = new.progetto_id;
    if v_rev is null or v_rev <> v_autore then
      raise exception 'La checklist pre-invio può confermarla solo il revisore (REV) della pratica'
        using errcode = '42501';
    end if;
    new.eseguito_da := v_autore;
  end if;
  return new;
end $fn$;
drop trigger if exists trg_verifica_rev on public.scadenze_bandi_pratica_verifiche;
create trigger trg_verifica_rev before insert or update on public.scadenze_bandi_pratica_verifiche
  for each row execute function public.gestionale_verifica_rev();

-- 6. Stato dei requisiti della pratica ----------------------------------------------------
create or replace function public.gestionale_stato_pratica(p_progetto uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $fn$
declare
  p record;
  v_au uuid := nullif((select value from scadenze_bandi_system_settings where key = 'utente_au' limit 1), '')::uuid;
  v_incarico_contratto boolean;
  v_incarico_ordine boolean;
  v_concorrenti jsonb;
  v_rev_coinvolto boolean;
  v_checklist public.scadenze_bandi_pratica_verifiche%rowtype;
  v_conferma public.scadenze_bandi_pratica_verifiche%rowtype;
  v_delega boolean;
  v_ricevuta boolean;
begin
  select * into p from scadenze_bandi_progetti where id = p_progetto;
  if not found then raise exception 'Pratica non trovata'; end if;

  select exists (select 1 from scadenze_bandi_contract_tracking t
                 where t.entity_type = 'PROGETTO' and t.entity_id = p.id and t.signed_contract_received)
    into v_incarico_contratto;
  select exists (select 1 from scadenze_bandi_ordini_lavoro o where o.progetto_id = p.id and o.confermato)
    into v_incarico_ordine;

  -- Pratiche aperte di altri clienti sullo stesso bando
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'titolo', o.titolo_progetto, 'cliente', c.denominazione, 'fase', o.fase,
           'rp_id', o.rp_id, 'rev_id', o.rev_id)), '[]'::jsonb),
         coalesce(bool_or(p.rev_id is not null and (o.rp_id = p.rev_id or o.rev_id = p.rev_id)), false)
    into v_concorrenti, v_rev_coinvolto
  from scadenze_bandi_progetti o
  left join scadenze_bandi_clienti c on c.id = o.cliente_id
  where o.bando_id = p.bando_id and o.id <> p.id
    and o.cliente_id is distinct from p.cliente_id
    and o.stato::text not in ('COMPLETATO', 'ANNULLATO');

  select v.* into v_checklist from scadenze_bandi_pratica_verifiche v
  where v.progetto_id = p.id and v.tipo = 'checklist_preinvio'
  order by v.created_at desc limit 1;
  select v.* into v_conferma from scadenze_bandi_pratica_verifiche v
  where v.progetto_id = p.id and v.tipo = 'conferma_cliente'
  order by v.created_at desc limit 1;
  select exists (select 1 from scadenze_bandi_pratica_verifiche v where v.progetto_id = p.id and v.tipo = 'delega')
         or coalesce(v_conferma.vale_anche_come_delega, false)
    into v_delega;
  select exists (select 1 from scadenze_bandi_pratica_verifiche v where v.progetto_id = p.id and v.tipo = 'ricevuta_invio')
    into v_ricevuta;

  return jsonb_build_object(
    'fase', p.fase,
    'incarico_contratto', v_incarico_contratto,
    'incarico_ordine', v_incarico_ordine,
    'incarico_ok', v_incarico_contratto or v_incarico_ordine,
    'rp_rev_ok', p.rp_id is not null and p.rev_id is not null and p.rp_id <> p.rev_id,
    'pratica_propria', p.pratica_propria,
    'au_escluso_ok', not p.pratica_propria or v_au is null
                     or (p.rp_id is distinct from v_au and p.rev_id is distinct from v_au),
    'concorrenti', v_concorrenti,
    'rev_coinvolto', v_rev_coinvolto,
    'motivazione_stesso_bando_ok', not v_rev_coinvolto or length(trim(coalesce(p.motivazione_stesso_bando, ''))) >= 15,
    'checklist_ok', v_checklist.id is not null and v_checklist.eseguito_da = p.rev_id
                    and not exists (select 1 from jsonb_array_elements(coalesce(v_checklist.voci, '[]'::jsonb)) e
                                    where coalesce((e ->> 'ok')::boolean, false) = false),
    'conferma_ok', v_conferma.id is not null,
    'trasmissione', p.trasmissione,
    'delega_ok', p.trasmissione = 'cliente' or v_delega,
    'trasmissione_ok', p.trasmissione is not null,
    'ricevuta_ok', v_ricevuta
  );
end $fn$;

revoke all on function public.gestionale_stato_pratica(uuid) from public, anon, authenticated;
grant execute on function public.gestionale_stato_pratica(uuid) to service_role;

-- 7. Cambio di fase ---------------------------------------------------------------------------
create or replace function public.gestionale_cambia_fase(p_progetto uuid, p_fase text, p_deroga text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  ordine constant text[] := array['incarico', 'progettazione', 'controllo_preinvio', 'invio', 'inviata'];
  v_autore uuid := public.gestionale_autore();
  v_ruolo text;
  v_da text;
  v_stato jsonb;
  v_mancanti text[] := '{}';
  v_deroga text := nullif(trim(coalesce(p_deroga, '')), '');
  i_da integer;
  i_a integer;
begin
  if v_autore is null then raise exception 'Utente non identificato'; end if;
  v_ruolo := public.gestionale_ruolo(v_autore);
  if not public.gestionale_ha_permesso('dati.modifica', v_autore) then
    raise exception 'Permesso negato: creare e modificare i dati' using errcode = '42501';
  end if;

  select fase into v_da from scadenze_bandi_progetti where id = p_progetto for update;
  if v_da is null then raise exception 'Pratica non trovata'; end if;
  i_da := array_position(ordine, v_da);
  i_a := array_position(ordine, p_fase);
  if i_a is null then raise exception 'Fase non valida'; end if;
  if i_a = i_da then return jsonb_build_object('ok', true, 'fase', v_da); end if;
  if i_a > i_da + 1 then raise exception 'Le fasi si superano una alla volta'; end if;

  if i_a > i_da then
    v_stato := public.gestionale_stato_pratica(p_progetto);
    if p_fase = 'progettazione' then
      if not (v_stato ->> 'incarico_ok')::boolean then v_mancanti := array_append(v_mancanti, 'contratto firmato o ordine di lavoro confermato'::text); end if;
      if not (v_stato ->> 'rp_rev_ok')::boolean then v_mancanti := array_append(v_mancanti, 'responsabile di pratica e revisore assegnati e diversi'::text); end if;
      if not (v_stato ->> 'au_escluso_ok')::boolean then v_mancanti := array_append(v_mancanti, 'per le domande di BLM in proprio, responsabile e revisore diversi dall''AU'::text); end if;
      if not (v_stato ->> 'motivazione_stesso_bando_ok')::boolean then v_mancanti := array_append(v_mancanti, 'motivazione: il revisore segue anche una pratica concorrente sullo stesso bando'::text); end if;
    elsif p_fase = 'invio' then
      if not (v_stato ->> 'checklist_ok')::boolean then v_mancanti := array_append(v_mancanti, 'checklist pre-invio confermata dal revisore, con tutte le voci verificate'::text); end if;
    elsif p_fase = 'inviata' then
      if not (v_stato ->> 'conferma_ok')::boolean then v_mancanti := array_append(v_mancanti, 'conferma scritta del cliente sulla versione finale'::text); end if;
      if not (v_stato ->> 'trasmissione_ok')::boolean then v_mancanti := array_append(v_mancanti, 'indicazione di chi trasmette la domanda'::text); end if;
      if not (v_stato ->> 'delega_ok')::boolean then v_mancanti := array_append(v_mancanti, 'delega del cliente (trasmette BLM)'::text); end if;
      if not (v_stato ->> 'ricevuta_ok')::boolean then v_mancanti := array_append(v_mancanti, 'ricevuta di invio'::text); end if;
    end if;

    if cardinality(v_mancanti) > 0 then
      if v_deroga is null or length(v_deroga) < 15 then
        raise exception 'Per passare alla fase successiva manca: %', array_to_string(v_mancanti, '; ')
          using errcode = 'P0001', hint = 'REQUISITI_MANCANTI';
      end if;
      if v_ruolo <> 'admin' then
        raise exception 'Solo un amministratore può derogare ai requisiti della pratica' using errcode = '42501';
      end if;
    else
      v_deroga := null;
    end if;
  end if;

  perform set_config('gestionale.cambio_fase', '1', true);
  update scadenze_bandi_progetti
     set fase = p_fase,
         data_invio = case when p_fase = 'inviata' then coalesce(data_invio, current_date) else data_invio end
   where id = p_progetto;
  perform set_config('gestionale.cambio_fase', '', true);

  insert into scadenze_bandi_pratica_passaggi (progetto_id, da_fase, a_fase, utente_id, deroga, mancanti)
  values (p_progetto, v_da, p_fase, v_autore, v_deroga,
          case when cardinality(v_mancanti) > 0 then to_jsonb(v_mancanti) else null end);

  -- Domande di BLM in proprio: comunicazione all'OdV prima dell'invio (PR.01 §4.2.6)
  if p_fase = 'invio' and exists (select 1 from scadenze_bandi_progetti where id = p_progetto and pratica_propria) then
    insert into scadenze_bandi_registro_operazioni (utente_id, utente_nome, canale, evento, tabella, record_id, descrizione)
    select v_autore, (select trim(nome || ' ' || cognome) from scadenze_bandi_utenti where id = v_autore),
           'server', 'segnalazione_odv', 'scadenze_bandi_progetti', p_progetto::text,
           'Domanda di BLM in proprio pronta per l''invio: ' || coalesce(titolo_progetto, '')
    from scadenze_bandi_progetti where id = p_progetto;
  end if;

  return jsonb_build_object('ok', true, 'fase', p_fase, 'deroga', v_deroga is not null);
end $fn$;

revoke all on function public.gestionale_cambia_fase(uuid, text, text) from public, anon, authenticated;
grant execute on function public.gestionale_cambia_fase(uuid, text, text) to service_role;

-- La fase si cambia solo dalla funzione (le pratiche nuove possono nascere già inviate)
create or replace function public.gestionale_protegge_fase()
returns trigger language plpgsql as $fn$
begin
  if new.fase is distinct from old.fase
     and coalesce(current_setting('gestionale.cambio_fase', true), '') <> '1'
     and public.gestionale_autore() is not null then
    raise exception 'La fase della pratica si cambia dal percorso della pratica';
  end if;
  return new;
end $fn$;
drop trigger if exists trg_protegge_fase on public.scadenze_bandi_progetti;
create trigger trg_protegge_fase before update on public.scadenze_bandi_progetti
  for each row execute function public.gestionale_protegge_fase();

-- Pratiche registrate direttamente in una fase successiva (per esempio già inviate): restano in cronologia
create or replace function public.gestionale_passaggio_iniziale()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if new.fase <> 'incarico' then
    insert into scadenze_bandi_pratica_passaggi (progetto_id, da_fase, a_fase, utente_id, note)
    values (new.id, null, new.fase, public.gestionale_autore(), 'Pratica registrata direttamente in questa fase');
  end if;
  return new;
end $fn$;
drop trigger if exists trg_passaggio_iniziale on public.scadenze_bandi_progetti;
create trigger trg_passaggio_iniziale after insert on public.scadenze_bandi_progetti
  for each row execute function public.gestionale_passaggio_iniziale();
