-- Tabella per memorizzare le impostazioni di sistema (Gmail tokens, etc.)
CREATE TABLE IF NOT EXISTS scadenze_bandi_system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  encrypted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice per ricerche veloci per chiave
CREATE INDEX IF NOT EXISTS idx_scadenze_bandi_system_settings_key
ON scadenze_bandi_system_settings(key);

-- Policy RLS (Row Level Security)
ALTER TABLE scadenze_bandi_system_settings ENABLE ROW LEVEL SECURITY;

-- Policy per lettura/scrittura (solo admin o sistema)
CREATE POLICY "Allow system settings access" ON scadenze_bandi_system_settings
FOR ALL USING (true);

-- Commento sulla tabella
COMMENT ON TABLE scadenze_bandi_system_settings IS
'Impostazioni di sistema per Gmail tokens e altre configurazioni';

COMMENT ON COLUMN scadenze_bandi_system_settings.key IS 'Chiave univoca dell''impostazione';
COMMENT ON COLUMN scadenze_bandi_system_settings.value IS 'Valore dell''impostazione (JSON o testo)';
COMMENT ON COLUMN scadenze_bandi_system_settings.encrypted IS 'Indica se il valore è crittografato';