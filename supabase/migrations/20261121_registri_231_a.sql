-- =============================================================================
-- Registri del Modello 231, passaggio 1
--
-- 1. Qualifica delle controparti (modulo M.01, PR.06 §4.1, PR.02 §4.3): una
--    scheda per ogni nuovo cliente, partner, fornitore, consulente o
--    segnalatore, rinnovata ogni 12 mesi per i rapporti continuativi. Le
--    anomalie le decide per iscritto l'AU.
-- 2. Dichiarazioni degli interessi (modulo M.04, PR.02 §4.4): all'ingresso e
--    ogni anno; la valutazione è dell'AU (del RAP, cioè di un altro
--    amministratore, se la dichiarazione è dell'AU).
-- 3. Registro dei conflitti (PR.02 §4.4 e §4.5).
-- Le tabelle si leggono e scrivono solo dal server (API dedicate), che applica
-- chi vede che cosa: ognuno le proprie dichiarazioni, amministratori e OdV tutto.
-- Annullamento: 20261121_registri_231_a_ROLLBACK.sql
-- =============================================================================

create table if not exists public.scadenze_bandi_qualifiche (
  id uuid primary key default gen_random_uuid(),
  soggetto_tipo text not null check (soggetto_tipo in ('cliente', 'partner', 'fornitore', 'consulente', 'segnalatore')),
  forma text not null check (forma in ('societa', 'persona')),
  cliente_id uuid references public.scadenze_bandi_clienti(id) on delete set null,
  denominazione text not null,
  codice_fiscale text,
  partita_iva text,
  continuativo boolean not null default false,
  verifiche jsonb not null,            -- [{chiave, etichetta, fatto, data, nota}]
  allegati jsonb not null default '[]',-- [{nome, id, url}]
  esito text not null check (esito in ('nessuna_anomalia', 'anomalia')),
  anomalia text,
  decisione text check (decisione in ('procedere', 'procedere_cautele', 'non_procedere')),
  decisione_motivazione text,
  decisa_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  decisa_il timestamptz,
  compilata_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  compilata_il date not null default current_date,
  scade_il date,
  segnalato_scadenza_il timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_qualifiche_cliente on public.scadenze_bandi_qualifiche (cliente_id);
create index if not exists idx_qualifiche_scadenza on public.scadenze_bandi_qualifiche (scade_il);

insert into public.scadenze_bandi_checklist_voci (tipo, chiave, etichetta, ordine) values
  ('qualifica_societa', 'creditsafe', 'Report CreditSafe scaricato e salvato', 10),
  ('qualifica_societa', 'visura', 'Visura camerale salvata', 20),
  ('qualifica_societa', 'documento_lr', 'Documento d''identità del legale rappresentante salvato', 30),
  ('qualifica_societa', 'titolare_effettivo', 'Titolare effettivo individuato (da visura e report)', 40),
  ('qualifica_societa', 'liste_ue', 'Società, legale rappresentante e titolare effettivo controllati nelle liste UE delle sanzioni, con schermata salvata', 50),
  ('qualifica_persona', 'documento', 'Documento d''identità salvato', 10),
  ('qualifica_persona', 'partita_iva', 'Partita IVA verificata (Agenzia delle Entrate o VIES)', 20),
  ('qualifica_persona', 'albo', 'Iscrizione all''albo verificata, se prevista', 30),
  ('qualifica_persona', 'liste_ue', 'Nominativo controllato nelle liste UE delle sanzioni, con schermata salvata', 40),
  ('qualifica_persona', 'notizie', 'Ricerca di notizie pubbliche (nome e cognome con parole come indagine, condanna, frode)', 50),
  ('qualifica_persona', 'dsan', 'Dichiarazione di onorabilità e assenza di conflitti firmata (M.02)', 60),
  ('qualifica_persona', 'accordo_231', 'Solo segnalatori: accordo scritto con clausola 231 approvato dall''AU (M.03)', 70)
on conflict (tipo, chiave) do nothing;

create table if not exists public.scadenze_bandi_dichiarazioni_interessi (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references public.scadenze_bandi_utenti(id) on delete cascade,
  anno integer not null,
  tipo text not null check (tipo in ('prima', 'rinnovo', 'variazione')),
  sezioni jsonb not null,              -- {enti, clienti, attivita, omaggi: {nessuno, casi: [...]}, altro}
  impegno_accettato boolean not null,
  dichiarata_il timestamptz not null default now(),
  esito text check (esito in ('nessun_conflitto', 'conflitto_annotato')),
  nota_valutazione text,
  valutata_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  valutata_il timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_dichiarazioni_utente on public.scadenze_bandi_dichiarazioni_interessi (utente_id, anno desc);

create table if not exists public.scadenze_bandi_conflitti (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  persona_id uuid references public.scadenze_bandi_utenti(id) on delete set null,
  persona_esterna text,
  origine text not null check (origine in ('dichiarazione', 'stesso_bando', 'segnalazione', 'altro')),
  descrizione text not null,
  progetto_id uuid references public.scadenze_bandi_progetti(id) on delete set null,
  cliente_id uuid references public.scadenze_bandi_clienti(id) on delete set null,
  dichiarazione_id uuid references public.scadenze_bandi_dichiarazioni_interessi(id) on delete set null,
  misure text,
  decisione text,
  decisa_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  decisa_il timestamptz,
  registrato_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_conflitti_data on public.scadenze_bandi_conflitti (data desc);

-- Solo dal server: nessun accesso diretto dal browser; registro e permessi come le altre tabelle
do $do$
declare t text;
begin
  foreach t in array array['scadenze_bandi_qualifiche', 'scadenze_bandi_dichiarazioni_interessi', 'scadenze_bandi_conflitti'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop trigger if exists trg_registro_operazioni on public.%I', t);
    execute format('create trigger trg_registro_operazioni after insert or update or delete on public.%I
                    for each row execute function public.gestionale_registra_operazione()', t);
    execute format('drop trigger if exists trg_controlla_permesso on public.%I', t);
    execute format('create trigger trg_controlla_permesso before insert or update or delete on public.%I
                    for each row execute function public.gestionale_controlla_permesso()', t);
  end loop;
end $do$;

-- Chi decide: l'AU; se l'AU non è indicata, o se la dichiarazione è dell'AU, un altro amministratore
create or replace function public.gestionale_puo_decidere_231(p_utente uuid, p_interessato uuid default null)
returns boolean language plpgsql stable security definer set search_path to 'public' as $fn$
declare v_au uuid := nullif((select value from scadenze_bandi_system_settings where key = 'utente_au' limit 1), '')::uuid;
begin
  if p_utente is null then return false; end if;
  if p_interessato is not null and p_interessato = p_utente then return false; end if;  -- nessuno valuta sé stesso
  if v_au is not null and p_interessato is distinct from v_au then
    return p_utente = v_au;
  end if;
  return public.gestionale_ruolo(p_utente) = 'admin';
end $fn$;
revoke all on function public.gestionale_puo_decidere_231(uuid, uuid) from public, anon, authenticated;
grant execute on function public.gestionale_puo_decidere_231(uuid, uuid) to service_role;

create or replace function public.gestionale_controlla_decisioni_231()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_autore uuid := public.gestionale_autore();
begin
  if v_autore is null then return new; end if;
  if tg_table_name = 'scadenze_bandi_qualifiche' then
    if new.decisione is distinct from old.decisione then
      if not public.gestionale_puo_decidere_231(v_autore) then
        raise exception 'Le anomalie della qualifica le decide l''AU' using errcode = '42501';
      end if;
      new.decisa_da := v_autore; new.decisa_il := now();
    end if;
  elsif tg_table_name = 'scadenze_bandi_dichiarazioni_interessi' then
    if (new.sezioni is distinct from old.sezioni or new.tipo is distinct from old.tipo or new.utente_id is distinct from old.utente_id) then
      raise exception 'Una dichiarazione resa non si modifica: per i cambiamenti si presenta una variazione';
    end if;
    if new.esito is distinct from old.esito then
      if not public.gestionale_puo_decidere_231(v_autore, new.utente_id) then
        raise exception 'La dichiarazione la valuta l''AU (o un altro amministratore se è dell''AU)' using errcode = '42501';
      end if;
      new.valutata_da := v_autore; new.valutata_il := now();
    end if;
  elsif tg_table_name = 'scadenze_bandi_conflitti' then
    if new.decisione is distinct from old.decisione and new.decisione is not null then
      if not public.gestionale_puo_decidere_231(v_autore, new.persona_id) then
        raise exception 'Le decisioni sui conflitti le prende l''AU (o un altro amministratore se il conflitto riguarda l''AU)' using errcode = '42501';
      end if;
      new.decisa_da := v_autore; new.decisa_il := now();
    end if;
    new.updated_at := now();
  end if;
  if tg_table_name = 'scadenze_bandi_qualifiche' then new.updated_at := now(); end if;
  return new;
end $fn$;

drop trigger if exists trg_decisioni_231 on public.scadenze_bandi_qualifiche;
create trigger trg_decisioni_231 before update on public.scadenze_bandi_qualifiche
  for each row execute function public.gestionale_controlla_decisioni_231();
drop trigger if exists trg_decisioni_231 on public.scadenze_bandi_dichiarazioni_interessi;
create trigger trg_decisioni_231 before update on public.scadenze_bandi_dichiarazioni_interessi
  for each row execute function public.gestionale_controlla_decisioni_231();
drop trigger if exists trg_decisioni_231 on public.scadenze_bandi_conflitti;
create trigger trg_decisioni_231 before update on public.scadenze_bandi_conflitti
  for each row execute function public.gestionale_controlla_decisioni_231();

-- Dichiarazione: ognuno la presenta per sé
create or replace function public.gestionale_dichiarazione_propria()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_autore uuid := public.gestionale_autore();
begin
  if v_autore is not null and new.utente_id <> v_autore then
    raise exception 'La dichiarazione degli interessi la presenta ciascuno per sé' using errcode = '42501';
  end if;
  return new;
end $fn$;
drop trigger if exists trg_dichiarazione_propria on public.scadenze_bandi_dichiarazioni_interessi;
create trigger trg_dichiarazione_propria before insert on public.scadenze_bandi_dichiarazioni_interessi
  for each row execute function public.gestionale_dichiarazione_propria();
