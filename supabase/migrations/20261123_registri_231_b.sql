-- =============================================================================
-- Registri del Modello 231, passaggio 2
--
-- 1. Registro delle deleghe dei clienti (PR.03 §4.2, risposta 15 del
--    consulente): per cliente e piattaforma, mandato, titolare dell'accesso,
--    persone autorizzate, durata, revoca e riesame semestrale. Nessuna password:
--    le credenziali stanno nel password manager.
-- 2. Checklist di ingresso e di uscita del personale (modulo M.06, PR.10 §4.2,
--    PR.03 §4.1). Chi viene disattivato, o ha l'accesso scaduto, esce da solo
--    dagli elenchi delle persone autorizzate.
-- Annullamento: 20261123_registri_231_b_ROLLBACK.sql
-- =============================================================================

-- 1. Deleghe ---------------------------------------------------------------------
create table if not exists public.scadenze_bandi_deleghe (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.scadenze_bandi_clienti(id) on delete cascade,
  piattaforma text not null,
  ambito text,
  tipo text not null check (tipo in ('delega_piattaforma', 'mandato', 'procura')),
  titolare_id uuid references public.scadenze_bandi_utenti(id) on delete set null,
  titolare_esterno text,
  mandato_data date,
  valida_dal date,
  valida_al date,
  allegati jsonb not null default '[]',
  nota text,
  revocata_il date,
  revoca_motivo text,
  revocata_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  riesaminata_il date,
  riesaminata_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  registrata_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_deleghe_cliente on public.scadenze_bandi_deleghe (cliente_id);

create table if not exists public.scadenze_bandi_deleghe_persone (
  id uuid primary key default gen_random_uuid(),
  delega_id uuid not null references public.scadenze_bandi_deleghe(id) on delete cascade,
  utente_id uuid references public.scadenze_bandi_utenti(id) on delete set null,
  aggiunta_il timestamptz not null default now(),
  aggiunta_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  rimossa_il timestamptz,
  rimossa_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  rimossa_motivo text
);
create unique index if not exists uq_deleghe_persone_attive
  on public.scadenze_bandi_deleghe_persone (delega_id, utente_id) where rimossa_il is null;
create index if not exists idx_deleghe_persone_utente on public.scadenze_bandi_deleghe_persone (utente_id) where rimossa_il is null;

-- 2. Checklist del personale -----------------------------------------------------
create table if not exists public.scadenze_bandi_checklist_personale (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('ingresso_interno', 'ingresso_esterno', 'uscita')),
  utente_id uuid references public.scadenze_bandi_utenti(id) on delete set null,
  persona text not null,
  ruolo text,
  periodo_dal date,
  periodo_al date,
  voci jsonb not null,                 -- [{chiave, etichetta, facoltativa, stato: da_fare|fatto|non_dovuta, data, nota}]
  allegati jsonb not null default '[]',
  completata_il timestamptz,
  completata_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  creata_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_checklist_personale_utente on public.scadenze_bandi_checklist_personale (utente_id);

alter table public.scadenze_bandi_checklist_voci add column if not exists facoltativa boolean not null default false;

insert into public.scadenze_bandi_checklist_voci (tipo, chiave, etichetta, ordine, facoltativa) values
  ('personale_ingresso_interno', 'contratto', 'Contratto o lettera di incarico firmati (per i tirocinanti: convenzione e progetto formativo)', 10, false),
  ('personale_ingresso_interno', 'codice_etico', 'Consegna del Codice etico e del Modello, con firma di presa visione', 20, false),
  ('personale_ingresso_interno', 'privacy', 'Informativa e istruzioni privacy (nomina ad autorizzato al trattamento)', 30, false),
  ('personale_ingresso_interno', 'account', 'Account nominativi con i soli accessi necessari: Google Workspace, gestionale (con data di fine accesso se a termine), password manager', 40, false),
  ('personale_ingresso_interno', 'formazione', 'Formazione di base su 231, sicurezza e uso dell''IA', 50, false),
  ('personale_ingresso_interno', 'medico', 'Per i videoterminalisti: visita del medico competente', 60, true),
  ('personale_ingresso_interno', 'interessi', 'Dichiarazione degli interessi (M.04), se ha ruoli decisionali o rapporti con enti', 70, true),
  ('personale_ingresso_esterno', 'contratto_231', 'Contratto con clausola 231 (M.03)', 10, false),
  ('personale_ingresso_esterno', 'curriculum', 'Curriculum (per i docenti secondo la procedura DU28) e documento d''identità', 20, false),
  ('personale_ingresso_esterno', 'piva_albo', 'Partita IVA ed eventuale iscrizione all''albo verificate (M.01)', 30, false),
  ('personale_ingresso_esterno', 'dsan', 'Dichiarazione di onorabilità e assenza di conflitti (M.02)', 40, false),
  ('personale_ingresso_esterno', 'docenti', 'Docenti: istruzioni di sicurezza della sede e dichiarazione sul diritto d''autore', 50, true),
  ('personale_ingresso_esterno', 'accessi', 'Accessi ai sistemi solo se necessari e con data di fine', 60, true),
  ('personale_uscita', 'account', 'Account disattivati: Google Workspace, gestionale, password manager', 10, false),
  ('personale_uscita', 'deleghe_persone', 'Rimozione dall''elenco interno delle persone autorizzate sui portali dei clienti', 20, false),
  ('personale_uscita', 'riconsegna', 'Dispositivi, chiavi e documenti riconsegnati', 30, false),
  ('personale_uscita', 'dati', 'Quanto serve copiato nella cartella della pratica; dati cancellati dai dispositivi personali', 40, false),
  ('personale_uscita', 'deleghe_revoca', 'Deleghe e procure revocate o cessate', 50, true),
  ('personale_uscita', 'password', 'Password condivise note alla persona cambiate', 60, true),
  ('personale_uscita', 'riservatezza', 'Promemoria scritto degli obblighi di riservatezza che restano dopo l''uscita, consegnato', 70, false)
on conflict (tipo, chiave) do nothing;

-- Accesso solo dal server; registro delle operazioni e permessi come le altre tabelle
do $do$
declare t text;
begin
  foreach t in array array['scadenze_bandi_deleghe', 'scadenze_bandi_deleghe_persone', 'scadenze_bandi_checklist_personale'] loop
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

-- Permesso configurabile per il registro delle deleghe
insert into public.scadenze_bandi_permessi_catalogo (chiave, etichetta, descrizione, ordine) values
  ('deleghe.gestisci', 'Gestire il registro delle deleghe dei clienti',
   'Registrare deleghe e mandati, persone autorizzate, revoche e riesami (mai le password)', 85)
on conflict (chiave) do update set etichetta = excluded.etichetta, descrizione = excluded.descrizione, ordine = excluded.ordine;
insert into public.scadenze_bandi_permessi_ruolo (ruolo, permesso, consentito) values
  ('collaboratore', 'deleghe.gestisci', true),
  ('collaboratore_limitato', 'deleghe.gestisci', false)
on conflict do nothing;

-- updated_at e checklist completata non più modificabile
create or replace function public.gestionale_registri_231_b_aggiorna()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if tg_table_name = 'scadenze_bandi_checklist_personale' and old.completata_il is not null then
    raise exception 'La checklist è già completata e non si modifica più';
  end if;
  new.updated_at := now();
  return new;
end $fn$;
drop trigger if exists trg_aggiorna on public.scadenze_bandi_deleghe;
create trigger trg_aggiorna before update on public.scadenze_bandi_deleghe
  for each row execute function public.gestionale_registri_231_b_aggiorna();
drop trigger if exists trg_aggiorna on public.scadenze_bandi_checklist_personale;
create trigger trg_aggiorna before update on public.scadenze_bandi_checklist_personale
  for each row execute function public.gestionale_registri_231_b_aggiorna();

-- Chi esce (disattivato o con accesso scaduto) non resta tra le persone autorizzate
create or replace function public.gestionale_rimuovi_autorizzazioni_cessate()
returns integer language plpgsql security definer set search_path to 'public' as $fn$
declare v_n integer;
begin
  update scadenze_bandi_deleghe_persone dp
     set rimossa_il = now(),
         rimossa_motivo = case when u.attivo then 'Accesso al gestionale scaduto' else 'Utente disattivato' end
    from scadenze_bandi_utenti u
   where dp.utente_id = u.id and dp.rimossa_il is null
     and (not u.attivo or u.accesso_fino_al < (now() at time zone 'Europe/Rome')::date);
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;
revoke all on function public.gestionale_rimuovi_autorizzazioni_cessate() from public, anon, authenticated;
grant execute on function public.gestionale_rimuovi_autorizzazioni_cessate() to service_role;

create or replace function public.gestionale_utente_cessato()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if old.attivo and not new.attivo then
    update scadenze_bandi_deleghe_persone
       set rimossa_il = now(), rimossa_da = public.gestionale_autore(), rimossa_motivo = 'Utente disattivato'
     where utente_id = new.id and rimossa_il is null;
  end if;
  return new;
end $fn$;
drop trigger if exists trg_utente_cessato on public.scadenze_bandi_utenti;
create trigger trg_utente_cessato after update of attivo on public.scadenze_bandi_utenti
  for each row execute function public.gestionale_utente_cessato();
