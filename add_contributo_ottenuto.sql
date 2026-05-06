-- Aggiunge campo contributo_ottenuto alla tabella progetti
-- Questo campo memorizza il contributo effettivamente ottenuto a progetto completato
-- (che può differire dal contributo ammesso iniziale)

ALTER TABLE scadenze_bandi_progetti
ADD COLUMN IF NOT EXISTS contributo_ottenuto DECIMAL(12, 2) NULL;

COMMENT ON COLUMN scadenze_bandi_progetti.contributo_ottenuto IS 'Contributo effettivamente ottenuto a progetto completato (può differire dal contributo ammesso)';
