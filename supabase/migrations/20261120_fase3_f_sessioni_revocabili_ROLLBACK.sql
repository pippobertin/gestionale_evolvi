-- Annulla 20261120_fase3_f_sessioni_revocabili.sql (solo dopo aver ripristinato il codice precedente)
drop index if exists public.idx_sessioni_utente;
alter table public.scadenze_bandi_sessioni drop column if exists metodo, drop column if exists revoked_at;
