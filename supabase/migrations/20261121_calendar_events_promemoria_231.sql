-- Eventi di calendario: nuovo tipo per i promemoria delle scadenze della pratica (30 e 10 giorni prima, Modello 231)
alter table public.scadenze_bandi_calendar_events drop constraint if exists scadenze_bandi_calendar_events_event_type_check;
alter table public.scadenze_bandi_calendar_events add constraint scadenze_bandi_calendar_events_event_type_check
  check (event_type = any (array['scadenza', 'progetto_milestone', 'meeting', 'promemoria_231']));
