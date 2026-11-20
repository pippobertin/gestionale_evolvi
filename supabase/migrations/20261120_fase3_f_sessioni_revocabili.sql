-- =============================================================================
-- Fase 3, passaggio F: sessioni revocabili
--
-- Ogni login (password o Google) crea una riga in scadenze_bandi_sessioni e il
-- token del gestionale porta il suo identificativo (sid). Il server accetta il
-- token solo se la sessione esiste, non è scaduta e non è stata revocata: il
-- logout la revoca subito invece di lasciarla valida fino alla scadenza.
-- Solo colonne aggiunte: il codice attuale continua a funzionare.
-- Annullamento: 20261120_fase3_f_sessioni_revocabili_ROLLBACK.sql
-- =============================================================================
alter table public.scadenze_bandi_sessioni
  add column if not exists revoked_at timestamptz,
  add column if not exists metodo text check (metodo in ('password', 'google'));

create index if not exists idx_sessioni_utente on public.scadenze_bandi_sessioni (utente_id);
