-- Sistema di gestione utenti e gruppi per responsabili scadenze

-- 1. Tabella utenti del sistema
CREATE TABLE IF NOT EXISTS scadenze_bandi_utenti (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cognome VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    ruolo VARCHAR(50) DEFAULT 'utente' CHECK (ruolo IN ('admin', 'utente', 'responsabile')),
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabella gruppi utenti
CREATE TABLE IF NOT EXISTS scadenze_bandi_gruppi_utenti (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descrizione TEXT,
    colore_hex VARCHAR(7) DEFAULT '#3B82F6', -- Colore per UI
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabella di associazione utenti-gruppi (many-to-many)
CREATE TABLE IF NOT EXISTS scadenze_bandi_utenti_gruppi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    utente_id UUID REFERENCES scadenze_bandi_utenti(id) ON DELETE CASCADE,
    gruppo_id UUID REFERENCES scadenze_bandi_gruppi_utenti(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Vincolo per evitare duplicati
    UNIQUE(utente_id, gruppo_id)
);

-- 4. Tabella per gestire i responsabili delle scadenze (supporta utenti singoli, gruppi, e TUTTI)
CREATE TABLE IF NOT EXISTS scadenze_bandi_responsabili_scadenze (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scadenza_id UUID REFERENCES scadenze_bandi_scadenze(id) ON DELETE CASCADE,
    tipo_responsabile VARCHAR(20) NOT NULL CHECK (tipo_responsabile IN ('utente', 'gruppo', 'tutti')),
    utente_id UUID REFERENCES scadenze_bandi_utenti(id) ON DELETE CASCADE, -- NULL se non è un utente singolo
    gruppo_id UUID REFERENCES scadenze_bandi_gruppi_utenti(id) ON DELETE CASCADE, -- NULL se non è un gruppo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Vincoli di integrità
    CHECK (
        (tipo_responsabile = 'utente' AND utente_id IS NOT NULL AND gruppo_id IS NULL) OR
        (tipo_responsabile = 'gruppo' AND gruppo_id IS NOT NULL AND utente_id IS NULL) OR
        (tipo_responsabile = 'tutti' AND utente_id IS NULL AND gruppo_id IS NULL)
    )
);

-- 5. Aggiorna tabella template scadenze per supportare responsabili di default
ALTER TABLE scadenze_bandi_template_scadenze
ADD COLUMN IF NOT EXISTS responsabile_default_json JSONB;

-- Commenta questa colonna se esiste già
-- ALTER TABLE scadenze_bandi_template_scadenze
-- DROP COLUMN IF EXISTS responsabile_email;

-- 6. Indici per performance
CREATE INDEX IF NOT EXISTS idx_utenti_email ON scadenze_bandi_utenti(email);
CREATE INDEX IF NOT EXISTS idx_utenti_attivo ON scadenze_bandi_utenti(attivo);
CREATE INDEX IF NOT EXISTS idx_gruppi_attivo ON scadenze_bandi_gruppi_utenti(attivo);
CREATE INDEX IF NOT EXISTS idx_responsabili_scadenza ON scadenze_bandi_responsabili_scadenze(scadenza_id);
CREATE INDEX IF NOT EXISTS idx_responsabili_tipo ON scadenze_bandi_responsabili_scadenze(tipo_responsabile);

-- 7. Trigger per updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Applica trigger alle nuove tabelle
CREATE TRIGGER update_scadenze_bandi_utenti_updated_at
    BEFORE UPDATE ON scadenze_bandi_utenti
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scadenze_bandi_gruppi_utenti_updated_at
    BEFORE UPDATE ON scadenze_bandi_gruppi_utenti
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Inserisci alcuni dati di esempio
INSERT INTO scadenze_bandi_utenti (nome, cognome, email, ruolo) VALUES
('Admin', 'Sistema', 'admin@blmproject.com', 'admin'),
('Marco', 'Rossi', 'marco.rossi@blmproject.com', 'responsabile'),
('Anna', 'Verdi', 'anna.verdi@blmproject.com', 'utente'),
('Luca', 'Bianchi', 'luca.bianchi@blmproject.com', 'utente')
ON CONFLICT (email) DO NOTHING;

INSERT INTO scadenze_bandi_gruppi_utenti (nome, descrizione, colore_hex) VALUES
('Team Amministrativo', 'Gestione pratiche amministrative e burocratiche', '#10B981'),
('Team Tecnico', 'Sviluppo e implementazione progetti', '#3B82F6'),
('Team Commerciale', 'Gestione clienti e opportunità', '#F59E0B')
ON CONFLICT (nome) DO NOTHING;

-- 9. Verifica che tutto sia stato creato correttamente
SELECT 'Tabelle create con successo!' as status;

-- Mostra le tabelle create
SELECT table_name
FROM information_schema.tables
WHERE table_name LIKE 'scadenze_bandi_%utenti%' OR table_name LIKE 'scadenze_bandi_%gruppi%' OR table_name LIKE 'scadenze_bandi_%responsabili%'
ORDER BY table_name;