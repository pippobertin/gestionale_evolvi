-- DROP delle tabelle email create senza prefixo
-- Da eseguire prima di ricreare con nomi corretti

-- Drop tabelle con CASCADE per eliminare anche RLS policies e constraints
DROP TABLE IF EXISTS email_sync_logs CASCADE;
DROP TABLE IF EXISTS email_links CASCADE;
DROP TABLE IF EXISTS email_attachments CASCADE;
DROP TABLE IF EXISTS email_messages CASCADE;
DROP TABLE IF EXISTS email_folders CASCADE;
DROP TABLE IF EXISTS email_accounts CASCADE;

-- Non eliminiamo la funzione update_updated_at_column() perché è usata da altre tabelle