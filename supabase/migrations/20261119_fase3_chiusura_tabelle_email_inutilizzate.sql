-- =============================================================================
-- Fase 3: chiusura delle tabelle del vecchio sistema email IMAP
--
-- Le tabelle scadenze_bandi_email_* non sono usate da nessuna parte del codice
-- (verificato il 19/11/2026), ma contengono 1 account email (password cifrata e
-- token OAuth) e 9.274 messaggi, leggibili da chiunque con la chiave pubblica
-- per via di policy "USING (true)" sul ruolo public.
-- Si tolgono i permessi al ruolo pubblico e agli utenti autenticati e si
-- eliminano le policy aperte. I dati restano (solo la chiave riservata li legge).
-- Annullamento: 20261119_fase3_chiusura_tabelle_email_inutilizzate_ROLLBACK.sql
-- =============================================================================
revoke all on public.scadenze_bandi_email_accounts,
              public.scadenze_bandi_email_messages,
              public.scadenze_bandi_email_attachments,
              public.scadenze_bandi_email_folders,
              public.scadenze_bandi_email_links,
              public.scadenze_bandi_email_sync_logs
  from anon, authenticated;

drop policy if exists "Service role can manage all email accounts" on public.scadenze_bandi_email_accounts;
drop policy if exists "Service role can access all email messages" on public.scadenze_bandi_email_messages;
drop policy if exists "Service role can access all email attachments" on public.scadenze_bandi_email_attachments;
drop policy if exists "Service role can access all email folders" on public.scadenze_bandi_email_folders;
drop policy if exists "Service role can manage all email links" on public.scadenze_bandi_email_links;
drop policy if exists "Service role can access all sync logs" on public.scadenze_bandi_email_sync_logs;
