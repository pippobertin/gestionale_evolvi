-- Fix completo e sicuro - corregge tutti i problemi
-- Eseguire dopo l'upgrade principale

-- 1. Prima assicuriamoci che la colonna cliente_id esista
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'cliente_id'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN cliente_id UUID;
        RAISE NOTICE 'Aggiunta colonna cliente_id mancante';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'titolo'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN titolo VARCHAR(255);
        RAISE NOTICE 'Aggiunta colonna titolo mancante';
    END IF;
END $$;

-- 2. Popoliamo cliente_id se è vuoto
DO $$
BEGIN
    -- Popola cliente_id dalle relazioni progetto esistenti
    UPDATE scadenze_bandi_scadenze s
    SET cliente_id = p.cliente_id
    FROM scadenze_bandi_progetti p
    WHERE s.progetto_id = p.id
    AND s.cliente_id IS NULL;

    -- Popola titolo dalle note se è vuoto
    UPDATE scadenze_bandi_scadenze
    SET titolo = SUBSTRING(COALESCE(note, 'Scadenza'), 1, 100)
    WHERE titolo IS NULL;

    RAISE NOTICE 'Popolati i campi mancanti';
END $$;

-- 3. Correggi la funzione giorni_rimanenti
CREATE OR REPLACE FUNCTION giorni_rimanenti(data_scadenza_input TIMESTAMP WITH TIME ZONE)
RETURNS INTEGER AS $$
BEGIN
    RETURN (data_scadenza_input::date - CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- Versione per DATE
CREATE OR REPLACE FUNCTION giorni_rimanenti(data_scadenza_input DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN (data_scadenza_input - CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- 4. Crea una vista sicura che verifica l'esistenza delle colonne
CREATE OR REPLACE VIEW scadenze_bandi_scadenze_enhanced AS
SELECT
    s.id,
    s.progetto_id,
    s.tipologia_scadenza_id,
    s.data_scadenza,
    s.stato,
    s.priorita,
    s.responsabile_email,
    s.note,
    s.completata_da,
    s.completata_il,
    s.giorni_preavviso,
    s.alert_inviati,
    s.created_at,
    s.updated_at,
    -- Campi aggiuntivi (se esistono)
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'titolo'
    ) THEN s.titolo ELSE SUBSTRING(COALESCE(s.note, 'Scadenza'), 1, 100) END as titolo,

    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'cliente_id'
    ) THEN s.cliente_id ELSE p.cliente_id END as cliente_id,

    -- Calcoli
    giorni_rimanenti(s.data_scadenza) as giorni_rimanenti,
    CASE
        WHEN s.stato = 'completata' THEN 'COMPLETATA'
        WHEN giorni_rimanenti(s.data_scadenza) < 0 THEN 'SCADUTA'
        WHEN giorni_rimanenti(s.data_scadenza) <= 2 THEN 'URGENTE'
        WHEN giorni_rimanenti(s.data_scadenza) <= 7 THEN 'IMMINENTE'
        WHEN giorni_rimanenti(s.data_scadenza) <= 15 THEN 'PROSSIMA'
        ELSE 'NORMALE'
    END as urgenza,

    -- Info cliente (sempre tramite progetto per sicurezza)
    c.denominazione as cliente_denominazione,
    c.email as cliente_email,
    c.telefono as cliente_telefono,
    c.partita_iva as cliente_piva,
    c.codice_fiscale as cliente_codice_fiscale,
    c.dimensione as cliente_dimensione,

    -- Info progetto e bando
    p.id as progetto_collegato_id,
    b.nome as bando_collegato_nome,
    ts.nome as tipologia_scadenza_nome
FROM scadenze_bandi_scadenze s
LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
LEFT JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id
LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
LEFT JOIN scadenze_bandi_tipologie_scadenze ts ON s.tipologia_scadenza_id = ts.id;

-- 5. Funzione per alert (versione semplificata e sicura)
CREATE OR REPLACE FUNCTION get_scadenze_per_alert()
RETURNS TABLE (
    id UUID,
    titolo TEXT,
    data_scadenza TIMESTAMP WITH TIME ZONE,
    giorni_rimanenti INTEGER,
    cliente_denominazione TEXT,
    email_responsabile TEXT,
    tipo_scadenza TEXT,
    cliente_email TEXT,
    urgenza TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        COALESCE(s.titolo, SUBSTRING(COALESCE(s.note, 'Scadenza'), 1, 100)) as titolo,
        s.data_scadenza,
        giorni_rimanenti(s.data_scadenza) as giorni_rimanenti,
        c.denominazione as cliente_denominazione,
        s.responsabile_email,
        COALESCE(ts.nome, 'ALTRA') as tipo_scadenza,
        c.email as cliente_email,
        CASE
            WHEN giorni_rimanenti(s.data_scadenza) <= 2 THEN 'URGENTE'
            WHEN giorni_rimanenti(s.data_scadenza) <= 7 THEN 'IMMINENTE'
            ELSE 'PROSSIMA'
        END as urgenza
    FROM scadenze_bandi_scadenze s
    LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
    LEFT JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id
    LEFT JOIN scadenze_bandi_tipologie_scadenze ts ON s.tipologia_scadenza_id = ts.id
    WHERE s.stato IN ('non_iniziata', 'in_corso')
    AND giorni_rimanenti(s.data_scadenza) = ANY(s.giorni_preavviso)
    AND giorni_rimanenti(s.data_scadenza) >= 0
    ORDER BY giorni_rimanenti(s.data_scadenza) ASC;
END;
$$ LANGUAGE plpgsql;

-- 6. Crea la foreign key in modo sicuro (se mancante)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'cliente_id'
    ) THEN
        -- Prima pulisci dati non validi
        UPDATE scadenze_bandi_scadenze
        SET cliente_id = NULL
        WHERE cliente_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM scadenze_bandi_clienti c WHERE c.id = cliente_id
        );

        -- Poi aggiungi la foreign key se non esiste
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_scadenze_cliente_diretto'
        ) THEN
            ALTER TABLE scadenze_bandi_scadenze
            ADD CONSTRAINT fk_scadenze_cliente_diretto
            FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE SET NULL;

            RAISE NOTICE 'Aggiunta foreign key per cliente_id';
        END IF;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Errore nella foreign key: %, continuando...', SQLERRM;
END $$;

-- 7. Test finale che tutto funzioni
DO $$
DECLARE
    test_giorni INTEGER;
    scadenze_count INTEGER;
    urgenti_count INTEGER;
    alert_count INTEGER;
BEGIN
    -- Test della funzione giorni_rimanenti
    SELECT giorni_rimanenti(NOW() + INTERVAL '5 days') INTO test_giorni;
    RAISE NOTICE 'Test giorni_rimanenti: % (dovrebbe essere circa 5)', test_giorni;

    -- Test della vista
    SELECT COUNT(*) INTO scadenze_count FROM scadenze_bandi_scadenze_enhanced;
    RAISE NOTICE 'Scadenze totali in vista enhanced: %', scadenze_count;

    -- Test conteggio urgenti
    SELECT COUNT(*) INTO urgenti_count
    FROM scadenze_bandi_scadenze_enhanced
    WHERE urgenza IN ('URGENTE', 'IMMINENTE');
    RAISE NOTICE 'Scadenze urgenti/imminenti: %', urgenti_count;

    -- Test funzione alert
    SELECT COUNT(*) INTO alert_count FROM get_scadenze_per_alert();
    RAISE NOTICE 'Scadenze che necessitano alert: %', alert_count;

    RAISE NOTICE '=================================';
    RAISE NOTICE 'SISTEMA SCADENZE COMPLETATO!';
    RAISE NOTICE '=================================';
    RAISE NOTICE 'Puoi usare:';
    RAISE NOTICE '- SELECT * FROM scadenze_bandi_scadenze_enhanced;';
    RAISE NOTICE '- SELECT * FROM get_scadenze_per_alert();';
    RAISE NOTICE '=================================';
END $$;