-- Annulla 20261120_accesso_a_termine_e_backup.sql
drop function if exists public.gestionale_backup_tabelle();
drop table if exists public.scadenze_bandi_backup_registro;

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
$fn$;

alter table public.scadenze_bandi_utenti drop column if exists accesso_fino_al;
