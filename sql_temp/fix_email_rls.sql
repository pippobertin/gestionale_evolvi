-- Disabilita temporaneamente RLS per le tabelle email
-- dato che usiamo JWT personalizzati e non auth di Supabase

ALTER TABLE scadenze_bandi_email_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_email_folders DISABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_email_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_email_attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_email_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_email_sync_logs DISABLE ROW LEVEL SECURITY;

-- Drop le policy esistenti
DROP POLICY IF EXISTS "Users can manage their own email accounts" ON scadenze_bandi_email_accounts;
DROP POLICY IF EXISTS "Users can access folders of their accounts" ON scadenze_bandi_email_folders;
DROP POLICY IF EXISTS "Users can access messages of their accounts" ON scadenze_bandi_email_messages;
DROP POLICY IF EXISTS "Users can access attachments of their messages" ON scadenze_bandi_email_attachments;
DROP POLICY IF EXISTS "Users can manage their own email links" ON scadenze_bandi_email_links;
DROP POLICY IF EXISTS "Users can view sync logs of their accounts" ON scadenze_bandi_email_sync_logs;