-- Fix per ripristinare le foreign key delle scadenze
-- Risolve i problemi di collegamento dopo la ricreazione della tabella progetti

-- 1. Prima verifica lo stato delle foreign key esistenti
DO $$
BEGIN
    -- Elimina le foreign key esistenti se ci sono problemi
    ALTER TABLE scadenze_bandi_scadenze DROP CONSTRAINT IF EXISTS scadenze_bandi_scadenze_progetto_id_fkey;
    ALTER TABLE scadenze_bandi_scadenze DROP CONSTRAINT IF EXISTS scadenze_bandi_scadenze_cliente_id_fkey;

    RAISE NOTICE 'Foreign key esistenti eliminate';
END $$;

-- 2. Aggiunge le colonne se non esistono
ALTER TABLE scadenze_bandi_scadenze
ADD COLUMN IF NOT EXISTS progetto_id UUID,
ADD COLUMN IF NOT EXISTS cliente_id UUID,
ADD COLUMN IF NOT EXISTS titolo TEXT;

-- 3. Ricrea le foreign key corrette
ALTER TABLE scadenze_bandi_scadenze
ADD CONSTRAINT scadenze_bandi_scadenze_progetto_id_fkey
FOREIGN KEY (progetto_id) REFERENCES scadenze_bandi_progetti(id) ON DELETE CASCADE;

ALTER TABLE scadenze_bandi_scadenze
ADD CONSTRAINT scadenze_bandi_scadenze_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;

-- 4. Ricrea la vista scadenze enhanced che il frontend usa
CREATE OR REPLACE VIEW scadenze_enhanced_simple AS
SELECT
    s.*,
    -- Calcola giorni rimanenti
    (s.data_scadenza::date - CURRENT_DATE) as giorni_rimanenti,

    -- Calcola urgenza
    CASE
        WHEN (s.data_scadenza::date - CURRENT_DATE) <= 2 THEN 'URGENTE'
        WHEN (s.data_scadenza::date - CURRENT_DATE) <= 7 THEN 'IMMINENTE'
        ELSE 'NORMALE'
    END as urgenza,

    -- Info progetto collegato
    p.titolo_progetto,
    p.codice_progetto,

    -- Info cliente collegato
    c.denominazione as cliente_denominazione,

    -- Info tipologia
    t.nome as tipologia_nome

FROM scadenze_bandi_scadenze s
LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
LEFT JOIN scadenze_bandi_clienti c ON s.cliente_id = c.id
LEFT JOIN scadenze_bandi_tipologie_scadenze t ON s.tipologia_scadenza_id = t.id;

-- 5. Ricrea anche la vista alert
CREATE OR REPLACE VIEW scadenze_alert_view AS
SELECT *
FROM scadenze_enhanced_simple
WHERE urgenza IN ('URGENTE', 'IMMINENTE')
AND stato IN ('non_iniziata', 'in_corso')
ORDER BY giorni_rimanenti ASC;

-- 6. Ora esegue la funzione per creare le scadenze automatiche per il progetto esistente
DO $$
DECLARE
    progetto_id_esistente UUID;
BEGIN
    -- Trova il progetto esistente
    SELECT id INTO progetto_id_esistente
    FROM scadenze_bandi_progetti
    WHERE codice_progetto = 'PROJ-INN-2024-001';

    IF progetto_id_esistente IS NOT NULL THEN
        -- Elimina eventuali scadenze duplicate
        DELETE FROM scadenze_bandi_scadenze WHERE progetto_id = progetto_id_esistente;

        -- Crea le scadenze automatiche
        PERFORM crea_scadenze_progetto(progetto_id_esistente);

        RAISE NOTICE 'Scadenze automatiche ricreate per progetto: %', progetto_id_esistente;
    ELSE
        RAISE NOTICE 'Progetto non trovato';
    END IF;
END $$;

-- 7. Aggiunge indici per performance
CREATE INDEX IF NOT EXISTS idx_scadenze_progetto ON scadenze_bandi_scadenze(progetto_id);
CREATE INDEX IF NOT EXISTS idx_scadenze_cliente ON scadenze_bandi_scadenze(cliente_id);
CREATE INDEX IF NOT EXISTS idx_scadenze_data ON scadenze_bandi_scadenze(data_scadenza);
CREATE INDEX IF NOT EXISTS idx_scadenze_stato ON scadenze_bandi_scadenze(stato);

DO $$
BEGIN
    RAISE NOTICE '===================================';
    RAISE NOTICE 'SCADENZE SISTEMATE!';
    RAISE NOTICE 'Foreign key ricreate, viste aggiornate';
    RAISE NOTICE 'Scadenze automatiche generate';
    RAISE NOTICE '===================================';
END $$;