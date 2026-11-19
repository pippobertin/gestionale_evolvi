-- =============================================================================
-- Fase 1 sicurezza: chiusura delle colonne e tabelle sensibili al ruolo pubblico
-- Progetto Supabase: "TEST" (xvjgziihekwjyzihjihx) che ospita il Gestionale Evolvi
--
-- DA APPLICARE SOLO DOPO il deploy in produzione del codice della fase 1:
-- il codice precedente leggeva hash e token con la chiave pubblica e smetterebbe
-- di funzionare (login, Gmail di sistema).
--
-- Tocca solo tabelle del gestionale (prefisso scadenze_bandi_): le altre
-- applicazioni presenti nello stesso database non sono interessate.
-- Annullamento: 20261119_fase1_chiusura_colonne_sensibili_ROLLBACK.sql
-- =============================================================================

begin;

-- 1. Utenti: il ruolo pubblico vede solo le colonne non sensibili.
--    Esclusi: password_hash, gmail_refresh_token, gmail_access_token.
revoke all on public.scadenze_bandi_utenti from anon, authenticated;
grant select (id, email, nome, cognome, livello_permessi, attivo, ultimo_accesso,
              created_at, updated_at, created_by, gruppo_id, first_login_password_change,
              gmail_connected_at, gmail_email, firma_email_html)
  on public.scadenze_bandi_utenti to anon, authenticated;
-- Unica scrittura ancora fatta dal browser: assegnazione del gruppo (GroupsManagement)
grant update (gruppo_id) on public.scadenze_bandi_utenti to anon, authenticated;

-- 2. Impostazioni di sistema (token Gmail di sistema): solo server.
revoke all on public.scadenze_bandi_system_settings from anon, authenticated;
drop policy if exists "Allow system settings access" on public.scadenze_bandi_system_settings;

-- 3. Sessioni (registro accessi): solo server.
revoke all on public.scadenze_bandi_sessioni from anon, authenticated;

-- 4. Vista utenti (SECURITY DEFINER, non usata dal codice): chiusa.
revoke all on public.scadenze_bandi_utenti_view from anon, authenticated;

-- 5. Disattivazione account di prova (resta in archivio, non viene cancellato).
update public.scadenze_bandi_utenti
   set attivo = false, updated_at = now()
 where email = 'filippobertin77@gmail.com';

commit;
