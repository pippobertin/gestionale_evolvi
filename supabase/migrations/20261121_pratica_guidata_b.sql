-- =============================================================================
-- Pratica di finanza agevolata guidata, passaggio B (Modello 231, PR.01 §4.2-4.3)
--
-- 1. Integrazioni richieste dall'ente, con scadenza: la risposta la prepara una
--    persona e la verifica un'altra (controllo a quattro occhi) prima dell'invio.
-- 2. Rendiconti (anticipo, SAL, saldo): dichiarazione del cliente sul cumulo,
--    checklist del responsabile di pratica e del revisore, firma del cliente o
--    di un delegato BLM (con delega archiviata e AU informata), ricevuta.
-- 3. Rettifiche dopo l'invio: registrate con la modalità formale (portale o
--    PEC) e segnalate all'OdV e all'AU nel registro attività.
-- 4. Scadenze superate di integrazioni e rendiconti: segnalate ad AU e OdV nel
--    registro dal controllo giornaliero (gestionale_segnala_ritardi).
-- Un amministratore può derogare ai requisiti dell'invio con motivazione.
-- Annullamento: 20261121_pratica_guidata_b_ROLLBACK.sql
-- =============================================================================

create table if not exists public.scadenze_bandi_integrazioni (
  id uuid primary key default gen_random_uuid(),
  progetto_id uuid not null references public.scadenze_bandi_progetti(id) on delete cascade,
  cliente_id uuid references public.scadenze_bandi_clienti(id) on delete cascade,
  data_richiesta date not null,
  ente text not null,
  oggetto text not null,
  scadenza date not null,
  richiesta_file_id text,
  richiesta_file_url text,
  preparata_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  preparata_il timestamptz,
  verificata_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  verificata_il timestamptz,
  data_invio date,
  ricevuta_file_id text,
  ricevuta_file_url text,
  deroga text,
  segnalato_ritardo_il timestamptz,
  note text,
  registrata_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_integrazioni_progetto on public.scadenze_bandi_integrazioni (progetto_id, scadenza);

create table if not exists public.scadenze_bandi_rendiconti (
  id uuid primary key default gen_random_uuid(),
  progetto_id uuid not null references public.scadenze_bandi_progetti(id) on delete cascade,
  cliente_id uuid references public.scadenze_bandi_clienti(id) on delete cascade,
  descrizione text not null,
  scadenza date not null,
  cumulo_data date,
  cumulo_file_id text,
  cumulo_file_url text,
  checklist_rp jsonb,
  checklist_rp_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  checklist_rp_il timestamptz,
  checklist_rev jsonb,
  checklist_rev_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  checklist_rev_il timestamptz,
  firmatario text check (firmatario in ('cliente', 'delegato_blm')),
  delega_file_id text,
  delega_file_url text,
  au_informata boolean not null default false,
  data_invio date,
  ricevuta_file_id text,
  ricevuta_file_url text,
  deroga text,
  segnalato_ritardo_il timestamptz,
  note text,
  registrato_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rendiconti_progetto on public.scadenze_bandi_rendiconti (progetto_id, scadenza);

create table if not exists public.scadenze_bandi_rettifiche (
  id uuid primary key default gen_random_uuid(),
  progetto_id uuid not null references public.scadenze_bandi_progetti(id) on delete cascade,
  cliente_id uuid references public.scadenze_bandi_clienti(id) on delete cascade,
  data_rilevazione date not null,
  errore text not null,
  modalita text not null check (modalita in ('portale', 'pec')),
  data_rettifica date,
  allegato_file_id text,
  allegato_file_url text,
  registrata_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_rettifiche_progetto on public.scadenze_bandi_rettifiche (progetto_id, data_rilevazione desc);

insert into public.scadenze_bandi_checklist_voci (tipo, chiave, etichetta, ordine) values
  ('checklist_rendicontazione', 'spese', 'Spese ammissibili, nel periodo, quietanzate e riconducibili al progetto', 10),
  ('checklist_rendicontazione', 'documenti', 'Nessun documento di spesa con diciture anomale o più voci non giustificate', 20),
  ('checklist_rendicontazione', 'attivita', 'Attività e indicatori riscontrati su relazioni, timesheet, registri e materiali', 30)
on conflict (tipo, chiave) do nothing;

-- Protezione e registro come le altre tabelle del gestionale
do $do$
declare t text;
begin
  foreach t in array array['scadenze_bandi_integrazioni', 'scadenze_bandi_rendiconti', 'scadenze_bandi_rettifiche'] loop
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

-- Integrazioni: quattro occhi prima dell'invio ---------------------------------------
create or replace function public.gestionale_controlla_integrazione()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_autore uuid := public.gestionale_autore();
begin
  if v_autore is null then return new; end if;
  if new.verificata_da is distinct from old.verificata_da and new.verificata_da is not null then
    if new.preparata_da is null then
      raise exception 'Prima di verificarla, la risposta va segnata come preparata';
    end if;
    if new.verificata_da = new.preparata_da then
      raise exception 'La risposta la verifica una persona diversa da chi l''ha preparata (controllo a quattro occhi)'
        using errcode = '42501';
    end if;
  end if;
  if new.data_invio is not null and old.data_invio is null then
    if new.verificata_da is null then
      if length(trim(coalesce(new.deroga, ''))) < 15 or public.gestionale_ruolo(v_autore) <> 'admin' then
        raise exception 'La risposta all''integrazione si invia solo dopo la verifica di una seconda persona'
          using hint = 'REQUISITI_MANCANTI';
      end if;
    end if;
    if new.ricevuta_file_id is null and new.ricevuta_file_url is null and length(trim(coalesce(new.deroga, ''))) < 15 then
      raise exception 'Allega la ricevuta dell''invio della risposta' using hint = 'REQUISITI_MANCANTI';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $fn$;
drop trigger if exists trg_controlla_integrazione on public.scadenze_bandi_integrazioni;
create trigger trg_controlla_integrazione before update on public.scadenze_bandi_integrazioni
  for each row execute function public.gestionale_controlla_integrazione();

-- Rendiconti: checklist di RP e REV, cumulo, firma, ricevuta ------------------------------
create or replace function public.gestionale_controlla_rendiconto()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_autore uuid := public.gestionale_autore();
  v_rp uuid; v_rev uuid;
  v_mancanti text[] := '{}';
  v_tutte_ok boolean;
begin
  if v_autore is null then return new; end if;
  select rp_id, rev_id into v_rp, v_rev from scadenze_bandi_progetti where id = new.progetto_id;

  if new.checklist_rp is distinct from old.checklist_rp and new.checklist_rp is not null then
    if v_rp is null or v_autore <> v_rp then
      raise exception 'La checklist del responsabile di pratica può confermarla solo il responsabile (RP)' using errcode = '42501';
    end if;
    new.checklist_rp_da := v_autore; new.checklist_rp_il := now();
  end if;
  if new.checklist_rev is distinct from old.checklist_rev and new.checklist_rev is not null then
    if v_rev is null or v_autore <> v_rev then
      raise exception 'La checklist del revisore può confermarla solo il revisore (REV)' using errcode = '42501';
    end if;
    new.checklist_rev_da := v_autore; new.checklist_rev_il := now();
  end if;

  if new.data_invio is not null and old.data_invio is null then
    if new.cumulo_file_id is null and new.cumulo_file_url is null then
      v_mancanti := array_append(v_mancanti, 'dichiarazione del cliente sugli altri contributi e sul cumulo'::text);
    end if;
    select not exists (select 1 from jsonb_array_elements(coalesce(new.checklist_rp, '[]'::jsonb)) e
                       where coalesce((e ->> 'ok')::boolean, false) = false)
           and new.checklist_rp is not null into v_tutte_ok;
    if not coalesce(v_tutte_ok, false) then v_mancanti := array_append(v_mancanti, 'checklist del responsabile di pratica con tutte le voci verificate'::text); end if;
    select not exists (select 1 from jsonb_array_elements(coalesce(new.checklist_rev, '[]'::jsonb)) e
                       where coalesce((e ->> 'ok')::boolean, false) = false)
           and new.checklist_rev is not null into v_tutte_ok;
    if not coalesce(v_tutte_ok, false) then v_mancanti := array_append(v_mancanti, 'checklist del revisore con tutte le voci verificate'::text); end if;
    if new.firmatario is null then
      v_mancanti := array_append(v_mancanti, 'indicazione di chi firma il rendiconto'::text);
    elsif new.firmatario = 'delegato_blm' and ((new.delega_file_id is null and new.delega_file_url is null) or not new.au_informata) then
      v_mancanti := array_append(v_mancanti, 'delega archiviata e AU informata (firma un delegato BLM)'::text);
    end if;
    if new.ricevuta_file_id is null and new.ricevuta_file_url is null then
      v_mancanti := array_append(v_mancanti, 'ricevuta di invio'::text);
    end if;
    if cardinality(v_mancanti) > 0 then
      if length(trim(coalesce(new.deroga, ''))) < 15 or public.gestionale_ruolo(v_autore) <> 'admin' then
        raise exception 'Per registrare l''invio del rendiconto manca: %', array_to_string(v_mancanti, '; ')
          using hint = 'REQUISITI_MANCANTI';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $fn$;
drop trigger if exists trg_controlla_rendiconto on public.scadenze_bandi_rendiconti;
create trigger trg_controlla_rendiconto before update on public.scadenze_bandi_rendiconti
  for each row execute function public.gestionale_controlla_rendiconto();

-- Rettifiche: segnalazione all'OdV e all'AU nel registro --------------------------------
create or replace function public.gestionale_segnala_rettifica()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  insert into scadenze_bandi_registro_operazioni (utente_id, utente_nome, canale, evento, tabella, record_id, cliente_id, descrizione)
  select new.registrata_da, (select trim(nome || ' ' || cognome) from scadenze_bandi_utenti where id = new.registrata_da),
         'server', 'segnalazione_odv', 'scadenze_bandi_rettifiche', new.id::text, new.cliente_id,
         'Rettifica dopo l''invio (' || coalesce(p.titolo_progetto, '') || '): ' || left(new.errore, 200)
  from scadenze_bandi_progetti p where p.id = new.progetto_id;
  return new;
end $fn$;
drop trigger if exists trg_segnala_rettifica on public.scadenze_bandi_rettifiche;
create trigger trg_segnala_rettifica after insert on public.scadenze_bandi_rettifiche
  for each row execute function public.gestionale_segnala_rettifica();

-- Scadenze superate: segnalazione ad AU e OdV (una volta per scadenza) -------------------
create or replace function public.gestionale_segnala_ritardi()
returns integer language plpgsql security definer set search_path to 'public' as $fn$
declare
  oggi date := (now() at time zone 'Europe/Rome')::date;
  n integer := 0;
  r record;
begin
  for r in
    select i.id, i.cliente_id, i.oggetto, i.scadenza, p.titolo_progetto
    from scadenze_bandi_integrazioni i join scadenze_bandi_progetti p on p.id = i.progetto_id
    where i.data_invio is null and i.scadenza < oggi and i.segnalato_ritardo_il is null
  loop
    insert into scadenze_bandi_registro_operazioni (canale, evento, tabella, record_id, cliente_id, descrizione)
    values ('sistema', 'segnalazione_odv', 'scadenze_bandi_integrazioni', r.id::text, r.cliente_id,
            format('Scadenza superata senza risposta all''integrazione (%s, scadenza %s): %s',
                   coalesce(r.titolo_progetto, ''), to_char(r.scadenza, 'DD/MM/YYYY'), left(r.oggetto, 150)));
    update scadenze_bandi_integrazioni set segnalato_ritardo_il = now() where id = r.id;
    n := n + 1;
  end loop;
  for r in
    select d.id, d.cliente_id, d.descrizione, d.scadenza, p.titolo_progetto
    from scadenze_bandi_rendiconti d join scadenze_bandi_progetti p on p.id = d.progetto_id
    where d.data_invio is null and d.scadenza < oggi and d.segnalato_ritardo_il is null
  loop
    insert into scadenze_bandi_registro_operazioni (canale, evento, tabella, record_id, cliente_id, descrizione)
    values ('sistema', 'segnalazione_odv', 'scadenze_bandi_rendiconti', r.id::text, r.cliente_id,
            format('Scadenza di rendicontazione superata (%s, %s, scadenza %s)',
                   coalesce(r.titolo_progetto, ''), r.descrizione, to_char(r.scadenza, 'DD/MM/YYYY')));
    update scadenze_bandi_rendiconti set segnalato_ritardo_il = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $fn$;
revoke all on function public.gestionale_segnala_ritardi() from public, anon, authenticated;
grant execute on function public.gestionale_segnala_ritardi() to service_role;
