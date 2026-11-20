-- Annulla 20261120_fase4_c2_odv.sql (torna alla versione di 20261120_accesso_a_termine_e_backup.sql)
create or replace function public.gestionale_utente_id()
returns uuid language sql stable security definer set search_path to 'public' as $fn$
  select u.id from public.scadenze_bandi_utenti u
  where coalesce(auth.jwt() ->> 'app', '') = 'gestionale_evolvi'
    and (auth.jwt() ->> 'sub') ~ '^[0-9a-fA-F-]{36}$'
    and u.id = (auth.jwt() ->> 'sub')::uuid
    and u.attivo = true
    and (u.accesso_fino_al is null or u.accesso_fino_al >= (now() at time zone 'Europe/Rome')::date)
$fn$;
