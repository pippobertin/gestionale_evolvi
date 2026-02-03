-- Sistema semplificato: gruppo diretto nella tabella utenti + relazione many-to-many per casi speciali

-- 1. Tabella gruppi utenti
CREATE TABLE IF NOT EXISTS scadenze_bandi_gruppi_utenti (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descrizione TEXT,
    colore_hex VARCHAR(7) DEFAULT '#3B82F6',
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Aggiungi campo gruppo_id direttamente nella tabella utenti (gruppo principale)
ALTER TABLE scadenze_bandi_utenti
ADD COLUMN IF NOT EXISTS gruppo_id UUID REFERENCES scadenze_bandi_gruppi_utenti(id);

-- 3. Tabella per associazioni aggiuntive (many-to-many) - per utenti in multipli gruppi
CREATE TABLE IF NOT EXISTS scadenze_bandi_utenti_gruppi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    utente_id UUID REFERENCES scadenze_bandi_utenti(id) ON DELETE CASCADE,
    gruppo_id UUID REFERENCES scadenze_bandi_gruppi_utenti(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(utente_id, gruppo_id)
);

-- 4. Tabella responsabili scadenze
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

-- 5. Campo JSON nel template scadenze
ALTER TABLE scadenze_bandi_template_scadenze
ADD COLUMN IF NOT EXISTS responsabile_default_json JSONB;

-- 6. Indici
CREATE INDEX IF NOT EXISTS idx_utenti_gruppo ON scadenze_bandi_utenti(gruppo_id);
CREATE INDEX IF NOT EXISTS idx_gruppi_attivo ON scadenze_bandi_gruppi_utenti(attivo);
CREATE INDEX IF NOT EXISTS idx_responsabili_scadenza ON scadenze_bandi_responsabili_scadenze(scadenza_id);

-- 7. Inserisci gruppi
INSERT INTO scadenze_bandi_gruppi_utenti (nome, descrizione, colore_hex) VALUES
('Team Amministrativo', 'Gestione pratiche amministrative', '#10B981'),
('Team Tecnico', 'Sviluppo e implementazione', '#3B82F6'),
('Team Commerciale', 'Gestione clienti', '#F59E0B'),
('Direzione', 'Management e decisioni', '#8B5CF6')
ON CONFLICT (nome) DO NOTHING;

-- 8. Verifica
SELECT 'Sistema gruppi semplificato creato!' as status;

-- Mostra struttura utenti con gruppi
SELECT
    u.nome,
    u.cognome,
    u.email,
    u.ruolo,
    g.nome as gruppo_principale
FROM scadenze_bandi_utenti u
LEFT JOIN scadenze_bandi_gruppi_utenti g ON u.gruppo_id = g.id
ORDER BY u.nome;