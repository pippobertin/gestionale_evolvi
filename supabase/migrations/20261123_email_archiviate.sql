-- =============================================================================
-- Email archiviate dal gestionale: dal riquadro "Email" della scheda cliente o
-- della pratica, un'email (con eventuali allegati) si salva in PDF su Drive e
-- può diventare un contatto con la PA o la conferma scritta del cliente. Qui
-- resta traccia di cosa è stato archiviato, dove e da chi.
-- Annullamento: 20261123_email_archiviate_ROLLBACK.sql
-- =============================================================================
create table if not exists public.scadenze_bandi_email_archiviate (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null,
  gmail_thread_id text,
  casella text,
  oggetto text,
  mittente text,
  destinatari text,
  data_email timestamptz,
  cliente_id uuid references public.scadenze_bandi_clienti(id) on delete set null,
  progetto_id uuid references public.scadenze_bandi_progetti(id) on delete set null,
  registrata_come text not null default 'documento' check (registrata_come in ('documento', 'contatto_pa', 'conferma_cliente')),
  google_drive_id text,
  google_drive_url text,
  allegati jsonb not null default '[]',
  archiviata_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_email_archiviate_cliente on public.scadenze_bandi_email_archiviate (cliente_id);
create index if not exists idx_email_archiviate_progetto on public.scadenze_bandi_email_archiviate (progetto_id);
create index if not exists idx_email_archiviate_messaggio on public.scadenze_bandi_email_archiviate (gmail_message_id);

alter table public.scadenze_bandi_email_archiviate enable row level security;
revoke all on public.scadenze_bandi_email_archiviate from anon, authenticated;
drop trigger if exists trg_registro_operazioni on public.scadenze_bandi_email_archiviate;
create trigger trg_registro_operazioni after insert or update or delete on public.scadenze_bandi_email_archiviate
  for each row execute function public.gestionale_registra_operazione();
drop trigger if exists trg_controlla_permesso on public.scadenze_bandi_email_archiviate;
create trigger trg_controlla_permesso before insert or update or delete on public.scadenze_bandi_email_archiviate
  for each row execute function public.gestionale_controlla_permesso();
