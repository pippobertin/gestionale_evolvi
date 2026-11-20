-- Annulla 20261120_storico_esercizi.sql (perde lo storico e il registro delle modifiche)
drop trigger if exists trg_log_dati_cliente on public.scadenze_bandi_clienti;
drop table if exists public.scadenze_bandi_clienti_dati_log;
drop table if exists public.scadenze_bandi_clienti_esercizi;
drop function if exists public.gestionale_log_dati_cliente();
alter table public.scadenze_bandi_clienti drop column if exists esercizio_riferimento;
