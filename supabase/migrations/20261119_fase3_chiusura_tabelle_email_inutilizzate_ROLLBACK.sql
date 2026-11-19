-- Annulla la chiusura delle tabelle email (ripristina l'accesso aperto precedente). Solo in emergenza.
grant all on public.scadenze_bandi_email_accounts, public.scadenze_bandi_email_messages,
             public.scadenze_bandi_email_attachments, public.scadenze_bandi_email_folders,
             public.scadenze_bandi_email_links, public.scadenze_bandi_email_sync_logs
  to anon, authenticated;
create policy "Service role can manage all email accounts" on public.scadenze_bandi_email_accounts for all to public using (true);
create policy "Service role can access all email messages" on public.scadenze_bandi_email_messages for all to public using (true);
create policy "Service role can access all email attachments" on public.scadenze_bandi_email_attachments for all to public using (true);
create policy "Service role can access all email folders" on public.scadenze_bandi_email_folders for all to public using (true);
create policy "Service role can manage all email links" on public.scadenze_bandi_email_links for all to public using (true);
create policy "Service role can access all sync logs" on public.scadenze_bandi_email_sync_logs for all to public using (true);
