-- Annulla 20261119_fase3_d_utenti_sessioni.sql e torna allo stato della fase 1:
-- utenti senza protezione, colonne non sensibili leggibili e gruppo modificabile
-- anche con la sola chiave pubblica; sessioni senza protezione. Solo in emergenza.
drop policy if exists gestionale_accesso on public.scadenze_bandi_utenti;
alter table public.scadenze_bandi_utenti disable row level security;
grant select (id, email, nome, cognome, livello_permessi, attivo, ultimo_accesso, created_at, updated_at, created_by, gruppo_id, first_login_password_change, gmail_connected_at, gmail_email, firma_email_html) on public.scadenze_bandi_utenti to anon;
grant update (gruppo_id) on public.scadenze_bandi_utenti to anon;
alter view public.scadenze_bandi_utenti_view reset (security_invoker);
alter table public.scadenze_bandi_sessioni disable row level security;
