-- Aggiunge campi per il legale rappresentante alla tabella clienti

-- 1. Aggiunge colonne per legale rappresentante
ALTER TABLE scadenze_bandi_clienti
ADD COLUMN IF NOT EXISTS legale_rappresentante_nome TEXT,
ADD COLUMN IF NOT EXISTS legale_rappresentante_cognome TEXT,
ADD COLUMN IF NOT EXISTS legale_rappresentante_codice_fiscale TEXT,
ADD COLUMN IF NOT EXISTS legale_rappresentante_data_nascita DATE,
ADD COLUMN IF NOT EXISTS legale_rappresentante_luogo_nascita TEXT,
ADD COLUMN IF NOT EXISTS legale_rappresentante_provincia_nascita TEXT,
ADD COLUMN IF NOT EXISTS legale_rappresentante_nazionalita TEXT DEFAULT 'Italia',
ADD COLUMN IF NOT EXISTS legale_rappresentante_indirizzo TEXT,
ADD COLUMN IF NOT EXISTS legale_rappresentante_cap TEXT,
ADD COLUMN IF NOT EXISTS legale_rappresentante_citta TEXT,
ADD COLUMN IF NOT EXISTS legale_rappresentante_provincia TEXT,
ADD COLUMN IF NOT EXISTS legale_rappresentante_email TEXT,
ADD COLUMN IF NOT EXISTS legale_rappresentante_telefono TEXT,
ADD COLUMN IF NOT EXISTS legale_rappresentante_note TEXT;

-- 2. Crea indice per ricerche
CREATE INDEX IF NOT EXISTS idx_legali_rappresentanti_cf
ON scadenze_bandi_clienti(legale_rappresentante_codice_fiscale);

-- 3. Aggiorna vista clienti se esiste per includere dati legale rappresentante
CREATE OR REPLACE VIEW scadenze_bandi_clienti_completa AS
SELECT
    c.*,
    -- Concatena nome e cognome per display facile
    CASE
        WHEN c.legale_rappresentante_nome IS NOT NULL AND c.legale_rappresentante_cognome IS NOT NULL
        THEN c.legale_rappresentante_nome || ' ' || c.legale_rappresentante_cognome
        ELSE NULL
    END as legale_rappresentante_completo,

    -- Calcola età del legale rappresentante se ha data di nascita
    CASE
        WHEN c.legale_rappresentante_data_nascita IS NOT NULL
        THEN DATE_PART('year', AGE(c.legale_rappresentante_data_nascita))
        ELSE NULL
    END as legale_rappresentante_eta

FROM scadenze_bandi_clienti c;

-- 4. Aggiorna anche la vista con dimensione aggregata se esiste
DO $$
BEGIN
    -- Verifica se esiste la vista aggregata
    IF EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_name = 'scadenze_bandi_clienti_con_dimensione_aggregata'
    ) THEN
        -- Ricrea la vista includendo i nuovi campi
        DROP VIEW IF EXISTS scadenze_bandi_clienti_con_dimensione_aggregata CASCADE;

        CREATE VIEW scadenze_bandi_clienti_con_dimensione_aggregata AS
        SELECT
            c.*,
            -- Legale rappresentante completo
            CASE
                WHEN c.legale_rappresentante_nome IS NOT NULL AND c.legale_rappresentante_cognome IS NOT NULL
                THEN c.legale_rappresentante_nome || ' ' || c.legale_rappresentante_cognome
                ELSE NULL
            END as legale_rappresentante_completo,

            -- Dimensione calcolata (logica semplificata)
            CASE
                WHEN c.ula < 10 AND (c.ultimo_fatturato <= 2000000 OR c.attivo_bilancio <= 2000000) THEN 'MICRO'
                WHEN c.ula < 50 AND (c.ultimo_fatturato <= 10000000 OR c.attivo_bilancio <= 10000000) THEN 'PICCOLA'
                WHEN c.ula < 250 AND (c.ultimo_fatturato <= 50000000 OR c.attivo_bilancio <= 43000000) THEN 'MEDIA'
                ELSE 'GRANDE'
            END as dimensione_aggregata,

            0 as numero_collegamenti -- Placeholder per compatibilità

        FROM scadenze_bandi_clienti c;

        RAISE NOTICE 'Vista dimensione aggregata ricreata con campi legale rappresentante';
    END IF;
END $$;

-- 5. Popola alcuni dati di esempio per test
UPDATE scadenze_bandi_clienti
SET
    legale_rappresentante_nome = 'Mario',
    legale_rappresentante_cognome = 'Rossi',
    legale_rappresentante_codice_fiscale = 'RSSMRA80A01H501X',
    legale_rappresentante_data_nascita = '1980-01-01',
    legale_rappresentante_luogo_nascita = 'Milano',
    legale_rappresentante_provincia_nascita = 'MI',
    legale_rappresentante_nazionalita = 'Italia',
    legale_rappresentante_email = 'mario.rossi@example.com',
    legale_rappresentante_telefono = '+39 333 1234567'
WHERE denominazione = 'Test Company SpA'
AND legale_rappresentante_nome IS NULL; -- Solo se non è già popolato

DO $$
BEGIN
    RAISE NOTICE '===================================';
    RAISE NOTICE 'CAMPI LEGALE RAPPRESENTANTE AGGIUNTI!';
    RAISE NOTICE '===================================';
    RAISE NOTICE 'Aggiunte 14 colonne per legale rappresentante';
    RAISE NOTICE 'Creata vista completa clienti';
    RAISE NOTICE 'Aggiornata vista dimensione aggregata';
    RAISE NOTICE 'Popolati dati di esempio per Test Company SpA';
    RAISE NOTICE '===================================';
END $$;