-- UPGRADE dello schema scadenze esistente
-- Aggiunge le funzionalità mancanti alla tabella esistente
-- Eseguire in ordine su Supabase

-- 1. Assicuriamoci che l'estensione UUID sia abilitata
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Aggiorniamo gli ENUM esistenti per compatibilità
-- Aggiungiamo i nuovi tipi di scadenza se non esistono
DO $$
DECLARE
    enum_exists boolean;
BEGIN
    -- Controlla se esiste già l'enum per i tipi di scadenza
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'scadenze_tipo'
    ) INTO enum_exists;

    IF NOT enum_exists THEN
        CREATE TYPE scadenze_tipo AS ENUM (
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
        RAISE NOTICE 'Creato nuovo ENUM scadenze_tipo';
    END IF;

    -- Controlla se esiste l'enum per stati
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'scadenze_stato'
    ) INTO enum_exists;

    IF NOT enum_exists THEN
        CREATE TYPE scadenze_stato AS ENUM (
            'DA_FARE',
            'IN_CORSO',
            'COMPLETATA',
            'SCADUTA',
            'ANNULLATA'
        );
        RAISE NOTICE 'Creato nuovo ENUM scadenze_stato';
    END IF;

    -- Controlla se esiste l'enum per priorità
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'scadenze_priorita_new'
    ) INTO enum_exists;

    IF NOT enum_exists THEN
        CREATE TYPE scadenze_priorita_new AS ENUM (
            'BASSA',
            'MEDIA',
            'ALTA',
            'CRITICA'
        );
        RAISE NOTICE 'Creato nuovo ENUM scadenze_priorita_new';
    END IF;
END $$;

-- 3. Aggiungiamo le colonne mancanti alla tabella scadenze esistente
DO $$
BEGIN
    -- Aggiungi cliente_id diretto per semplificare i collegamenti
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'cliente_id'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN cliente_id UUID;
        RAISE NOTICE 'Aggiunta colonna cliente_id';
    END IF;

    -- Aggiungi tipo_scadenza usando il nuovo enum
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'tipo_scadenza'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN tipo_scadenza scadenze_tipo;
        RAISE NOTICE 'Aggiunta colonna tipo_scadenza';
    END IF;

    -- Aggiungi nuovi campi per gestione avanzata
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

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'email_responsabile'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN email_responsabile VARCHAR(255);
        RAISE NOTICE 'Aggiunta colonna email_responsabile';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'alert_inviati_json'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN alert_inviati_json JSONB DEFAULT '{}';
        RAISE NOTICE 'Aggiunta colonna alert_inviati_json';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_scadenze' AND column_name = 'data_completamento'
    ) THEN
        ALTER TABLE scadenze_bandi_scadenze
        ADD COLUMN data_completamento DATE;
        RAISE NOTICE 'Aggiunta colonna data_completamento';
    END IF;
END $$;

-- 4. Aggiorniamo i dati esistenti per popolare i nuovi campi
DO $$
BEGIN
    -- Popola cliente_id dalle relazioni progetto esistenti
    UPDATE scadenze_bandi_scadenze s
    SET cliente_id = p.cliente_id
    FROM scadenze_bandi_progetti p
    WHERE s.progetto_id = p.id
    AND s.cliente_id IS NULL;

    RAISE NOTICE 'Popolati i cliente_id dalle relazioni esistenti';

    -- Popola progetto_nome dalle relazioni esistenti
    UPDATE scadenze_bandi_scadenze s
    SET progetto_nome = CONCAT(b.nome, ' - ', c.denominazione)
    FROM scadenze_bandi_progetti p
    LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
    LEFT JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id
    WHERE s.progetto_id = p.id
    AND s.progetto_nome IS NULL;

    RAISE NOTICE 'Popolati i nomi progetto dalle relazioni esistenti';

    -- Assegna tipo_scadenza di default
    UPDATE scadenze_bandi_scadenze
    SET tipo_scadenza = 'ALTRA'::scadenze_tipo
    WHERE tipo_scadenza IS NULL;

    RAISE NOTICE 'Assegnato tipo scadenza di default';
END $$;

-- 5. Aggiungiamo le foreign key per il collegamento clienti diretto
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
END $$;

-- 6. Funzione per calcolare giorni rimanenti (aggiornata)
CREATE OR REPLACE FUNCTION giorni_rimanenti(data_scadenza_input TIMESTAMP WITH TIME ZONE)
RETURNS INTEGER AS $$
BEGIN
    RETURN EXTRACT(DAY FROM (data_scadenza_input::date - CURRENT_DATE));
END;
$$ LANGUAGE plpgsql;

-- Versione per DATE
CREATE OR REPLACE FUNCTION giorni_rimanenti(data_scadenza_input DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN (data_scadenza_input - CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- 7. Vista migliorata per scadenze con calcoli automatici E info clienti
CREATE OR REPLACE VIEW scadenze_bandi_scadenze_view AS
SELECT
    s.*,
    giorni_rimanenti(s.data_scadenza) as giorni_rimanenti,
    CASE
        WHEN s.stato::text = 'completata' OR s.stato::text = 'COMPLETATA' THEN 'COMPLETATA'
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
    -- Info progetto se collegato
    p.id as progetto_collegato_id,
    b.nome as bando_collegato_nome
FROM scadenze_bandi_scadenze s
-- Cliente collegato direttamente
LEFT JOIN scadenze_bandi_clienti c_diretto ON s.cliente_id = c_diretto.id
-- Cliente collegato tramite progetto (fallback)
LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
LEFT JOIN scadenze_bandi_clienti c_progetto ON p.cliente_id = c_progetto.id
LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id;

-- 8. Funzione per ottenere scadenze che necessitano alert
CREATE OR REPLACE FUNCTION get_scadenze_per_alert()
RETURNS TABLE (
    id UUID,
    titolo TEXT,
    data_scadenza TIMESTAMP WITH TIME ZONE,
    giorni_rimanenti INTEGER,
    cliente_denominazione TEXT,
    email_responsabile VARCHAR(255),
    tipo_scadenza TEXT,
    cliente_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.titolo,
        s.data_scadenza,
        giorni_rimanenti(s.data_scadenza) as giorni_rimanenti,
        COALESCE(c_diretto.denominazione, c_progetto.denominazione) as cliente_denominazione,
        s.email_responsabile,
        s.tipo_scadenza::text,
        COALESCE(c_diretto.email, c_progetto.email) as cliente_email
    FROM scadenze_bandi_scadenze s
    LEFT JOIN scadenze_bandi_clienti c_diretto ON s.cliente_id = c_diretto.id
    LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
    LEFT JOIN scadenze_bandi_clienti c_progetto ON p.cliente_id = c_progetto.id
    WHERE (s.stato::text = 'non_iniziata' OR s.stato::text = 'DA_FARE' OR s.stato::text = 'IN_CORSO')
    AND giorni_rimanenti(s.data_scadenza) = ANY(s.giorni_preavviso)
    AND giorni_rimanenti(s.data_scadenza) >= 0
    ORDER BY giorni_rimanenti(s.data_scadenza) ASC;
END;
$$ LANGUAGE plpgsql;

-- 9. Tabella per il log delle notifiche inviate (se non esiste)
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

-- 10. Indici aggiuntivi per performance
CREATE INDEX IF NOT EXISTS idx_scadenze_cliente_diretto ON scadenze_bandi_scadenze(cliente_id);
CREATE INDEX IF NOT EXISTS idx_scadenze_tipo_scadenza ON scadenze_bandi_scadenze(tipo_scadenza);
CREATE INDEX IF NOT EXISTS idx_scadenze_email_responsabile ON scadenze_bandi_scadenze(email_responsabile);
CREATE INDEX IF NOT EXISTS idx_notifiche_scadenza ON scadenze_bandi_notifiche_log(scadenza_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_data ON scadenze_bandi_notifiche_log(inviata_il);

-- 11. Aggiungi alcuni dati di esempio per testare il sistema
INSERT INTO scadenze_bandi_scadenze (
    titolo,
    descrizione,
    tipo_scadenza,
    data_scadenza,
    priorita,
    assegnato_a,
    email_responsabile,
    bando_nome,
    note,
    cliente_id
)
SELECT
    'Accettazione Decreto Test',
    'Test accettazione decreto per nuovo sistema',
    'ACCETTAZIONE_DECRETO'::scadenze_tipo,
    NOW() + INTERVAL '15 days',
    'alta'::scadenze_bandi_priorita,
    'Marco Rossi',
    'marco.rossi@blmproject.it',
    'Bando Test 2024',
    'Test del sistema di alert',
    c.id
FROM scadenze_bandi_clienti c
LIMIT 1
ON CONFLICT DO NOTHING;

-- 12. Messaggi finali
DO $$
BEGIN
    RAISE NOTICE '================================';
    RAISE NOTICE 'UPGRADE SCHEMA SCADENZE COMPLETATO!';
    RAISE NOTICE '================================';
    RAISE NOTICE 'La tabella scadenze_bandi_scadenze è stata aggiornata con:';
    RAISE NOTICE '- Collegamento diretto ai clienti (cliente_id)';
    RAISE NOTICE '- Nuovi tipi di scadenza (ENUM)';
    RAISE NOTICE '- Campi aggiuntivi per gestione avanzata';
    RAISE NOTICE '- Vista migliorata con info clienti';
    RAISE NOTICE '- Funzione per alert progressivi';
    RAISE NOTICE '- Sistema di log notifiche';
    RAISE NOTICE '================================';

    -- Mostra statistiche
    RAISE NOTICE 'Scadenze totali: %', (SELECT COUNT(*) FROM scadenze_bandi_scadenze);
    RAISE NOTICE 'Clienti collegati: %', (SELECT COUNT(DISTINCT cliente_id) FROM scadenze_bandi_scadenze WHERE cliente_id IS NOT NULL);
END $$;