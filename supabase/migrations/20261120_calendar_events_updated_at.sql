-- Il trigger update_calendar_events_updated_at imposta NEW.updated_at, ma la tabella
-- scadenze_bandi_calendar_events non aveva la colonna: qualsiasi UPDATE sarebbe fallito.
-- (Annullamento: alter table public.scadenze_bandi_calendar_events drop column updated_at;)
alter table public.scadenze_bandi_calendar_events add column if not exists updated_at timestamptz default now();
