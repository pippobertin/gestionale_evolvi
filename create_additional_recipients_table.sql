-- Tabella per destinatari aggiuntivi globali email notifiche
CREATE TABLE IF NOT EXISTS scadenze_bandi_additional_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT -- Email dell'admin che ha aggiunto il destinatario
);

-- Index per performance
CREATE INDEX IF NOT EXISTS idx_additional_recipients_email ON scadenze_bandi_additional_recipients(email);
CREATE INDEX IF NOT EXISTS idx_additional_recipients_active ON scadenze_bandi_additional_recipients(active);

-- Unique index per evitare duplicati di email attive
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_email_idx
ON scadenze_bandi_additional_recipients (email)
WHERE active = true;

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_additional_recipients_updated_at
    BEFORE UPDATE ON scadenze_bandi_additional_recipients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Commenti
COMMENT ON TABLE scadenze_bandi_additional_recipients IS 'Destinatari aggiuntivi che ricevono tutte le notifiche email del sistema';
COMMENT ON COLUMN scadenze_bandi_additional_recipients.email IS 'Email del destinatario';
COMMENT ON COLUMN scadenze_bandi_additional_recipients.active IS 'Se false, il destinatario non riceverà notifiche';
COMMENT ON COLUMN scadenze_bandi_additional_recipients.created_by IS 'Email dell''admin che ha aggiunto il destinatario';