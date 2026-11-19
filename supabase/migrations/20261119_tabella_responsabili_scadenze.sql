-- =============================================================================
-- Tabella dei responsabili delle scadenze (19/11/2026)
--
-- Il form delle scadenze (ScadenzaForm) e l'elenco (ScadenzeContent) leggono e
-- scrivono scadenze_bandi_responsabili_scadenze, che nel database non è mai
-- stata creata: scegliendo un responsabile la scadenza veniva salvata, ma poi
-- il form segnalava "Errore nel salvataggio", non creava l'evento in calendario
-- e restava aperto (con il rischio di salvare due volte la stessa scadenza).
-- Si crea la tabella con le colonne che il codice già usa, protetta dal badge
-- del gestionale come le altre.
-- Annullamento: 20261119_tabella_responsabili_scadenze_ROLLBACK.sql
-- =============================================================================
create table public.scadenze_bandi_responsabili_scadenze (
  id uuid primary key default gen_random_uuid(),
  scadenza_id uuid not null references public.scadenze_bandi_scadenze(id) on delete cascade,
  tipo_responsabile text not null check (tipo_responsabile in ('utente', 'gruppo', 'tutti')),
  utente_id uuid references public.scadenze_bandi_utenti(id) on delete set null,
  gruppo_id uuid references public.scadenze_bandi_gruppi_utenti(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_responsabili_scadenze_scadenza on public.scadenze_bandi_responsabili_scadenze (scadenza_id);
create index idx_responsabili_scadenze_utente on public.scadenze_bandi_responsabili_scadenze (utente_id);
create index idx_responsabili_scadenze_gruppo on public.scadenze_bandi_responsabili_scadenze (gruppo_id);

alter table public.scadenze_bandi_responsabili_scadenze enable row level security;
revoke all on public.scadenze_bandi_responsabili_scadenze from anon;
grant select, insert, update, delete on public.scadenze_bandi_responsabili_scadenze to authenticated;
create policy gestionale_accesso on public.scadenze_bandi_responsabili_scadenze for all to authenticated
  using ((select public.gestionale_utente_id()) is not null)
  with check ((select public.gestionale_utente_id()) is not null);

-- PostgREST rilegge lo schema per esporre subito la nuova tabella
notify pgrst, 'reload schema';
