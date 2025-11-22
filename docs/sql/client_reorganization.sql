-- SQL Migration Script per Riorganizzazione Sezione Clienti
-- Da eseguire in Supabase SQL Editor

-- 1. Aggiungere nuovi campi alla tabella clienti esistente
ALTER TABLE scadenze_bandi_clienti
ADD COLUMN IF NOT EXISTS estremi_iscrizione_runts TEXT,
ADD COLUMN IF NOT EXISTS banca_filiale TEXT;

-- 2. Creare tabella per i referenti multipli
CREATE TABLE IF NOT EXISTS scadenze_bandi_clienti_referenti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
    cognome VARCHAR(100) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    telefono VARCHAR(50),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice per ottimizzare le query sui referenti
CREATE INDEX IF NOT EXISTS idx_clienti_referenti_cliente_id
ON scadenze_bandi_clienti_referenti(cliente_id);

-- 3. Creare tabella per i documenti clienti
CREATE TABLE IF NOT EXISTS scadenze_bandi_clienti_documenti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
    nome_file VARCHAR(255) NOT NULL,
    nome_originale VARCHAR(255) NOT NULL,
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('VISURA', 'BILANCI', 'ULA', 'CONTRATTI', 'DSAN', 'ALTRO')),
    file_path VARCHAR(500) NOT NULL, -- Path nel bucket Supabase
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES scadenze_bandi_utenti(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice per ottimizzare le query sui documenti
CREATE INDEX IF NOT EXISTS idx_clienti_documenti_cliente_id
ON scadenze_bandi_clienti_documenti(cliente_id);

-- Indice per ottimizzare le query per categoria
CREATE INDEX IF NOT EXISTS idx_clienti_documenti_categoria
ON scadenze_bandi_clienti_documenti(categoria);

-- 4. Aggiornare trigger per updated_at sui referenti
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clienti_referenti_updated_at
    BEFORE UPDATE ON scadenze_bandi_clienti_referenti
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Aggiornare trigger per updated_at sui documenti
CREATE TRIGGER update_clienti_documenti_updated_at
    BEFORE UPDATE ON scadenze_bandi_clienti_documenti
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. RLS (Row Level Security) per i referenti
ALTER TABLE scadenze_bandi_clienti_referenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users" ON scadenze_bandi_clienti_referenti
    FOR ALL USING (auth.role() = 'authenticated');

-- 7. RLS (Row Level Security) per i documenti
ALTER TABLE scadenze_bandi_clienti_documenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users" ON scadenze_bandi_clienti_documenti
    FOR ALL USING (auth.role() = 'authenticated');

-- 8. COMMENTI per documentazione
COMMENT ON TABLE scadenze_bandi_clienti_referenti IS 'Referenti multipli per ogni cliente (contatti aziendali)';
COMMENT ON TABLE scadenze_bandi_clienti_documenti IS 'Documenti amministrativi caricati per ogni cliente';

COMMENT ON COLUMN scadenze_bandi_clienti.estremi_iscrizione_runts IS 'Estremi iscrizione al Registro Unico Nazionale del Terzo Settore';
COMMENT ON COLUMN scadenze_bandi_clienti.banca_filiale IS 'Nome banca e filiale per coordinate bancarie';

-- 9. View per facilitare le query con referenti
CREATE OR REPLACE VIEW scadenze_bandi_clienti_con_referenti AS
SELECT
    c.*,
    COALESCE(
        json_agg(
            json_build_object(
                'id', r.id,
                'cognome', r.cognome,
                'nome', r.nome,
                'email', r.email,
                'telefono', r.telefono,
                'note', r.note
            )
        ) FILTER (WHERE r.id IS NOT NULL),
        '[]'::json
    ) as referenti
FROM scadenze_bandi_clienti c
LEFT JOIN scadenze_bandi_clienti_referenti r ON c.id = r.cliente_id
GROUP BY c.id;

-- 10. View per facilitare le query con documenti
CREATE OR REPLACE VIEW scadenze_bandi_clienti_con_documenti AS
SELECT
    c.*,
    COALESCE(
        json_agg(
            json_build_object(
                'id', d.id,
                'nome_file', d.nome_file,
                'nome_originale', d.nome_originale,
                'categoria', d.categoria,
                'file_path', d.file_path,
                'file_size', d.file_size,
                'mime_type', d.mime_type,
                'created_at', d.created_at
            )
        ) FILTER (WHERE d.id IS NOT NULL),
        '[]'::json
    ) as documenti
FROM scadenze_bandi_clienti c
LEFT JOIN scadenze_bandi_clienti_documenti d ON c.id = d.cliente_id
GROUP BY c.id;