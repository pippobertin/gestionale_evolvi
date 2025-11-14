-- Fix tabella legale rappresentante per autocompilazione

-- Verifica se tabella esiste già
SELECT 'VERIFICA TABELLA LEGALE RAPPRESENTANTE:' as info;
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'scadenze_bandi_legale_rappresentante'
) as tabella_esiste;

-- Crea tabella se non esiste
CREATE TABLE IF NOT EXISTS scadenze_bandi_legale_rappresentante (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    cognome VARCHAR(255) NOT NULL,
    codice_fiscale VARCHAR(16),
    data_nascita DATE,
    luogo_nascita VARCHAR(255),
    indirizzo_residenza TEXT,
    telefono VARCHAR(50),
    email VARCHAR(255),
    qualifica VARCHAR(255) DEFAULT 'Legale Rappresentante',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indici per performance
    UNIQUE(cliente_id, codice_fiscale),
    INDEX idx_legale_rappresentante_cliente (cliente_id),
    INDEX idx_legale_rappresentante_cf (codice_fiscale)
);

-- Aggiungi trigger per updated_at
CREATE OR REPLACE FUNCTION update_legale_rappresentante_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_legale_rappresentante_updated_at ON scadenze_bandi_legale_rappresentante;
CREATE TRIGGER trigger_update_legale_rappresentante_updated_at
    BEFORE UPDATE ON scadenze_bandi_legale_rappresentante
    FOR EACH ROW EXECUTE FUNCTION update_legale_rappresentante_updated_at();

-- Inserisci un legale rappresentante di esempio per BLM Project
DO $$
DECLARE
    cliente_blm_id UUID;
    legale_exists BOOLEAN;
BEGIN
    -- Trova cliente BLM Project
    SELECT id INTO cliente_blm_id
    FROM scadenze_bandi_clienti
    WHERE denominazione ILIKE '%blm%project%' OR denominazione ILIKE '%blm%'
    LIMIT 1;

    IF cliente_blm_id IS NOT NULL THEN
        -- Verifica se esiste già un legale rappresentante
        SELECT EXISTS (
            SELECT FROM scadenze_bandi_legale_rappresentante
            WHERE cliente_id = cliente_blm_id
        ) INTO legale_exists;

        IF NOT legale_exists THEN
            -- Inserisci legale rappresentante di esempio
            INSERT INTO scadenze_bandi_legale_rappresentante (
                cliente_id,
                nome,
                cognome,
                codice_fiscale,
                qualifica,
                email,
                telefono
            ) VALUES (
                cliente_blm_id,
                'Filippo',
                'Bertin',
                'BRTFPP80A01H501Z', -- Esempio
                'Legale Rappresentante',
                'filippo@blmproject.com',
                '+39 123 456 7890'
            );

            RAISE NOTICE '✅ Legale rappresentante creato per cliente BLM';
        ELSE
            RAISE NOTICE '✅ Legale rappresentante già esistente';
        END IF;
    ELSE
        RAISE NOTICE '⚠️ Cliente BLM non trovato - inserimento legale rappresentante saltato';
    END IF;
END $$;

-- Verifica risultato
DO $$
DECLARE
    tabella_exists BOOLEAN;
    record_count INTEGER;
BEGIN
    -- Controlla tabella
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'scadenze_bandi_legale_rappresentante'
    ) INTO tabella_exists;

    IF tabella_exists THEN
        SELECT COUNT(*) INTO record_count
        FROM scadenze_bandi_legale_rappresentante;

        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ TABELLA LEGALE RAPPRESENTANTE CREATA';
        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ Tabella: scadenze_bandi_legale_rappresentante';
        RAISE NOTICE '✅ Record inseriti: %', record_count;
        RAISE NOTICE '✅ Autocompilazione ora funzionante!';
        RAISE NOTICE '🎯 Riprova il bottone robot nel frontend';
        RAISE NOTICE '========================================';
    ELSE
        RAISE EXCEPTION 'Errore: Tabella non creata correttamente';
    END IF;
END $$;