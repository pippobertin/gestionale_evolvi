-- Aggiunge campi Google Drive alla tabella documenti_progetto

ALTER TABLE scadenze_bandi_documenti_progetto
ADD COLUMN IF NOT EXISTS google_drive_id TEXT,
ADD COLUMN IF NOT EXISTS google_drive_url TEXT,
ADD COLUMN IF NOT EXISTS google_drive_modified TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS has_changes BOOLEAN DEFAULT false;

-- Crea indice per performance su google_drive_id
CREATE INDEX IF NOT EXISTS idx_documenti_progetto_google_drive_id
ON scadenze_bandi_documenti_progetto(google_drive_id);

-- Aggiunge commenti ai nuovi campi
COMMENT ON COLUMN scadenze_bandi_documenti_progetto.google_drive_id IS 'ID del file su Google Drive';
COMMENT ON COLUMN scadenze_bandi_documenti_progetto.google_drive_url IS 'URL di visualizzazione su Google Drive';
COMMENT ON COLUMN scadenze_bandi_documenti_progetto.google_drive_modified IS 'Data ultima modifica su Google Drive';
COMMENT ON COLUMN scadenze_bandi_documenti_progetto.last_checked IS 'Data ultimo controllo modifiche';
COMMENT ON COLUMN scadenze_bandi_documenti_progetto.has_changes IS 'Indica se ci sono state modifiche non sincronizzate';