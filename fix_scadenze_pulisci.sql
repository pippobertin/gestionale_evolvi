-- Fix per pulire le scadenze orfane e ricreare tutto correttamente

-- 1. Prima elimina tutte le scadenze orfane per evitare conflitti
DO $$
BEGIN
    -- Elimina le foreign key per poter pulire i dati
    ALTER TABLE scadenze_bandi_scadenze DROP CONSTRAINT IF EXISTS scadenze_bandi_scadenze_progetto_id_fkey;
    ALTER TABLE scadenze_bandi_scadenze DROP CONSTRAINT IF EXISTS scadenze_bandi_scadenze_cliente_id_fkey;

    RAISE NOTICE 'Foreign key eliminate per pulizia dati';
END $$;

-- 2. Pulisce tutte le scadenze esistenti per ricominciare da capo
TRUNCATE TABLE scadenze_bandi_scadenze CASCADE;

-- 3. Assicura che le colonne esistano
ALTER TABLE scadenze_bandi_scadenze
ADD COLUMN IF NOT EXISTS progetto_id UUID,
ADD COLUMN IF NOT EXISTS cliente_id UUID,
ADD COLUMN IF NOT EXISTS titolo TEXT;

-- 4. Ricrea le foreign key pulite
ALTER TABLE scadenze_bandi_scadenze
ADD CONSTRAINT scadenze_bandi_scadenze_progetto_id_fkey
FOREIGN KEY (progetto_id) REFERENCES scadenze_bandi_progetti(id) ON DELETE CASCADE;

ALTER TABLE scadenze_bandi_scadenze
ADD CONSTRAINT scadenze_bandi_scadenze_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;

-- 5. Ricrea la vista scadenze enhanced
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

-- 6. Ricrea la vista alert
CREATE OR REPLACE VIEW scadenze_alert_view AS
SELECT *
FROM scadenze_enhanced_simple
WHERE urgenza IN ('URGENTE', 'IMMINENTE')
AND stato IN ('non_iniziata', 'in_corso')
ORDER BY giorni_rimanenti ASC;

-- 7. Ora genera le scadenze automatiche per tutti i progetti esistenti
DO $$
DECLARE
    progetto_record RECORD;
BEGIN
    -- Per ogni progetto esistente, crea le scadenze automatiche
    FOR progetto_record IN SELECT id FROM scadenze_bandi_progetti LOOP
        BEGIN
            PERFORM crea_scadenze_progetto(progetto_record.id);
            RAISE NOTICE 'Scadenze create per progetto: %', progetto_record.id;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Errore creando scadenze per progetto %: %', progetto_record.id, SQLERRM;
        END;
    END LOOP;
END $$;

-- 8. Aggiunge qualche scadenza di esempio manuale per test
INSERT INTO scadenze_bandi_scadenze (
    cliente_id,
    tipologia_scadenza_id,
    titolo,
    data_scadenza,
    stato,
    priorita,
    responsabile_email,
    note
)
SELECT
    c.id as cliente_id,
    ts.id as tipologia_scadenza_id,
    'Scadenza Test Manuale' as titolo,
    CURRENT_DATE + INTERVAL '15 days' as data_scadenza,
    'non_iniziata' as stato,
    'media' as priorita,
    'test@blmproject.it' as responsabile_email,
    'Scadenza di test creata automaticamente' as note
FROM scadenze_bandi_clienti c
CROSS JOIN scadenze_bandi_tipologie_scadenze ts
WHERE ts.nome = 'Generale'
LIMIT 1;

-- Se non esiste la tipologia "Generale", la crea
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM scadenze_bandi_tipologie_scadenze WHERE nome = 'Generale') THEN
        INSERT INTO scadenze_bandi_tipologie_scadenze (nome, descrizione)
        VALUES ('Generale', 'Scadenze generali non specifiche');
    END IF;
END $$;

-- 9. Aggiunge indici
CREATE INDEX IF NOT EXISTS idx_scadenze_progetto ON scadenze_bandi_scadenze(progetto_id);
CREATE INDEX IF NOT EXISTS idx_scadenze_cliente ON scadenze_bandi_scadenze(cliente_id);
CREATE INDEX IF NOT EXISTS idx_scadenze_data ON scadenze_bandi_scadenze(data_scadenza);
CREATE INDEX IF NOT EXISTS idx_scadenze_stato ON scadenze_bandi_scadenze(stato);

DO $$
BEGIN
    RAISE NOTICE '===================================';
    RAISE NOTICE 'SCADENZE PULITE E RICREATE!';
    RAISE NOTICE 'Tutte le scadenze orfane eliminate';
    RAISE NOTICE 'Foreign key ricreate correttamente';
    RAISE NOTICE 'Scadenze automatiche generate per i progetti';
    RAISE NOTICE '===================================';
END $$;