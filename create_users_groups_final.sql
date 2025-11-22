-- Sistema di gestione utenti e gruppi per responsabili scadenze (versione finale)

-- 1. Aggiorna tabella utenti esistente con le colonne mancanti
ALTER TABLE scadenze_bandi_utenti
ADD COLUMN IF NOT EXISTS ruolo VARCHAR(50) DEFAULT 'utente',
ADD COLUMN IF NOT EXISTS attivo BOOLEAN DEFAULT true;

-- Aggiungi il vincolo CHECK per il ruolo se non esiste
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'scadenze_bandi_utenti_ruolo_check'
    ) THEN
        ALTER TABLE scadenze_bandi_utenti
        ADD CONSTRAINT scadenze_bandi_utenti_ruolo_check
        CHECK (ruolo IN ('admin', 'utente', 'responsabile'));
    END IF;
END $$;

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

-- 4. Tabella per gestire i responsabili delle scadenze
CREATE TABLE IF NOT EXISTS scadenze_bandi_responsabili_scadenze (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scadenza_id UUID REFERENCES scadenze_bandi_scadenze(id) ON DELETE CASCADE,
    tipo_responsabile VARCHAR(20) NOT NULL CHECK (tipo_responsabile IN ('utente', 'gruppo', 'tutti')),
    utente_id UUID REFERENCES scadenze_bandi_utenti(id) ON DELETE CASCADE,
    gruppo_id UUID REFERENCES scadenze_bandi_gruppi_utenti(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Vincoli di integrità
    CHECK (
        (tipo_responsabile = 'utente' AND utente_id IS NOT NULL AND gruppo_id IS NULL) OR
        (tipo_responsabile = 'gruppo' AND gruppo_id IS NOT NULL AND utente_id IS NULL) OR
        (tipo_responsabile = 'tutti' AND utente_id IS NULL AND gruppo_id IS NULL)
    )
);

-- 5. Aggiorna tabella template scadenze
ALTER TABLE scadenze_bandi_template_scadenze
ADD COLUMN IF NOT EXISTS responsabile_default_json JSONB;

-- 6. Indici per performance
CREATE INDEX IF NOT EXISTS idx_utenti_email ON scadenze_bandi_utenti(email);
CREATE INDEX IF NOT EXISTS idx_utenti_attivo ON scadenze_bandi_utenti(attivo) WHERE attivo = true;
CREATE INDEX IF NOT EXISTS idx_utenti_ruolo ON scadenze_bandi_utenti(ruolo);
CREATE INDEX IF NOT EXISTS idx_gruppi_attivo ON scadenze_bandi_gruppi_utenti(attivo) WHERE attivo = true;
CREATE INDEX IF NOT EXISTS idx_responsabili_scadenza ON scadenze_bandi_responsabili_scadenze(scadenza_id);
CREATE INDEX IF NOT EXISTS idx_responsabili_tipo ON scadenze_bandi_responsabili_scadenze(tipo_responsabile);

-- 7. Trigger per updated_at (solo se non esistono)
DO $$
BEGIN
    -- Trigger per gruppi
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_scadenze_bandi_gruppi_utenti_updated_at') THEN
        CREATE TRIGGER update_scadenze_bandi_gruppi_utenti_updated_at
            BEFORE UPDATE ON scadenze_bandi_gruppi_utenti
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 8. Inserisci gruppi di esempio
INSERT INTO scadenze_bandi_gruppi_utenti (nome, descrizione, colore_hex) VALUES
('Team Amministrativo', 'Gestione pratiche amministrative e burocratiche', '#10B981'),
('Team Tecnico', 'Sviluppo e implementazione progetti', '#3B82F6'),
('Team Commerciale', 'Gestione clienti e opportunità', '#F59E0B')
ON CONFLICT (nome) DO NOTHING;

-- 9. Aggiorna utenti esistenti con ruoli (solo se ruolo è NULL)
UPDATE scadenze_bandi_utenti
SET ruolo = 'admin', attivo = true
WHERE email = 'admin@blmproject.com' AND ruolo IS NULL;

-- 10. Inserisci utenti di esempio aggiuntivi (solo se non esistono)
INSERT INTO scadenze_bandi_utenti (nome, cognome, email, ruolo, attivo) VALUES
('Admin', 'Sistema', 'admin@blmproject.com', 'admin', true),
('Marco', 'Rossi', 'marco.rossi@blmproject.com', 'responsabile', true),
('Anna', 'Verdi', 'anna.verdi@blmproject.com', 'utente', true),
('Luca', 'Bianchi', 'luca.bianchi@blmproject.com', 'utente', true)
ON CONFLICT (email) DO NOTHING;

-- 11. Verifica risultato finale
SELECT 'Sistema utenti e gruppi creato con successo!' as status;

SELECT
    (SELECT COUNT(*) FROM scadenze_bandi_utenti) as utenti_totali,
    (SELECT COUNT(*) FROM scadenze_bandi_gruppi_utenti) as gruppi_totali,
    (SELECT COUNT(*) FROM scadenze_bandi_utenti WHERE ruolo IS NOT NULL) as utenti_con_ruolo;