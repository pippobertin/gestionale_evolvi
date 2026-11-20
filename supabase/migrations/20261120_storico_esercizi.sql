-- =============================================================================
-- Storico per esercizio dei dati dimensionali e registro delle modifiche (20/11/2026)
--
-- La regola dei due esercizi consecutivi (Racc. 2003/361/CE, allegato, art. 4)
-- si applica per anno di bilancio: servono ULA, fatturato e attivo di ogni
-- esercizio, non solo gli ultimi valori.
--
-- 1. scadenze_bandi_clienti_esercizi: una riga per cliente e anno, con fonte del
--    dato e autore. I valori attuali dei clienti (ula, ultimo_fatturato,
--    attivo_bilancio) restano quelli dell'ultimo esercizio, indicato in
--    scadenze_bandi_clienti.esercizio_riferimento.
-- 2. scadenze_bandi_clienti_dati_log: registro non modificabile di ogni cambio
--    di ULA, fatturato, attivo ed esercizio di riferimento (prima, dopo, quando,
--    chi), scritto da un trigger. Primo pezzo del registro della fase 4.
-- 3. I dati attuali vengono attribuiti all'esercizio 2025 (correggibile).
-- Annullamento: 20261120_storico_esercizi_ROLLBACK.sql
-- =============================================================================

alter table public.scadenze_bandi_clienti
  add column if not exists esercizio_riferimento integer check (esercizio_riferimento between 1990 and 2100);

create table if not exists public.scadenze_bandi_clienti_esercizi (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.scadenze_bandi_clienti(id) on delete cascade,
  esercizio integer not null check (esercizio between 1990 and 2100),
  ula numeric,
  fatturato numeric,
  attivo numeric,
  fonte text not null default 'altro'
    check (fonte in ('bilancio', 'visura', 'dichiarazione_cliente', 'stima', 'altro')),
  note text,
  inserito_da uuid references public.scadenze_bandi_utenti(id),
  aggiornato_da uuid references public.scadenze_bandi_utenti(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, esercizio)
);
create index if not exists idx_clienti_esercizi_cliente on public.scadenze_bandi_clienti_esercizi (cliente_id);

create table if not exists public.scadenze_bandi_clienti_dati_log (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.scadenze_bandi_clienti(id) on delete cascade,
  origine text not null,              -- 'cliente' (scheda) oppure 'esercizio <anno>'
  campo text not null,
  valore_precedente text,
  valore_nuovo text,
  modificato_da uuid,                 -- utente del gestionale (badge); null se dal server
  modificato_il timestamptz not null default now()
);
create index if not exists idx_clienti_dati_log_cliente on public.scadenze_bandi_clienti_dati_log (cliente_id, modificato_il desc);

-- Dati attuali attribuiti all'esercizio 2025
update public.scadenze_bandi_clienti
set esercizio_riferimento = 2025
where esercizio_riferimento is null
  and (ula is not null or ultimo_fatturato is not null or attivo_bilancio is not null);

insert into public.scadenze_bandi_clienti_esercizi (cliente_id, esercizio, ula, fatturato, attivo, fonte, note)
select id, 2025, ula, ultimo_fatturato, attivo_bilancio, 'altro',
       'Dati presenti nel gestionale al 20/11/2026, attribuiti all''esercizio 2025: verificare l''anno'
from public.scadenze_bandi_clienti
where ula is not null or ultimo_fatturato is not null or attivo_bilancio is not null
on conflict (cliente_id, esercizio) do nothing;

-- Registro delle modifiche: scritto solo dai trigger
create or replace function public.gestionale_log_dati_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  autore uuid := public.gestionale_utente_id();
begin
  if tg_table_name = 'scadenze_bandi_clienti' then
    if new.ula is distinct from old.ula then
      insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
      values (new.id, 'cliente', 'ula', old.ula::text, new.ula::text, autore);
    end if;
    if new.ultimo_fatturato is distinct from old.ultimo_fatturato then
      insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
      values (new.id, 'cliente', 'fatturato', old.ultimo_fatturato::text, new.ultimo_fatturato::text, autore);
    end if;
    if new.attivo_bilancio is distinct from old.attivo_bilancio then
      insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
      values (new.id, 'cliente', 'attivo', old.attivo_bilancio::text, new.attivo_bilancio::text, autore);
    end if;
    if new.esercizio_riferimento is distinct from old.esercizio_riferimento then
      insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
      values (new.id, 'cliente', 'esercizio_riferimento', old.esercizio_riferimento::text, new.esercizio_riferimento::text, autore);
    end if;
  elsif tg_op = 'INSERT' then
    insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
    values (new.cliente_id, 'esercizio ' || new.esercizio, 'inserimento',
            null, format('ULA %s, fatturato %s, attivo %s (%s)', coalesce(new.ula::text, '-'), coalesce(new.fatturato::text, '-'), coalesce(new.attivo::text, '-'), new.fonte), autore);
  elsif tg_op = 'UPDATE' then
    insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
    select new.cliente_id, 'esercizio ' || new.esercizio, c.campo, c.prima, c.dopo, autore
    from (values ('ula', old.ula::text, new.ula::text),
                 ('fatturato', old.fatturato::text, new.fatturato::text),
                 ('attivo', old.attivo::text, new.attivo::text),
                 ('fonte', old.fonte, new.fonte)) as c(campo, prima, dopo)
    where c.prima is distinct from c.dopo;
  elsif tg_op = 'DELETE' then
    insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
    values (old.cliente_id, 'esercizio ' || old.esercizio, 'eliminazione',
            format('ULA %s, fatturato %s, attivo %s', coalesce(old.ula::text, '-'), coalesce(old.fatturato::text, '-'), coalesce(old.attivo::text, '-')), null, autore);
    return old;
  end if;
  return new;
end $fn$;
revoke all on function public.gestionale_log_dati_cliente() from public, anon, authenticated;

drop trigger if exists trg_log_dati_cliente on public.scadenze_bandi_clienti;
create trigger trg_log_dati_cliente after update on public.scadenze_bandi_clienti
  for each row execute function public.gestionale_log_dati_cliente();

drop trigger if exists trg_log_esercizi on public.scadenze_bandi_clienti_esercizi;
create trigger trg_log_esercizi after insert or update or delete on public.scadenze_bandi_clienti_esercizi
  for each row execute function public.gestionale_log_dati_cliente();

drop trigger if exists update_clienti_esercizi_updated_at on public.scadenze_bandi_clienti_esercizi;
create trigger update_clienti_esercizi_updated_at before update on public.scadenze_bandi_clienti_esercizi
  for each row execute function public.update_updated_at_column();

-- Protezione: come le altre tabelle del gestionale (badge); il registro è in sola lettura
alter table public.scadenze_bandi_clienti_esercizi enable row level security;
revoke all on public.scadenze_bandi_clienti_esercizi from anon;
grant select, insert, update, delete on public.scadenze_bandi_clienti_esercizi to authenticated;
create policy gestionale_accesso on public.scadenze_bandi_clienti_esercizi for all to authenticated
  using ((select public.gestionale_utente_id()) is not null)
  with check ((select public.gestionale_utente_id()) is not null);

alter table public.scadenze_bandi_clienti_dati_log enable row level security;
revoke all on public.scadenze_bandi_clienti_dati_log from anon, authenticated;
grant select on public.scadenze_bandi_clienti_dati_log to authenticated;
create policy gestionale_lettura on public.scadenze_bandi_clienti_dati_log for select to authenticated
  using ((select public.gestionale_utente_id()) is not null);
