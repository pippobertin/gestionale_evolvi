-- =============================================================================
-- Fase 3, passaggio B: funzioni che leggono il "badge" del gestionale
--
-- Restituiscono l'utente del gestionale solo se la richiesta porta un token
-- rilasciato dal gestionale (claim app = 'gestionale_evolvi') per un utente
-- esistente e attivo. Gli utenti Supabase Auth delle altre applicazioni del
-- progetto (ruolo "authenticated") NON vengono riconosciuti.
-- Aggiunta pura: nessuna regola le usa ancora (verranno usate nel passaggio D).
-- =============================================================================

create or replace function public.gestionale_utente_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.scadenze_bandi_utenti u
  where coalesce(auth.jwt() ->> 'app', '') = 'gestionale_evolvi'
    and (auth.jwt() ->> 'sub') ~ '^[0-9a-fA-F-]{36}$'
    and u.id = (auth.jwt() ->> 'sub')::uuid
    and u.attivo = true
$$;

create or replace function public.gestionale_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.scadenze_bandi_utenti u
    where u.id = public.gestionale_utente_id()
      and u.livello_permessi = 'admin'
  )
$$;

revoke all on function public.gestionale_utente_id() from public;
revoke all on function public.gestionale_is_admin() from public;
grant execute on function public.gestionale_utente_id() to anon, authenticated, service_role;
grant execute on function public.gestionale_is_admin() to anon, authenticated, service_role;

comment on function public.gestionale_utente_id() is 'Fase 3: id dell''utente del gestionale che ha rilasciato il badge (null se assente, non valido, di altra app o utente non attivo)';
comment on function public.gestionale_is_admin() is 'Fase 3: true se il badge appartiene a un amministratore attivo del gestionale';
