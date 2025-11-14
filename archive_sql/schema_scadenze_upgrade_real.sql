-- UPGRADE REALE dello schema scadenze esistente
-- Basato sulla struttura effettiva della tabella
-- Eseguire in ordine su Supabase

-- 1. Assicuriamoci che l'estensione UUID sia abilitata
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Creiamo i nuovi ENUM compatibili con quelli esistenti
DO $$
DECLARE
    enum_exists boolean;
BEGIN
    -- Nuovo ENUM per tipi di scadenza più specifici
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'scadenze_tipo_dettagliato'
    ) INTO enum_exists;

    IF NOT enum_exists THEN
        CREATE TYPE scadenze_tipo_dettagliato AS ENUM (
            'ACCETTAZIONE_DECRETO',
            'ACCETTAZIONE_PORTALE',
            'INIZIO_PROGETTO',
            'SCADENZA_MASSIMA_PROGETTO',
            'SCADENZA_RICHIESTA_ANTICIPO',
            'SCADENZA_RICHIESTA_SALDO',
            'RICHIESTA_ANTICIPO',
            'RICHIESTA_PROROGA',
            'APERTURA_RENDICONTAZIONE',
            'SCADENZA_RENDICONTAZIONE',
            'SCADENZA_INTERAZIONE',
            'FINE_PROGETTO',
            'ALTRA'
        );
        RAISE NOTICE 'Creato nuovo ENUM scadenze_tipo_dettagliato';
    END IF;
END $$;

-- 3. Aggiungiamo le colonne mancanti alla tabella esistente
DO $$
BEGIN
    -- Aggiungi titolo (campo che mancava)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'titolo'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN titolo VARCHAR(255);
        RAISE NOTICE 'Aggiunta colonna titolo';
    END IF;

    -- Aggiungi descrizione separata dalle note
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'descrizione'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN descrizione TEXT;
        RAISE NOTICE 'Aggiunta colonna descrizione';
    END IF;

    -- Aggiungi cliente_id diretto per semplificare i collegamenti
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'cliente_id'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN cliente_id UUID;
        RAISE NOTICE 'Aggiunta colonna cliente_id';
    END IF;

    -- Aggiungi tipo scadenza dettagliato
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'tipo_scadenza_dettagliato'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN tipo_scadenza_dettagliato scadenze_tipo_dettagliato;
        RAISE NOTICE 'Aggiunta colonna tipo_scadenza_dettagliato';
    END IF;

    -- Aggiungi campi per nomi display
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'bando_nome'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN bando_nome VARCHAR(255);
        RAISE NOTICE 'Aggiunta colonna bando_nome';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'progetto_nome'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN progetto_nome VARCHAR(255);
        RAISE NOTICE 'Aggiunta colonna progetto_nome';
    END IF;

    -- Aggiungi campi di gestione avanzata
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'documenti_richiesti'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN documenti_richiesti TEXT[];
        RAISE NOTICE 'Aggiunta colonna documenti_richiesti';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'importo_correlato'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN importo_correlato DECIMAL(15,2);
        RAISE NOTICE 'Aggiunta colonna importo_correlato';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'assegnato_a'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN assegnato_a VARCHAR(100);
        RAISE NOTICE 'Aggiunta colonna assegnato_a';
    END IF;

    -- Alert avanzato con JSON
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'alert_inviati_json'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN alert_inviati_json JSONB DEFAULT '{}';
        RAISE NOTICE 'Aggiunta colonna alert_inviati_json';
    END IF;

    -- Data completamento separata
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'data_completamento'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN data_completamento DATE;
        RAISE NOTICE 'Aggiunta colonna data_completamento';
    END IF;
END $$;

-- 4. Popoliamo i nuovi campi con dati dalle relazioni esistenti
DO $$
BEGIN
    -- Popola titolo dalle note esistenti (primi 100 caratteri)
    UPDATE scadenze_bandi_scadenze
    SET titolo = SUBSTRING(COALESCE(note, 'Scadenza'), 1, 100)
    WHERE titolo IS NULL;

    -- Popola descrizione dalle note complete
    UPDATE scadenze_bandi_scadenze
    SET descrizione = note
    WHERE descrizione IS NULL AND note IS NOT NULL;

    -- Popola cliente_id dalle relazioni progetto esistenti
    UPDATE scadenze_bandi_scadenze s
    SET cliente_id = p.cliente_id
    FROM scadenze_bandi_progetti p
    WHERE s.progetto_id = p.id
    AND s.cliente_id IS NULL;

    -- Popola nome progetto dalle relazioni esistenti
    UPDATE scadenze_bandi_scadenze s
    SET progetto_nome = CONCAT(COALESCE(b.nome, 'Progetto'), ' - ', COALESCE(c.denominazione, 'Cliente'))
    FROM scadenze_bandi_progetti p
    LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
    LEFT JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id
    WHERE s.progetto_id = p.id
    AND s.progetto_nome IS NULL;

    -- Popola bando_nome dalle relazioni esistenti
    UPDATE scadenze_bandi_scadenze s
    SET bando_nome = b.nome
    FROM scadenze_bandi_progetti p
    LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
    WHERE s.progetto_id = p.id
    AND s.bando_nome IS NULL;

    -- Assegna tipo scadenza dettagliato di default
    UPDATE scadenze_bandi_scadenze
    SET tipo_scadenza_dettagliato = 'ALTRA'::scadenze_tipo_dettagliato
    WHERE tipo_scadenza_dettagliato IS NULL;

    -- Popola assegnato_a da responsabile_email
    UPDATE scadenze_bandi_scadenze
    SET assegnato_a = SPLIT_PART(responsabile_email, '@', 1)
    WHERE assegnato_a IS NULL AND responsabile_email IS NOT NULL;

    RAISE NOTICE 'Popolati tutti i nuovi campi dalle relazioni esistenti';
END $$;

-- 5. Puliamo dati prima di aggiungere foreign key
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    -- Conta e pulisci cliente_id non validi
    SELECT COUNT(*) INTO invalid_count
    FROM scadenze_bandi_scadenze s
    WHERE s.cliente_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM scadenze_bandi_clienti c WHERE c.id = s.cliente_id
    );

    IF invalid_count > 0 THEN
        UPDATE scadenze_bandi_scadenze
        SET cliente_id = NULL
        WHERE cliente_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM scadenze_bandi_clienti c WHERE c.id = cliente_id
        );
        RAISE NOTICE 'Puliti % cliente_id non validi', invalid_count;
    ELSE
        RAISE NOTICE 'Tutti i cliente_id sono validi';
    END IF;
END $$;

-- 6. Aggiungiamo le foreign key per il collegamento clienti diretto
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_scadenze_cliente_diretto'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD CONSTRAINT fk_scadenze_cliente_diretto
        FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE SET NULL;

        RAISE NOTICE 'Aggiunta foreign key per cliente_id';
    END IF;
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Errore foreign key, eseguo pulizia aggiuntiva...';

        UPDATE scadenze_bandi_scadenze
        SET cliente_id = NULL
        WHERE cliente_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM scadenze_bandi_clienti c WHERE c.id = cliente_id
        );

        -- Riprova
        ALTER TABLE scadenze_bandi_scadenze
        ADD CONSTRAINT fk_scadenze_cliente_diretto
        FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE SET NULL;

        RAISE NOTICE 'Foreign key aggiunta dopo pulizia';
END $$;

-- 7. Funzione per calcolare giorni rimanenti (compatibile con TIMESTAMP)
CREATE OR REPLACE FUNCTION giorni_rimanenti(data_scadenza_input TIMESTAMP WITH TIME ZONE)
RETURNS INTEGER AS $$
BEGIN
    RETURN EXTRACT(DAY FROM (data_scadenza_input::date - CURRENT_DATE));
END;
$$ LANGUAGE plpgsql;

-- 8. Vista migliorata per scadenze con calcoli automatici
CREATE OR REPLACE VIEW scadenze_bandi_scadenze_enhanced AS
SELECT
    s.*,
    giorni_rimanenti(s.data_scadenza) as giorni_rimanenti,
    CASE
        WHEN s.stato = 'completata' THEN 'COMPLETATA'
        WHEN giorni_rimanenti(s.data_scadenza) < 0 THEN 'SCADUTA'
        WHEN giorni_rimanenti(s.data_scadenza) <= 2 THEN 'URGENTE'
        WHEN giorni_rimanenti(s.data_scadenza) <= 7 THEN 'IMMINENTE'
        WHEN giorni_rimanenti(s.data_scadenza) <= 15 THEN 'PROSSIMA'
        ELSE 'NORMALE'
    END as urgenza,
    -- Info cliente collegato (diretto o tramite progetto)
    COALESCE(c_diretto.denominazione, c_progetto.denominazione) as cliente_denominazione,
    COALESCE(c_diretto.email, c_progetto.email) as cliente_email,
    COALESCE(c_diretto.telefono, c_progetto.telefono) as cliente_telefono,
    COALESCE(c_diretto.partita_iva, c_progetto.partita_iva) as cliente_piva,
    COALESCE(c_diretto.codice_fiscale, c_progetto.codice_fiscale) as cliente_codice_fiscale,
    COALESCE(c_diretto.dimensione, c_progetto.dimensione) as cliente_dimensione,
    -- Info progetto e bando
    p.id as progetto_collegato_id,
    b.nome as bando_collegato_nome,
    ts.nome as tipologia_scadenza_nome
FROM scadenze_bandi_scadenze s
-- Cliente collegato direttamente
LEFT JOIN scadenze_bandi_clienti c_diretto ON s.cliente_id = c_diretto.id
-- Cliente collegato tramite progetto (fallback)
LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
LEFT JOIN scadenze_bandi_clienti c_progetto ON p.cliente_id = c_progetto.id
LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
-- Tipologia scadenza
LEFT JOIN scadenze_bandi_tipologie_scadenze ts ON s.tipologia_scadenza_id = ts.id;

-- 9. Funzione per ottenere scadenze che necessitano alert
CREATE OR REPLACE FUNCTION get_scadenze_per_alert()
RETURNS TABLE (
    id UUID,
    titolo VARCHAR(255),
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
        s.titolo,
        s.data_scadenza,
        giorni_rimanenti(s.data_scadenza) as giorni_rimanenti,
        COALESCE(c_diretto.denominazione, c_progetto.denominazione) as cliente_denominazione,
        s.responsabile_email,
        COALESCE(s.tipo_scadenza_dettagliato::text, ts.nome, 'ALTRA') as tipo_scadenza,
        COALESCE(c_diretto.email, c_progetto.email) as cliente_email,
        CASE
            WHEN giorni_rimanenti(s.data_scadenza) <= 2 THEN 'URGENTE'
            WHEN giorni_rimanenti(s.data_scadenza) <= 7 THEN 'IMMINENTE'
            ELSE 'PROSSIMA'
        END as urgenza
    FROM scadenze_bandi_scadenze s
    LEFT JOIN scadenze_bandi_clienti c_diretto ON s.cliente_id = c_diretto.id
    LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
    LEFT JOIN scadenze_bandi_clienti c_progetto ON p.cliente_id = c_progetto.id
    LEFT JOIN scadenze_bandi_tipologie_scadenze ts ON s.tipologia_scadenza_id = ts.id
    WHERE s.stato IN ('non_iniziata', 'in_corso')
    AND giorni_rimanenti(s.data_scadenza) = ANY(s.giorni_preavviso)
    AND giorni_rimanenti(s.data_scadenza) >= 0
    ORDER BY giorni_rimanenti(s.data_scadenza) ASC;
END;
$$ LANGUAGE plpgsql;

-- 10. Tabella per il log delle notifiche inviate
CREATE TABLE IF NOT EXISTS scadenze_bandi_notifiche_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scadenza_id UUID NOT NULL REFERENCES scadenze_bandi_scadenze(id) ON DELETE CASCADE,
    tipo_notifica VARCHAR(50) NOT NULL, -- 'EMAIL', 'SMS', 'WHATSAPP', 'IN_APP'
    destinatario VARCHAR(255) NOT NULL,
    messaggio TEXT,
    inviata_il TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stato_invio VARCHAR(20) DEFAULT 'INVIATA', -- 'INVIATA', 'ERRORE', 'PENDING'
    errore_dettaglio TEXT,
    giorni_preavviso INTEGER NOT NULL
);

-- 11. Indici aggiuntivi per performance
CREATE INDEX IF NOT EXISTS idx_scadenze_cliente_diretto ON scadenze_bandi_scadenze(cliente_id);
CREATE INDEX IF NOT EXISTS idx_scadenze_tipo_dettagliato ON scadenze_bandi_scadenze(tipo_scadenza_dettagliato);
CREATE INDEX IF NOT EXISTS idx_scadenze_titolo ON scadenze_bandi_scadenze(titolo);
CREATE INDEX IF NOT EXISTS idx_scadenze_assegnato_a ON scadenze_bandi_scadenze(assegnato_a);
CREATE INDEX IF NOT EXISTS idx_notifiche_scadenza_log ON scadenze_bandi_notifiche_log(scadenza_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_data_log ON scadenze_bandi_notifiche_log(inviata_il);

-- 12. Aggiungi alcune scadenze di test usando la struttura corretta
DO $$
DECLARE
    primo_cliente_id UUID;
    primo_progetto_id UUID;
    prima_tipologia_id UUID;
BEGIN
    SELECT id INTO primo_cliente_id FROM scadenze_bandi_clienti LIMIT 1;
    SELECT id INTO primo_progetto_id FROM scadenze_bandi_progetti LIMIT 1;
    SELECT id INTO prima_tipologia_id FROM scadenze_bandi_tipologie_scadenze LIMIT 1;

    IF primo_progetto_id IS NOT NULL AND prima_tipologia_id IS NOT NULL THEN
        INSERT INTO scadenze_bandi_scadenze (
            titolo,
            descrizione,
            progetto_id,
            tipologia_scadenza_id,
            tipo_scadenza_dettagliato,
            data_scadenza,
            stato,
            priorita,
            responsabile_email,
            note,
            cliente_id,
            assegnato_a
        ) VALUES (
            'Test Alert Sistema Scadenze',
            'Scadenza di test per verificare il nuovo sistema di alert progressivi',
            primo_progetto_id,
            prima_tipologia_id,
            'ALTRA'::scadenze_tipo_dettagliato,
            NOW() + INTERVAL '15 days',
            'non_iniziata',
            'alta',
            'test@blmproject.it',
            'Test del sistema di alert migliorato',
            primo_cliente_id,
            'Test Admin'
        )
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Aggiunta scadenza di test con ID cliente: % e progetto: %', primo_cliente_id, primo_progetto_id;
    END IF;
END $$;

-- 13. Messaggi finali e statistiche
DO $$
DECLARE
    scadenze_count INTEGER;
    clienti_collegati_count INTEGER;
    scadenze_urgenti_count INTEGER;
    scadenze_con_cliente_diretto INTEGER;
BEGIN
    SELECT COUNT(*) INTO scadenze_count FROM scadenze_bandi_scadenze;

    SELECT COUNT(DISTINCT COALESCE(s.cliente_id, p.cliente_id)) INTO clienti_collegati_count
    FROM scadenze_bandi_scadenze s
    LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id;

    SELECT COUNT(*) INTO scadenze_urgenti_count
    FROM scadenze_bandi_scadenze_enhanced
    WHERE urgenza IN ('URGENTE', 'IMMINENTE');

    SELECT COUNT(*) INTO scadenze_con_cliente_diretto
    FROM scadenze_bandi_scadenze
    WHERE cliente_id IS NOT NULL;

    RAISE NOTICE '================================';
    RAISE NOTICE 'UPGRADE SCHEMA SCADENZE COMPLETATO!';
    RAISE NOTICE '================================';
    RAISE NOTICE 'Miglioramenti aggiunti:';
    RAISE NOTICE '- Campo titolo per identificazione rapida';
    RAISE NOTICE '- Collegamento diretto ai clienti (cliente_id)';
    RAISE NOTICE '- Tipi di scadenza dettagliati (ENUM)';
    RAISE NOTICE '- Campi aggiuntivi per gestione avanzata';
    RAISE NOTICE '- Vista migliorata (scadenze_bandi_scadenze_enhanced)';
    RAISE NOTICE '- Funzione per alert progressivi migliorata';
    RAISE NOTICE '- Sistema di log notifiche completo';
    RAISE NOTICE '================================';
    RAISE NOTICE 'STATISTICHE FINALI:';
    RAISE NOTICE 'Scadenze totali: %', scadenze_count;
    RAISE NOTICE 'Clienti con scadenze: %', clienti_collegati_count;
    RAISE NOTICE 'Scadenze urgenti: %', scadenze_urgenti_count;
    RAISE NOTICE 'Scadenze con cliente diretto: %', scadenze_con_cliente_diretto;
    RAISE NOTICE '================================';
    RAISE NOTICE 'Vista principale: SELECT * FROM scadenze_bandi_scadenze_enhanced';
    RAISE NOTICE 'Alert: SELECT * FROM get_scadenze_per_alert()';
    RAISE NOTICE '================================';
END $$;