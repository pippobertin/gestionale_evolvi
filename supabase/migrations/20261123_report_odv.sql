-- =============================================================================
-- Report semestrale all'Organismo di Vigilanza (modulo M.05, risposta 5 del
-- consulente). Un report per semestre, precompilato con i dati dei registri;
-- ogni responsabile completa e conferma la propria sezione, l'AU lo invia.
-- Inviato, non si modifica più e resta su Drive in PDF; l'OdV vede solo i
-- report inviati.
-- Annullamento: 20261123_report_odv_ROLLBACK.sql
-- =============================================================================

create table if not exists public.scadenze_bandi_report_odv (
  id uuid primary key default gen_random_uuid(),
  anno integer not null,
  semestre smallint not null check (semestre in (1, 2)),
  periodo_dal date not null,
  periodo_al date not null,
  scadenza date not null,
  sezioni jsonb not null,
  dati_aggiornati_il timestamptz,
  inviato_il timestamptz,
  inviato_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  pdf jsonb,
  creato_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (anno, semestre)
);

alter table public.scadenze_bandi_report_odv enable row level security;
revoke all on public.scadenze_bandi_report_odv from anon, authenticated;
drop trigger if exists trg_registro_operazioni on public.scadenze_bandi_report_odv;
create trigger trg_registro_operazioni after insert or update or delete on public.scadenze_bandi_report_odv
  for each row execute function public.gestionale_registra_operazione();
drop trigger if exists trg_controlla_permesso on public.scadenze_bandi_report_odv;
create trigger trg_controlla_permesso before insert or update or delete on public.scadenze_bandi_report_odv
  for each row execute function public.gestionale_controlla_permesso();

create or replace function public.gestionale_controlla_report_odv()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_autore uuid := public.gestionale_autore(); k text;
begin
  if tg_op = 'DELETE' then
    if old.inviato_il is not null then
      raise exception 'Il report è già stato inviato all''OdV e non si elimina';
    end if;
    return old;
  end if;
  if old.inviato_il is not null then
    raise exception 'Il report è già stato inviato all''OdV e non si modifica più';
  end if;
  new.updated_at := now();
  if new.inviato_il is not null then
    if v_autore is not null and not public.gestionale_puo_decidere_231(v_autore) then
      raise exception 'Il report lo invia l''AU' using errcode = '42501';
    end if;
    for k in select jsonb_object_keys(new.sezioni) loop
      if (new.sezioni -> k ->> 'confermata_il') is null then
        raise exception 'Prima dell''invio ogni sezione va confermata dal suo responsabile';
      end if;
    end loop;
    new.inviato_da := coalesce(v_autore, new.inviato_da);
  end if;
  return new;
end $fn$;
drop trigger if exists trg_regole_report_odv on public.scadenze_bandi_report_odv;
create trigger trg_regole_report_odv before update or delete on public.scadenze_bandi_report_odv
  for each row execute function public.gestionale_controlla_report_odv();
