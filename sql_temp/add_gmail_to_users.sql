-- Migration: Add Gmail OAuth fields to users table
-- This enables per-user Gmail integration instead of system-wide

-- Add Gmail OAuth token columns
ALTER TABLE scadenze_bandi_utenti
ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_access_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_connected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS gmail_email VARCHAR(255);

-- Add index for faster lookups when sending emails
CREATE INDEX IF NOT EXISTS idx_utenti_gmail_connected
ON scadenze_bandi_utenti(id)
WHERE gmail_refresh_token IS NOT NULL;

-- Add comment to document the feature
COMMENT ON COLUMN scadenze_bandi_utenti.gmail_refresh_token IS 'OAuth refresh token for user Gmail account';
COMMENT ON COLUMN scadenze_bandi_utenti.gmail_access_token IS 'OAuth access token for user Gmail account';
COMMENT ON COLUMN scadenze_bandi_utenti.gmail_connected_at IS 'Timestamp when user connected their Gmail account';
COMMENT ON COLUMN scadenze_bandi_utenti.gmail_email IS 'Gmail address connected by the user';
