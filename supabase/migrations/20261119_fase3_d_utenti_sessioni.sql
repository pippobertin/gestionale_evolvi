-- =============================================================================
-- Fase 3, passaggio D: utenti e sessioni
--
-- Utenti: la chiave pubblica da sola non legge più nomi ed email e non può più
-- cambiare il gruppo di un utente. Gli utenti del gestionale con badge
-- mantengono gli stessi permessi per colonna concessi nella fase 1 (lettura
-- delle colonne non sensibili, modifica del solo gruppo), ora sotto la regola
-- "solo utenti attivi del gestionale". Le funzioni gestionale_utente_id() e
-- gestionale_is_admin() sono "security definer" del proprietario della tabella
-- e continuano a leggerla senza passare dalla regola.
-- Sessioni: già senza permessi per anon e authenticated; si attiva la
-- protezione come difesa ulteriore (la usa solo il server).
-- Annullamento: 20261119_fase3_d_utenti_sessioni_ROLLBACK.sql
-- =============================================================================
alter table public.scadenze_bandi_utenti enable row level security;
revoke all on public.scadenze_bandi_utenti from anon;
revoke select (id, email, nome, cognome, livello_permessi, attivo, ultimo_accesso, created_at, updated_at, created_by, gruppo_id, first_login_password_change, gmail_connected_at, gmail_email, firma_email_html) on public.scadenze_bandi_utenti from anon;
revoke update (gruppo_id) on public.scadenze_bandi_utenti from anon;
drop policy if exists gestionale_accesso on public.scadenze_bandi_utenti;
create policy gestionale_accesso on public.scadenze_bandi_utenti for all to authenticated
  using ((select public.gestionale_utente_id()) is not null)
  with check ((select public.gestionale_utente_id()) is not null);

alter view public.scadenze_bandi_utenti_view set (security_invoker = on);
revoke all on public.scadenze_bandi_utenti_view from anon, authenticated;

alter table public.scadenze_bandi_sessioni enable row level security;
revoke all on public.scadenze_bandi_sessioni from anon, authenticated;
