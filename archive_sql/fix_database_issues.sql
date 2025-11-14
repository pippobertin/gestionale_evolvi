-- Fix database issues for save problems

-- 0. Create missing ENUM types if they don't exist
DO $$ BEGIN
    CREATE TYPE scadenze_bandi_dimensione_azienda AS ENUM ('MICRO', 'PICCOLA', 'MEDIA', 'GRANDE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE scadenze_bandi_categoria_evolvi AS ENUM ('BASE', 'PREMIUM', 'BUSINESS', 'ENTERPRISE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE scadenze_bandi_stato_bando AS ENUM ('attivo', 'archiviato');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE scadenze_bandi_stato_progetto AS ENUM ('attivo', 'completato', 'sospeso');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE scadenze_bandi_stato_scadenza AS ENUM ('non_iniziata', 'in_corso', 'completata', 'annullata');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE scadenze_bandi_priorita AS ENUM ('bassa', 'media', 'alta', 'critica');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Create missing dashboard view (only if all required tables exist)
-- For now, create a simple view that uses only existing clienti table
CREATE OR REPLACE VIEW scadenze_bandi_dashboard AS
SELECT
    c.id,
    NOW() as data_scadenza,
    'non_iniziata'::TEXT as stato,
    'media'::TEXT as priorita,
    c.email as responsabile_email,
    'Dashboard temporanea'::TEXT as nota_scadenza,
    'Generale'::TEXT as tipo_scadenza,
    '#3B82F6'::TEXT as colore_hex,
    c.denominazione as nome_progetto,
    'Bando Generale'::TEXT as nome_bando,
    c.denominazione as nome_cliente,
    c.email as email_cliente,
    0 as giorni_rimanenti
FROM scadenze_bandi_clienti c
LIMIT 0; -- Empty view for now, just to avoid errors

-- 2. Add missing columns to clienti table
ALTER TABLE scadenze_bandi_clienti
ADD COLUMN IF NOT EXISTS legale_rappresentante TEXT;

ALTER TABLE scadenze_bandi_clienti
ADD COLUMN IF NOT EXISTS data_bilancio_consolidato DATE;

-- 3. Create function to get client list with all needed fields
CREATE OR REPLACE FUNCTION get_clienti_list()
RETURNS TABLE (
    id UUID,
    denominazione TEXT,
    partita_iva TEXT,
    email TEXT,
    telefono TEXT,
    dimensione scadenze_bandi_dimensione_azienda,
    ultimo_fatturato DECIMAL,
    numero_dipendenti INTEGER,
    categoria_evolvi scadenze_bandi_categoria_evolvi,
    scadenza_evolvi DATE,
    legale_rappresentante TEXT,
    numero_progetti BIGINT,
    citta_fatturazione TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.denominazione,
        c.partita_iva,
        c.email,
        c.telefono,
        c.dimensione,
        c.ultimo_fatturato,
        c.numero_dipendenti,
        c.categoria_evolvi,
        c.scadenza_evolvi,
        c.legale_rappresentante,
        COUNT(p.id) AS numero_progetti,
        c.citta_fatturazione,
        c.created_at
    FROM scadenze_bandi_clienti c
    LEFT JOIN scadenze_bandi_progetti p ON c.id = p.cliente_id
    GROUP BY c.id, c.denominazione, c.partita_iva, c.email, c.telefono,
             c.dimensione, c.ultimo_fatturato, c.numero_dipendenti,
             c.categoria_evolvi, c.scadenza_evolvi, c.legale_rappresentante,
             c.citta_fatturazione, c.created_at
    ORDER BY c.denominazione;
END;
$$ LANGUAGE plpgsql;