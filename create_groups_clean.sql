-- Crea solo le tabelle per gruppi responsabilità (i ruoli sistema restano invariati)

-- 1. Tabella gruppi utenti (per responsabilità scadenze)
CREATE TABLE IF NOT EXISTS scadenze_bandi_gruppi_utenti (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descrizione TEXT,
    colore_hex VARCHAR(7) DEFAULT '#3B82F6',
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabella di associazione utenti-gruppi (many-to-many)
CREATE TABLE IF NOT EXISTS scadenze_bandi_utenti_gruppi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    utente_id UUID REFERENCES scadenze_bandi_utenti(id) ON DELETE CASCADE,
    gruppo_id UUID REFERENCES scadenze_bandi_gruppi_utenti(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(utente_id, gruppo_id)
);

-- 3. Tabella responsabili scadenze
CREATE TABLE IF NOT EXISTS scadenze_bandi_responsabili_scadenze (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scadenza_id UUID REFERENCES scadenze_bandi_scadenze(id) ON DELETE CASCADE,
    tipo_responsabile VARCHAR(20) NOT NULL CHECK (tipo_responsabile IN ('utente', 'gruppo', 'tutti')),
    utente_id UUID REFERENCES scadenze_bandi_utenti(id) ON DELETE CASCADE,
    gruppo_id UUID REFERENCES scadenze_bandi_gruppi_utenti(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (
        (tipo_responsabile = 'utente' AND utente_id IS NOT NULL AND gruppo_id IS NULL) OR
        (tipo_responsabile = 'gruppo' AND gruppo_id IS NOT NULL AND utente_id IS NULL) OR
        (tipo_responsabile = 'tutti' AND utente_id IS NULL AND gruppo_id IS NULL)
    )
);

-- 4. Campo JSON nel template scadenze per responsabili default
ALTER TABLE scadenze_bandi_template_scadenze
ADD COLUMN IF NOT EXISTS responsabile_default_json JSONB;

-- 5. Indici per performance
CREATE INDEX IF NOT EXISTS idx_gruppi_attivo ON scadenze_bandi_gruppi_utenti(attivo);
CREATE INDEX IF NOT EXISTS idx_utenti_gruppi_utente ON scadenze_bandi_utenti_gruppi(utente_id);
CREATE INDEX IF NOT EXISTS idx_utenti_gruppi_gruppo ON scadenze_bandi_utenti_gruppi(gruppo_id);
CREATE INDEX IF NOT EXISTS idx_responsabili_scadenza ON scadenze_bandi_responsabili_scadenze(scadenza_id);

-- 6. Inserisci gruppi di esempio
INSERT INTO scadenze_bandi_gruppi_utenti (nome, descrizione, colore_hex) VALUES
('Team Amministrativo', 'Gestione pratiche amministrative e burocratiche', '#10B981'),
('Team Tecnico', 'Sviluppo e implementazione progetti', '#3B82F6'),
('Team Commerciale', 'Gestione clienti e opportunità', '#F59E0B'),
('Direzione', 'Management e decisioni strategiche', '#8B5CF6')
ON CONFLICT (nome) DO NOTHING;

-- 7. Verifica creazione
SELECT 'Sistema gruppi responsabilità creato!' as status;

SELECT
    nome,
    descrizione,
    colore_hex,
    attivo
FROM scadenze_bandi_gruppi_utenti
ORDER BY nome;