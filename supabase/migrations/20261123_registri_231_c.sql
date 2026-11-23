-- =============================================================================
-- Registri del Modello 231, passaggio 3
--
-- 1. Segnalatori (PR.02 §4.3, PR.06 §4.1, gap G12): anagrafica con qualifica
--    (M.01), accordo scritto con clausola 231 (M.03) approvato dall'AU, compenso
--    previsto. Compensi: prestazione attestata prima del pagamento, pagamento
--    autorizzato dall'AU (da un altro amministratore se ha attestato l'AU), mai
--    senza accordo approvato e qualifica valida; pagamento registrato.
-- 2. Registro delle deroghe (PR.01 §4.1, PR.02 §4.3): deroghe alle condizioni
--    standard approvate per iscritto dall'AU. Il registro mostra anche quelle
--    già registrate dal gestionale (contratti, fasi, integrazioni, rendiconti).
-- Annullamento: 20261123_registri_231_c_ROLLBACK.sql
-- =============================================================================

create table if not exists public.scadenze_bandi_segnalatori (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  forma text not null default 'persona' check (forma in ('societa', 'persona')),
  cliente_id uuid references public.scadenze_bandi_clienti(id) on delete set null,
  codice_fiscale text,
  partita_iva text,
  email text,
  qualifica_id uuid references public.scadenze_bandi_qualifiche(id) on delete set null,
  accordo_data date,
  accordo_scade_il date,
  clausola_231 boolean not null default false,
  compenso_previsto text,
  accordo_allegati jsonb not null default '[]',
  accordo_approvato_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  accordo_approvato_il timestamptz,
  cessato_il date,
  nota text,
  registrato_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scadenze_bandi_compensi_segnalatori (
  id uuid primary key default gen_random_uuid(),
  segnalatore_id uuid not null references public.scadenze_bandi_segnalatori(id) on delete restrict,
  cliente_id uuid references public.scadenze_bandi_clienti(id) on delete set null,
  progetto_id uuid references public.scadenze_bandi_progetti(id) on delete set null,
  data_segnalazione date,
  descrizione text not null,          -- che cosa ha fatto il segnalatore
  importo numeric(12, 2),
  base_calcolo text,
  attestazione text,                   -- prova della prestazione
  attestazione_allegati jsonb not null default '[]',
  attestata_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  attestata_il timestamptz,
  fattura_numero text,
  fattura_data date,
  autorizzato_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  autorizzato_il timestamptz,
  pagato_il date,
  pagamento_riferimento text,
  registrato_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_compensi_segnalatore on public.scadenze_bandi_compensi_segnalatori (segnalatore_id);

create table if not exists public.scadenze_bandi_deroghe (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  ambito text not null check (ambito in ('contratto', 'pagamento', 'procedura', 'altro')),
  oggetto text not null,
  regola text,                         -- che cosa prevede la regola
  motivazione text not null,
  cliente_id uuid references public.scadenze_bandi_clienti(id) on delete set null,
  progetto_id uuid references public.scadenze_bandi_progetti(id) on delete set null,
  allegati jsonb not null default '[]',
  richiesta_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  decisione text check (decisione in ('approvata', 'respinta')),
  decisione_nota text,
  decisa_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  decisa_il timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_deroghe_data on public.scadenze_bandi_deroghe (data desc);

do $do$
declare t text;
begin
  foreach t in array array['scadenze_bandi_segnalatori', 'scadenze_bandi_compensi_segnalatori', 'scadenze_bandi_deroghe'] loop
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

insert into public.scadenze_bandi_permessi_catalogo (chiave, etichetta, descrizione, ordine) values
  ('segnalatori.gestisci', 'Gestire segnalatori e compensi',
   'Anagrafica e accordi dei segnalatori, segnalazioni, attestazione della prestazione e registrazione dei pagamenti (l''accordo e il pagamento li autorizza l''AU)', 87)
on conflict (chiave) do update set etichetta = excluded.etichetta, descrizione = excluded.descrizione, ordine = excluded.ordine;
insert into public.scadenze_bandi_permessi_ruolo (ruolo, permesso, consentito) values
  ('collaboratore', 'segnalatori.gestisci', false),
  ('collaboratore_limitato', 'segnalatori.gestisci', false)
on conflict do nothing;

-- Regole dei segnalatori e dei compensi ------------------------------------------
create or replace function public.gestionale_controlla_segnalatori()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_autore uuid := public.gestionale_autore();
  v_s record; v_q record;
begin
  new.updated_at := now();
  if tg_table_name = 'scadenze_bandi_segnalatori' then
    if tg_op = 'UPDATE' and old.accordo_approvato_da is not null
       and (new.accordo_data, new.accordo_scade_il, new.clausola_231, new.compenso_previsto, new.accordo_allegati)
           is distinct from (old.accordo_data, old.accordo_scade_il, old.clausola_231, old.compenso_previsto, old.accordo_allegati)
       and new.accordo_approvato_da is not distinct from old.accordo_approvato_da then
      -- accordo cambiato dopo l'approvazione: va approvato di nuovo
      new.accordo_approvato_da := null; new.accordo_approvato_il := null;
    end if;
    if new.accordo_approvato_da is not null and (tg_op = 'INSERT' or old.accordo_approvato_da is null) then
      if v_autore is not null and not public.gestionale_puo_decidere_231(v_autore) then
        raise exception 'L''accordo con il segnalatore lo approva l''AU' using errcode = '42501';
      end if;
      if new.accordo_data is null or not new.clausola_231 or jsonb_array_length(new.accordo_allegati) = 0 then
        raise exception 'Per approvare servono l''accordo firmato, la sua data e la clausola 231';
      end if;
      new.accordo_approvato_da := coalesce(v_autore, new.accordo_approvato_da); new.accordo_approvato_il := now();
    end if;
    return new;
  end if;

  -- Compensi
  if tg_op = 'UPDATE' and old.autorizzato_da is not null
     and (new.importo, new.descrizione, new.attestazione, new.attestata_da, new.fattura_numero, new.segnalatore_id)
         is distinct from (old.importo, old.descrizione, old.attestazione, old.attestata_da, old.fattura_numero, old.segnalatore_id) then
    raise exception 'Il pagamento è già autorizzato: importo, prestazione e fattura non si modificano più';
  end if;
  if new.attestata_da is not null and (tg_op = 'INSERT' or old.attestata_da is null) then
    if coalesce(trim(new.attestazione), '') = '' then
      raise exception 'Descrivi come risulta resa la prestazione';
    end if;
    new.attestata_da := coalesce(v_autore, new.attestata_da); new.attestata_il := now();
  end if;
  if new.autorizzato_da is not null and (tg_op = 'INSERT' or old.autorizzato_da is null) then
    if new.attestata_da is null then
      raise exception 'Prima del pagamento la prestazione va attestata';
    end if;
    if v_autore is not null and not public.gestionale_puo_decidere_231(v_autore, new.attestata_da) then
      raise exception 'Il pagamento lo autorizza l''AU, mai chi ha attestato la prestazione (se ha attestato l''AU, un altro amministratore)' using errcode = '42501';
    end if;
    if new.importo is null or coalesce(trim(new.fattura_numero), '') = '' then
      raise exception 'Per autorizzare il pagamento servono importo e fattura del segnalatore';
    end if;
    select * into v_s from scadenze_bandi_segnalatori where id = new.segnalatore_id;
    if v_s.accordo_approvato_da is null then
      raise exception 'L''accordo con il segnalatore non è approvato dall''AU';
    end if;
    if v_s.accordo_scade_il is not null and v_s.accordo_scade_il < coalesce(new.data_segnalazione, current_date) then
      raise exception 'La segnalazione è successiva alla scadenza dell''accordo';
    end if;
    select * into v_q from scadenze_bandi_qualifiche where id = v_s.qualifica_id;
    if v_q.id is null or not (v_q.esito = 'nessuna_anomalia' or v_q.decisione in ('procedere', 'procedere_cautele'))
       or (v_q.scade_il is not null and v_q.scade_il < current_date) then
      raise exception 'Il segnalatore non ha una qualifica valida (M.01): va compilata o rinnovata';
    end if;
    new.autorizzato_da := coalesce(v_autore, new.autorizzato_da); new.autorizzato_il := now();
  end if;
  if new.pagato_il is not null and new.autorizzato_da is null then
    raise exception 'Il pagamento si registra solo dopo l''autorizzazione';
  end if;
  return new;
end $fn$;

drop trigger if exists trg_regole_segnalatori on public.scadenze_bandi_segnalatori;
create trigger trg_regole_segnalatori before insert or update on public.scadenze_bandi_segnalatori
  for each row execute function public.gestionale_controlla_segnalatori();
drop trigger if exists trg_regole_segnalatori on public.scadenze_bandi_compensi_segnalatori;
create trigger trg_regole_segnalatori before insert or update on public.scadenze_bandi_compensi_segnalatori
  for each row execute function public.gestionale_controlla_segnalatori();

-- Regole delle deroghe -----------------------------------------------------------
create or replace function public.gestionale_controlla_deroghe()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_autore uuid := public.gestionale_autore();
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and old.decisione is not null then
    raise exception 'La deroga è già decisa e non si modifica più: se serve se ne registra una nuova';
  end if;
  if new.decisione is not null then
    if v_autore is not null and not public.gestionale_puo_decidere_231(v_autore, new.richiesta_da) then
      raise exception 'Le deroghe le decide l''AU, mai chi le chiede (se le chiede l''AU, un altro amministratore)' using errcode = '42501';
    end if;
    new.decisa_da := coalesce(v_autore, new.decisa_da); new.decisa_il := now();
  end if;
  return new;
end $fn$;
drop trigger if exists trg_regole_deroghe on public.scadenze_bandi_deroghe;
create trigger trg_regole_deroghe before insert or update on public.scadenze_bandi_deroghe
  for each row execute function public.gestionale_controlla_deroghe();
