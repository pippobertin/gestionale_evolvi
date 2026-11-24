-- =============================================================================
-- Controllo automatico delle pagine dei bandi: ogni mattina il gestionale legge
-- la pagina ufficiale (e le altre pagine indicate) dei bandi con progetti in
-- attesa del decreto, confronta i collegamenti con quelli già visti e segnala
-- quelli nuovi che sembrano graduatorie o documenti.
-- Annullamento: 20261124_controllo_pagine_bandi_ROLLBACK.sql
-- =============================================================================

-- Modalità per bando: auto (se ci sono progetti in attesa del decreto), acceso, spento
alter table public.scadenze_bandi_bandi
  add column if not exists controllo_pagina text not null default 'auto'
  check (controllo_pagina in ('auto', 'acceso', 'spento'));

create table if not exists public.scadenze_bandi_controllo_pagine (
  id uuid primary key default gen_random_uuid(),
  bando_id uuid not null references public.scadenze_bandi_bandi(id) on delete cascade,
  url text not null,
  etichetta text,
  -- link_ufficiale: dal bando; aggiunta: indicata da un collega; sottopagina: trovata in automatico
  origine text not null default 'aggiunta' check (origine in ('link_ufficiale', 'aggiunta', 'sottopagina')),
  attiva boolean not null default true,
  link_noti jsonb not null default '[]'::jsonb,
  ultimo_controllo timestamptz,
  esito text check (esito in ('ok', 'non_controllabile', 'errore')),
  messaggio text,
  creata_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bando_id, url)
);

create table if not exists public.scadenze_bandi_controllo_novita (
  id uuid primary key default gen_random_uuid(),
  bando_id uuid not null references public.scadenze_bandi_bandi(id) on delete cascade,
  pagina_id uuid references public.scadenze_bandi_controllo_pagine(id) on delete set null,
  url text not null,
  testo text,
  -- graduatoria: parole come graduatoria, esiti, ammessi; documento: PDF o foglio nuovo senza quelle parole
  tipo text not null check (tipo in ('graduatoria', 'documento')),
  parole text[] not null default '{}',
  trovata_il timestamptz not null default now(),
  stato text not null default 'da_vedere' check (stato in ('da_vedere', 'graduatoria', 'non_interessa')),
  decisa_da uuid references public.scadenze_bandi_utenti(id) on delete set null,
  decisa_il timestamptz,
  scadenze_create integer not null default 0,
  unique (bando_id, url)
);

create index if not exists idx_controllo_novita_stato on public.scadenze_bandi_controllo_novita (stato, trovata_il desc);

-- Le pagine cambiano a ogni controllo giornaliero: niente registro attività
-- (riempirebbe il registro); le novità e le decisioni invece sono registrate.
do $$
declare t text;
begin
  foreach t in array array['scadenze_bandi_controllo_pagine', 'scadenze_bandi_controllo_novita'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop trigger if exists trg_registro_operazioni on public.%I', t);
    execute format('create trigger trg_registro_operazioni after insert or update or delete on public.%I for each row execute function public.gestionale_registra_operazione()', t);
    execute format('drop trigger if exists trg_controlla_permesso on public.%I', t);
    execute format('create trigger trg_controlla_permesso before insert or update or delete on public.%I for each row execute function public.gestionale_controlla_permesso()', t);
  end loop;
end $$;
drop trigger if exists trg_registro_operazioni on public.scadenze_bandi_controllo_pagine;
