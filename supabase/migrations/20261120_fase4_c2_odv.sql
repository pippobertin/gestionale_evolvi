-- =============================================================================
-- Fase 4, passaggio C2: OdV in sola lettura dei registri
--
-- L'OdV non accede alle tabelle del gestionale dal browser: per il database il
-- suo badge non identifica un utente operativo (gestionale_utente_id restituisce
-- null), quindi ogni regola di accesso lo esclude. I registri gli arrivano solo
-- dal server, attraverso le API dedicate (registro attività, backup).
-- Annullamento: 20261120_fase4_c2_odv_ROLLBACK.sql
-- =============================================================================
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
    and u.livello_permessi <> 'odv'
$fn$;
