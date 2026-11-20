-- =============================================================================
-- Modello 231, punto 1: utenti con accesso a termine ed esportazione mensile
--
-- 1. scadenze_bandi_utenti.accesso_fino_al: ultimo giorno (ora italiana) in cui
--    l'utente può entrare. Vuoto = nessuna scadenza. Serve per tirocinanti e
--    collaboratori esterni: il giorno dopo l'accesso cessa da solo, sia nel
--    server sia nel database (gestionale_utente_id).
-- 2. scadenze_bandi_backup_registro: registro delle esportazioni mensili e delle
--    prove di ripristino (data, chi, cosa, esito), come chiesto dal consulente.
-- 3. gestionale_backup_tabelle(): elenco delle tabelle da esportare con colonne
--    e chiave primaria, usabile solo dal server (service_role).
-- Annullamento: 20261120_accesso_a_termine_e_backup_ROLLBACK.sql
-- =============================================================================

-- 1. Accesso a termine --------------------------------------------------------
alter table public.scadenze_bandi_utenti
  add column if not exists accesso_fino_al date;

comment on column public.scadenze_bandi_utenti.accesso_fino_al is
  'Ultimo giorno di accesso (ora italiana). NULL = senza scadenza.';

create or replace function public.gestionale_utente_id()
returns uuid
language sql
stable security definer
set search_path to 'public'
as $fn$
  select u.id
  from public.scadenze_bandi_utenti u
  where coalesce(auth.jwt() ->> 'app', '') = 'gestionale_evolvi'
    and (auth.jwt() ->> 'sub') ~ '^[0-9a-fA-F-]{36}$'
    and u.id = (auth.jwt() ->> 'sub')::uuid
    and u.attivo = true
    and (u.accesso_fino_al is null
         or u.accesso_fino_al >= (now() at time zone 'Europe/Rome')::date)
$fn$;

-- 2. Registro backup e prove di ripristino ------------------------------------
create table if not exists public.scadenze_bandi_backup_registro (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('esportazione', 'prova_ripristino')),
  eseguito_il timestamptz not null default now(),
  eseguito_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  origine text check (origine in ('automatica', 'manuale')),
  esito text not null check (esito in ('ok', 'errore', 'parziale')),
  -- esportazione
  file_nome text,
  file_drive_id text,
  dimensione_byte bigint,
  sha256 text,
  conteggi jsonb,
  -- prova di ripristino
  backup_id uuid references public.scadenze_bandi_backup_registro(id) on delete set null,
  cosa text,
  note text,
  errore text,
  created_at timestamptz not null default now()
);

create index if not exists idx_backup_registro_data
  on public.scadenze_bandi_backup_registro (tipo, eseguito_il desc);

alter table public.scadenze_bandi_backup_registro enable row level security;

drop policy if exists gestionale_backup_lettura on public.scadenze_bandi_backup_registro;
create policy gestionale_backup_lettura on public.scadenze_bandi_backup_registro
  for select
  using ((select public.gestionale_is_admin()));

-- 3. Elenco tabelle per l'esportazione ----------------------------------------
create or replace function public.gestionale_backup_tabelle()
returns table (tabella text, colonne text[], chiave text[])
language sql
stable security definer
set search_path to 'public'
as $fn$
  select
    t.table_name::text,
    array_agg(c.column_name::text order by c.ordinal_position),
    coalesce((
      select array_agg(a.attname::text order by array_position(i.indkey, a.attnum))
      from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = ('public.' || quote_ident(t.table_name))::regclass
        and i.indisprimary
    ), '{}')
  from information_schema.tables t
  join information_schema.columns c
    on c.table_schema = t.table_schema and c.table_name = t.table_name
  where t.table_schema = 'public'
    and t.table_type = 'BASE TABLE'
    and t.table_name like 'scadenze\_bandi\_%'
  group by t.table_name
  order by t.table_name
$fn$;

revoke all on function public.gestionale_backup_tabelle() from public, anon, authenticated;
grant execute on function public.gestionale_backup_tabelle() to service_role;
