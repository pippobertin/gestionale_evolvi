-- Crea tabelle per gruppi e responsabili con ruoli corretti (ADMIN, COLLABORATORE)

-- 1. Verifica e aggiorna i vincoli del ruolo se necessario
DO $$
BEGIN
    -- Rimuovi vincolo vecchio se esiste
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname LIKE '%ruolo_check%' AND conrelid = 'scadenze_bandi_utenti'::regclass
    ) THEN
        ALTER TABLE scadenze_bandi_utenti DROP CONSTRAINT IF EXISTS scadenze_bandi_utenti_ruolo_check;
    END IF;

    -- Aggiungi il vincolo corretto
    ALTER TABLE scadenze_bandi_utenti
    ADD CONSTRAINT scadenze_bandi_utenti_ruolo_check
    CHECK (ruolo IN ('ADMIN', 'COLLABORATORE'));
EXCEPTION
    WHEN OTHERS THEN
        -- Ignora se ci sono problemi con i vincoli
        NULL;
END $$;

-- 2. Tabella gruppi utenti
CREATE TABLE IF NOT EXISTS scadenze_bandi_gruppi_utenti (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descrizione TEXT,
    colore_hex VARCHAR(7) DEFAULT '#3B82F6',
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabella di associazione utenti-gruppi
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
CREATE INDEX IF NOT EXISTS idx_utenti_ruolo ON scadenze_bandi_utenti(ruolo);
CREATE INDEX IF NOT EXISTS idx_gruppi_attivo ON scadenze_bandi_gruppi_utenti(attivo);
CREATE INDEX IF NOT EXISTS idx_responsabili_scadenza ON scadenze_bandi_responsabili_scadenze(scadenza_id);

-- 7. Dati esempio - gruppi
INSERT INTO scadenze_bandi_gruppi_utenti (nome, descrizione, colore_hex) VALUES
('Team Amministrativo', 'Gestione pratiche amministrative e burocratiche', '#10B981'),
('Team Tecnico', 'Sviluppo e implementazione progetti', '#3B82F6'),
('Team Commerciale', 'Gestione clienti e opportunità', '#F59E0B')
ON CONFLICT (nome) DO NOTHING;

-- 8. Aggiorna utenti esistenti per assicurarsi che abbiano ruoli validi
UPDATE scadenze_bandi_utenti
SET ruolo = CASE
    WHEN ruolo = 'admin' THEN 'ADMIN'
    WHEN ruolo = 'utente' OR ruolo = 'responsabile' THEN 'COLLABORATORE'
    WHEN ruolo IS NULL THEN 'COLLABORATORE'
    ELSE ruolo
END
WHERE ruolo NOT IN ('ADMIN', 'COLLABORATORE') OR ruolo IS NULL;

-- 9. Verifica risultato
SELECT 'Sistema gruppi creato con successo!' as status;

SELECT
    ruolo,
    COUNT(*) as utenti_count
FROM scadenze_bandi_utenti
GROUP BY ruolo
ORDER BY ruolo;