-- Aggiunge campo data_effettiva alla tabella scadenze per distinguere
-- tra data teorica (calcolata dal template) e data effettiva (confermata dall'utente)

ALTER TABLE scadenze_bandi_scadenze
ADD COLUMN IF NOT EXISTS data_effettiva TIMESTAMP WITH TIME ZONE NULL;

-- Aggiungi anche campi per tracciare chi e quando ha modificato la data
ALTER TABLE scadenze_bandi_scadenze
ADD COLUMN IF NOT EXISTS data_modificata_da TEXT NULL;

ALTER TABLE scadenze_bandi_scadenze
ADD COLUMN IF NOT EXISTS data_modificata_il TIMESTAMP WITH TIME ZONE NULL;

-- Commenti per chiarire l'uso dei campi
COMMENT ON COLUMN scadenze_bandi_scadenze.data_scadenza IS 'Data teorica calcolata automaticamente dal template del bando';
COMMENT ON COLUMN scadenze_bandi_scadenze.data_effettiva IS 'Data effettiva confermata o modificata manualmente dall''utente. Se NULL, si usa data_scadenza';
COMMENT ON COLUMN scadenze_bandi_scadenze.data_modificata_da IS 'Email dell''utente che ha modificato la data effettiva';
COMMENT ON COLUMN scadenze_bandi_scadenze.data_modificata_il IS 'Timestamp dell''ultima modifica alla data effettiva';

-- Crea un indice per query più veloci
CREATE INDEX IF NOT EXISTS idx_scadenze_data_effettiva ON scadenze_bandi_scadenze(data_effettiva) WHERE data_effettiva IS NOT NULL;
