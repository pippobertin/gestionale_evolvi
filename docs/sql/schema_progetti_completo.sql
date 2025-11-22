-- Schema completo per gestione Progetti con scadenze automatiche
-- Un progetto nasce quando un cliente vince un bando

-- 1. ENUM per stati progetti
DO $$ BEGIN
    CREATE TYPE progetto_stato AS ENUM (
        'DECRETO_ATTESO',          -- In attesa del decreto di concessione
        'DECRETO_RICEVUTO',        -- Decreto ricevuto, in attesa accettazione
        'ACCETTATO',               -- Esiti accettati, progetto attivo
        'IN_CORSO',                -- Progetto in esecuzione
        'COMPLETATO',              -- Progetto completato con successo
        'SOSPESO',                 -- Progetto temporaneamente sospeso
        'ANNULLATO'                -- Progetto annullato
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. ENUM per numero di SAL (Stati Avanzamento Lavori)
DO $$ BEGIN
    CREATE TYPE progetto_numero_sal AS ENUM (
        'UNICO',                   -- Solo rendicontazione finale
        'DUE',                     -- Intermedio + finale
        'TRE'                      -- Due intermedi + finale
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Aggiorna tabella progetti esistente con tutti i campi necessari
ALTER TABLE scadenze_bandi_progetti
-- Informazioni progetto
ADD COLUMN IF NOT EXISTS codice_progetto VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS titolo_progetto TEXT,
ADD COLUMN IF NOT EXISTS descrizione_progetto TEXT,
ADD COLUMN IF NOT EXISTS stato progetto_stato DEFAULT 'DECRETO_ATTESO',

-- Importi e contributi
ADD COLUMN IF NOT EXISTS importo_totale_progetto DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS contributo_ammesso DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS percentuale_contributo DECIMAL(5,2),

-- Date critiche del progetto
ADD COLUMN IF NOT EXISTS data_decreto_concessione DATE,
ADD COLUMN IF NOT EXISTS scadenza_accettazione_esiti DATE,
ADD COLUMN IF NOT EXISTS data_effettiva_accettazione_esiti DATE,
ADD COLUMN IF NOT EXISTS data_avvio_progetto DATE,
ADD COLUMN IF NOT EXISTS data_fine_progetto_prevista DATE,
ADD COLUMN IF NOT EXISTS data_fine_progetto_effettiva DATE,

-- Gestione anticipo
ADD COLUMN IF NOT EXISTS anticipo_richiedibile BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS percentuale_anticipo DECIMAL(5,2) DEFAULT 30.00,
ADD COLUMN IF NOT EXISTS scadenza_richiesta_anticipo DATE,
ADD COLUMN IF NOT EXISTS data_effettiva_richiesta_anticipo DATE,
ADD COLUMN IF NOT EXISTS importo_anticipo_erogato DECIMAL(15,2),

-- Gestione SAL (Stati Avanzamento Lavori)
ADD COLUMN IF NOT EXISTS numero_sal progetto_numero_sal DEFAULT 'UNICO',
ADD COLUMN IF NOT EXISTS scadenza_primo_sal DATE,
ADD COLUMN IF NOT EXISTS data_effettiva_primo_sal DATE,
ADD COLUMN IF NOT EXISTS scadenza_secondo_sal DATE,
ADD COLUMN IF NOT EXISTS data_effettiva_secondo_sal DATE,
ADD COLUMN IF NOT EXISTS scadenza_saldo_finale DATE,
ADD COLUMN IF NOT EXISTS data_effettiva_saldo_finale DATE,

-- Gestione proroghe
ADD COLUMN IF NOT EXISTS proroga_richiedibile BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS scadenza_richiesta_proroga DATE,
ADD COLUMN IF NOT EXISTS data_effettiva_richiesta_proroga DATE,
ADD COLUMN IF NOT EXISTS mesi_proroga_concessi INTEGER,

-- Rendicontazione finale
ADD COLUMN IF NOT EXISTS scadenza_rendicontazione_finale DATE,
ADD COLUMN IF NOT EXISTS data_effettiva_rendicontazione_finale DATE,
ADD COLUMN IF NOT EXISTS modalita_calcolo_scadenza_rendicontazione TEXT DEFAULT 'decreto_concessione', -- 'decreto_concessione', 'accettazione_esiti', 'avvio_progetto'

-- Metadati
ADD COLUMN IF NOT EXISTS referente_interno TEXT,
ADD COLUMN IF NOT EXISTS email_referente_interno TEXT,
ADD COLUMN IF NOT EXISTS note_progetto TEXT,
ADD COLUMN IF NOT EXISTS documenti_paths TEXT[]; -- Array di path nel bucket

-- 4. Tabella per documenti progetti
CREATE TABLE IF NOT EXISTS scadenze_bandi_documenti_progetto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    progetto_id UUID NOT NULL REFERENCES scadenze_bandi_progetti(id) ON DELETE CASCADE,
    nome_documento TEXT NOT NULL,
    path_storage TEXT NOT NULL, -- path nel bucket
    dimensione_bytes INTEGER,
    tipo_mime TEXT,
    tipo_documento TEXT, -- 'DECRETO', 'ACCETTAZIONE_ESITI', 'SAL', 'RENDICONTAZIONE', etc.
    sal_riferimento INTEGER, -- se è documento di SAL, quale SAL (1, 2, finale)
    uploaded_by TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Vista completa progetti con calcoli automatici
CREATE OR REPLACE VIEW scadenze_bandi_progetti_view AS
SELECT
    p.*,
    -- Info bando collegato
    b.nome as bando_nome,
    b.codice_bando,
    b.ente_erogatore,
    b.contributo_massimo as bando_contributo_massimo,

    -- Info cliente collegato
    c.denominazione as cliente_denominazione,
    c.email as cliente_email,
    c.partita_iva as cliente_piva,
    c.dimensione as cliente_dimensione,

    -- Calcoli automatici
    CASE
        WHEN p.data_decreto_concessione IS NULL THEN 'DECRETO_ATTESO'
        WHEN p.data_decreto_concessione IS NOT NULL AND p.data_effettiva_accettazione_esiti IS NULL THEN 'DECRETO_RICEVUTO'
        WHEN p.data_effettiva_accettazione_esiti IS NOT NULL AND p.data_avvio_progetto IS NULL THEN 'ACCETTATO'
        WHEN p.data_avvio_progetto IS NOT NULL AND p.data_fine_progetto_effettiva IS NULL THEN 'IN_CORSO'
        WHEN p.data_fine_progetto_effettiva IS NOT NULL THEN 'COMPLETATO'
        ELSE p.stato::text
    END as stato_calcolato,

    -- Giorni rimanenti per scadenze critiche
    CASE WHEN p.scadenza_accettazione_esiti >= CURRENT_DATE
         THEN (p.scadenza_accettazione_esiti - CURRENT_DATE)
         ELSE NULL END as giorni_ad_accettazione,

    CASE WHEN p.scadenza_richiesta_anticipo >= CURRENT_DATE
         THEN (p.scadenza_richiesta_anticipo - CURRENT_DATE)
         ELSE NULL END as giorni_a_richiesta_anticipo,

    CASE WHEN p.scadenza_rendicontazione_finale >= CURRENT_DATE
         THEN (p.scadenza_rendicontazione_finale - CURRENT_DATE)
         ELSE NULL END as giorni_a_rendicontazione,

    -- Conteggi scadenze collegate
    (SELECT COUNT(*) FROM scadenze_bandi_scadenze s WHERE s.progetto_id = p.id) as scadenze_totali,
    (SELECT COUNT(*) FROM scadenze_bandi_scadenze s WHERE s.progetto_id = p.id AND s.stato IN ('non_iniziata', 'in_corso')) as scadenze_attive,

    -- Documenti caricati
    (SELECT COUNT(*) FROM scadenze_bandi_documenti_progetto d WHERE d.progetto_id = p.id) as documenti_caricati,

    -- Percentuale completamento (basata su milestone raggiunte)
    CASE
        WHEN p.data_effettiva_rendicontazione_finale IS NOT NULL THEN 100
        WHEN p.data_effettiva_saldo_finale IS NOT NULL THEN 90
        WHEN p.data_effettiva_secondo_sal IS NOT NULL THEN 70
        WHEN p.data_effettiva_primo_sal IS NOT NULL THEN 50
        WHEN p.data_effettiva_richiesta_anticipo IS NOT NULL THEN 30
        WHEN p.data_effettiva_accettazione_esiti IS NOT NULL THEN 20
        WHEN p.data_decreto_concessione IS NOT NULL THEN 10
        ELSE 0
    END as percentuale_completamento

FROM scadenze_bandi_progetti p
LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
LEFT JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id;

-- 6. Funzione per creare scadenze automatiche quando si crea un progetto
CREATE OR REPLACE FUNCTION crea_scadenze_progetto(progetto_id_param UUID)
RETURNS void AS $$
DECLARE
    progetto_record RECORD;
    tipologia_decreto_id UUID;
    tipologia_accettazione_id UUID;
    tipologia_anticipo_id UUID;
    tipologia_sal_id UUID;
    tipologia_rendicontazione_id UUID;
BEGIN
    -- Recupera info progetto
    SELECT * INTO progetto_record
    FROM scadenze_bandi_progetti_view
    WHERE id = progetto_id_param;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Progetto non trovato: %', progetto_id_param;
    END IF;

    -- Recupera o crea tipologie di scadenza
    SELECT id INTO tipologia_decreto_id FROM scadenze_bandi_tipologie_scadenze WHERE nome = 'Decreto di Concessione';
    IF tipologia_decreto_id IS NULL THEN
        INSERT INTO scadenze_bandi_tipologie_scadenze (nome) VALUES ('Decreto di Concessione') RETURNING id INTO tipologia_decreto_id;
    END IF;

    SELECT id INTO tipologia_accettazione_id FROM scadenze_bandi_tipologie_scadenze WHERE nome = 'Accettazione Esiti';
    IF tipologia_accettazione_id IS NULL THEN
        INSERT INTO scadenze_bandi_tipologie_scadenze (nome) VALUES ('Accettazione Esiti') RETURNING id INTO tipologia_accettazione_id;
    END IF;

    SELECT id INTO tipologia_anticipo_id FROM scadenze_bandi_tipologie_scadenze WHERE nome = 'Richiesta Anticipo';
    IF tipologia_anticipo_id IS NULL THEN
        INSERT INTO scadenze_bandi_tipologie_scadenze (nome) VALUES ('Richiesta Anticipo') RETURNING id INTO tipologia_anticipo_id;
    END IF;

    SELECT id INTO tipologia_rendicontazione_id FROM scadenze_bandi_tipologie_scadenze WHERE nome = 'Rendicontazione Finale';
    IF tipologia_rendicontazione_id IS NULL THEN
        INSERT INTO scadenze_bandi_tipologie_scadenze (nome) VALUES ('Rendicontazione Finale') RETURNING id INTO tipologia_rendicontazione_id;
    END IF;

    -- Crea scadenza accettazione esiti (se data scadenza definita)
    IF progetto_record.scadenza_accettazione_esiti IS NOT NULL THEN
        INSERT INTO scadenze_bandi_scadenze (
            progetto_id,
            cliente_id,
            tipologia_scadenza_id,
            titolo,
            note,
            data_scadenza,
            stato,
            priorita,
            responsabile_email
        ) VALUES (
            progetto_id_param,
            progetto_record.cliente_id,
            tipologia_accettazione_id,
            'Accettazione Esiti - ' || progetto_record.titolo_progetto,
            'Scadenza per accettare formalmente gli esiti del bando',
            progetto_record.scadenza_accettazione_esiti,
            'non_iniziata',
            'alta',
            progetto_record.email_referente_interno
        );
    END IF;

    -- Crea scadenza richiesta anticipo (se abilitato)
    IF progetto_record.anticipo_richiedibile AND progetto_record.scadenza_richiesta_anticipo IS NOT NULL THEN
        INSERT INTO scadenze_bandi_scadenze (
            progetto_id,
            cliente_id,
            tipologia_scadenza_id,
            titolo,
            note,
            data_scadenza,
            stato,
            priorita,
            responsabile_email
        ) VALUES (
            progetto_id_param,
            progetto_record.cliente_id,
            tipologia_anticipo_id,
            'Richiesta Anticipo - ' || progetto_record.titolo_progetto,
            'Scadenza per richiedere l''anticipo del ' || progetto_record.percentuale_anticipo || '%',
            progetto_record.scadenza_richiesta_anticipo,
            'non_iniziata',
            'media',
            progetto_record.email_referente_interno
        );
    END IF;

    -- Crea scadenza rendicontazione finale
    IF progetto_record.scadenza_rendicontazione_finale IS NOT NULL THEN
        INSERT INTO scadenze_bandi_scadenze (
            progetto_id,
            cliente_id,
            tipologia_scadenza_id,
            titolo,
            note,
            data_scadenza,
            stato,
            priorita,
            responsabile_email
        ) VALUES (
            progetto_id_param,
            progetto_record.cliente_id,
            tipologia_rendicontazione_id,
            'Rendicontazione Finale - ' || progetto_record.titolo_progetto,
            'Scadenza per presentare la rendicontazione finale del progetto',
            progetto_record.scadenza_rendicontazione_finale,
            'non_iniziata',
            'critica',
            progetto_record.email_referente_interno
        );
    END IF;

    RAISE NOTICE 'Scadenze automatiche create per progetto: %', progetto_record.titolo_progetto;
END;
$$ LANGUAGE plpgsql;

-- 7. Indici per performance
CREATE INDEX IF NOT EXISTS idx_progetti_stato ON scadenze_bandi_progetti(stato);
CREATE INDEX IF NOT EXISTS idx_progetti_bando ON scadenze_bandi_progetti(bando_id);
CREATE INDEX IF NOT EXISTS idx_progetti_cliente ON scadenze_bandi_progetti(cliente_id);
CREATE INDEX IF NOT EXISTS idx_progetti_decreto ON scadenze_bandi_progetti(data_decreto_concessione);
CREATE INDEX IF NOT EXISTS idx_documenti_progetto ON scadenze_bandi_documenti_progetto(progetto_id);

-- 8. Dati di esempio
DO $$
DECLARE
    bando_innovazione_id UUID;
    cliente_blm_id UUID;
    nuovo_progetto_id UUID;
BEGIN
    -- Recupera bando e cliente esistenti
    SELECT id INTO bando_innovazione_id FROM scadenze_bandi_bandi WHERE codice_bando = 'INN-2024-001';
    SELECT id INTO cliente_blm_id FROM scadenze_bandi_clienti WHERE denominazione ILIKE '%blm%' LIMIT 1;

    -- Se non trova il cliente blm, prende il primo disponibile
    IF cliente_blm_id IS NULL THEN
        SELECT id INTO cliente_blm_id FROM scadenze_bandi_clienti LIMIT 1;
    END IF;

    IF bando_innovazione_id IS NOT NULL AND cliente_blm_id IS NOT NULL THEN
        -- Crea progetto di esempio
        INSERT INTO scadenze_bandi_progetti (
            bando_id,
            cliente_id,
            codice_progetto,
            titolo_progetto,
            descrizione_progetto,
            stato,
            importo_totale_progetto,
            contributo_ammesso,
            percentuale_contributo,
            data_decreto_concessione,
            scadenza_accettazione_esiti,
            scadenza_richiesta_anticipo,
            scadenza_rendicontazione_finale,
            anticipo_richiedibile,
            percentuale_anticipo,
            numero_sal,
            referente_interno,
            email_referente_interno,
            note_progetto
        ) VALUES (
            bando_innovazione_id,
            cliente_blm_id,
            'PROJ-INN-2024-001',
            'Digitalizzazione Processi Produttivi',
            'Progetto per l''implementazione di sistemi digitali nei processi produttivi aziendali',
            'DECRETO_RICEVUTO',
            800000.00,
            400000.00,
            50.00,
            CURRENT_DATE - INTERVAL '10 days',
            CURRENT_DATE + INTERVAL '30 days',
            CURRENT_DATE + INTERVAL '60 days',
            CURRENT_DATE + INTERVAL '18 months',
            true,
            30.00,
            'DUE',
            'Responsabile Progetto',
            'progetti@blmproject.it',
            'Progetto strategico per la trasformazione digitale'
        ) RETURNING id INTO nuovo_progetto_id;

        -- Crea scadenze automatiche per il progetto
        PERFORM crea_scadenze_progetto(nuovo_progetto_id);

        RAISE NOTICE 'Progetto di esempio creato con ID: %', nuovo_progetto_id;
    END IF;
END $$;

-- 9. Commenti per documentazione
COMMENT ON TABLE scadenze_bandi_progetti IS 'Tabella progetti: quando un cliente vince un bando inizia un progetto con le sue scadenze automatiche';
COMMENT ON FUNCTION crea_scadenze_progetto(UUID) IS 'Crea automaticamente le scadenze standard quando si crea un nuovo progetto';
COMMENT ON VIEW scadenze_bandi_progetti_view IS 'Vista completa progetti con bando, cliente e calcoli automatici di stato e scadenze';

-- 10. Messaggio finale
DO $$
BEGIN
    RAISE NOTICE '===================================';
    RAISE NOTICE 'SCHEMA PROGETTI COMPLETATO!';
    RAISE NOTICE '===================================';
    RAISE NOTICE 'Funzionalità implementate:';
    RAISE NOTICE '- Gestione completa progetti con tutte le date critiche';
    RAISE NOTICE '- Creazione automatica scadenze quando si crea un progetto';
    RAISE NOTICE '- Vista progetti con calcoli automatici';
    RAISE NOTICE '- Sistema documenti progetti';
    RAISE NOTICE '- Progetto di esempio creato con scadenze automatiche';
    RAISE NOTICE '===================================';
END $$;