-- Fix aggressivo per conflitto ENUM stati progetto
-- Risolve definitivamente il problema eliminando tutti gli ENUM esistenti

-- 1. Prima elimina completamente la tabella progetti e la ricrea
DO $$
BEGIN
    -- Elimina la tabella progetti per ricrearla pulita
    DROP TABLE IF EXISTS scadenze_bandi_progetti CASCADE;

    -- Elimina TUTTI i tipi ENUM che potrebbero essere in conflitto
    DROP TYPE IF EXISTS scadenze_bandi_stato_progetto CASCADE;
    DROP TYPE IF EXISTS progetto_stato CASCADE;
    DROP TYPE IF EXISTS progetto_numero_sal CASCADE;
    DROP TYPE IF EXISTS bando_stato CASCADE;
    DROP TYPE IF EXISTS bando_tipo_valutazione CASCADE;

    RAISE NOTICE 'Tabella progetti e ENUM eliminati con successo';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Errore durante eliminazione: %', SQLERRM;
END $$;

-- 2. Ricrea TUTTI gli ENUM necessari da zero
CREATE TYPE progetto_stato AS ENUM (
    'DECRETO_ATTESO',
    'DECRETO_RICEVUTO',
    'ACCETTATO',
    'IN_CORSO',
    'COMPLETATO',
    'SOSPESO',
    'ANNULLATO'
);

CREATE TYPE progetto_numero_sal AS ENUM (
    'UNICO',
    'DUE',
    'TRE'
);

-- Ricrea anche gli ENUM per i bandi che potrebbero essere stati eliminati
CREATE TYPE bando_stato AS ENUM (
    'PROSSIMA_APERTURA',
    'APERTO',
    'CHIUSO',
    'IN_VALUTAZIONE'
);

CREATE TYPE bando_tipo_valutazione AS ENUM (
    'A_PUNTEGGIO',
    'JUST_IN_TIME'
);

-- 3. Ricrea la tabella progetti completamente pulita
CREATE TABLE scadenze_bandi_progetti (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bando_id UUID REFERENCES scadenze_bandi_bandi(id),
    cliente_id UUID REFERENCES scadenze_bandi_clienti(id),

    -- Informazioni progetto
    codice_progetto VARCHAR(50) UNIQUE,
    titolo_progetto TEXT,
    descrizione_progetto TEXT,
    stato progetto_stato DEFAULT 'DECRETO_ATTESO',

    -- Importi e contributi
    importo_totale_progetto DECIMAL(15,2),
    contributo_ammesso DECIMAL(15,2),
    percentuale_contributo DECIMAL(5,2),

    -- Date critiche del progetto
    data_decreto_concessione DATE,
    scadenza_accettazione_esiti DATE,
    data_effettiva_accettazione_esiti DATE,
    data_avvio_progetto DATE,
    data_fine_progetto_prevista DATE,
    data_fine_progetto_effettiva DATE,

    -- Gestione anticipo
    anticipo_richiedibile BOOLEAN DEFAULT true,
    percentuale_anticipo DECIMAL(5,2) DEFAULT 30.00,
    scadenza_richiesta_anticipo DATE,
    data_effettiva_richiesta_anticipo DATE,
    importo_anticipo_erogato DECIMAL(15,2),

    -- Gestione SAL
    numero_sal progetto_numero_sal DEFAULT 'UNICO',
    scadenza_primo_sal DATE,
    data_effettiva_primo_sal DATE,
    scadenza_secondo_sal DATE,
    data_effettiva_secondo_sal DATE,
    scadenza_saldo_finale DATE,
    data_effettiva_saldo_finale DATE,

    -- Gestione proroghe
    proroga_richiedibile BOOLEAN DEFAULT true,
    scadenza_richiesta_proroga DATE,
    data_effettiva_richiesta_proroga DATE,
    mesi_proroga_concessi INTEGER,

    -- Rendicontazione finale
    scadenza_rendicontazione_finale DATE,
    data_effettiva_rendicontazione_finale DATE,
    modalita_calcolo_scadenza_rendicontazione TEXT DEFAULT 'decreto_concessione',

    -- Metadati
    referente_interno TEXT,
    email_referente_interno TEXT,
    note_progetto TEXT,
    documenti_paths TEXT[],

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabella documenti progetti
CREATE TABLE IF NOT EXISTS scadenze_bandi_documenti_progetto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    progetto_id UUID NOT NULL REFERENCES scadenze_bandi_progetti(id) ON DELETE CASCADE,
    nome_documento TEXT NOT NULL,
    path_storage TEXT NOT NULL,
    dimensione_bytes INTEGER,
    tipo_mime TEXT,
    tipo_documento TEXT,
    sal_riferimento INTEGER,
    uploaded_by TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Vista progetti con calcoli automatici
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

    -- Percentuale completamento
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

-- 6. Funzione per creare scadenze automatiche
CREATE OR REPLACE FUNCTION crea_scadenze_progetto(progetto_id_param UUID)
RETURNS void AS $$
DECLARE
    progetto_record RECORD;
    tipologia_accettazione_id UUID;
    tipologia_anticipo_id UUID;
    tipologia_rendicontazione_id UUID;
BEGIN
    SELECT * INTO progetto_record
    FROM scadenze_bandi_progetti_view
    WHERE id = progetto_id_param;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Progetto non trovato: %', progetto_id_param;
    END IF;

    -- Recupera o crea tipologie di scadenza
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

    -- Crea scadenze automatiche
    IF progetto_record.scadenza_accettazione_esiti IS NOT NULL THEN
        INSERT INTO scadenze_bandi_scadenze (
            progetto_id, cliente_id, tipologia_scadenza_id, titolo, note,
            data_scadenza, stato, priorita, responsabile_email
        ) VALUES (
            progetto_id_param, progetto_record.cliente_id, tipologia_accettazione_id,
            'Accettazione Esiti - ' || progetto_record.titolo_progetto,
            'Scadenza per accettare formalmente gli esiti del bando',
            progetto_record.scadenza_accettazione_esiti, 'non_iniziata', 'alta',
            progetto_record.email_referente_interno
        );
    END IF;

    IF progetto_record.anticipo_richiedibile AND progetto_record.scadenza_richiesta_anticipo IS NOT NULL THEN
        INSERT INTO scadenze_bandi_scadenze (
            progetto_id, cliente_id, tipologia_scadenza_id, titolo, note,
            data_scadenza, stato, priorita, responsabile_email
        ) VALUES (
            progetto_id_param, progetto_record.cliente_id, tipologia_anticipo_id,
            'Richiesta Anticipo - ' || progetto_record.titolo_progetto,
            'Scadenza per richiedere l''anticipo del ' || progetto_record.percentuale_anticipo || '%',
            progetto_record.scadenza_richiesta_anticipo, 'non_iniziata', 'media',
            progetto_record.email_referente_interno
        );
    END IF;

    IF progetto_record.scadenza_rendicontazione_finale IS NOT NULL THEN
        INSERT INTO scadenze_bandi_scadenze (
            progetto_id, cliente_id, tipologia_scadenza_id, titolo, note,
            data_scadenza, stato, priorita, responsabile_email
        ) VALUES (
            progetto_id_param, progetto_record.cliente_id, tipologia_rendicontazione_id,
            'Rendicontazione Finale - ' || progetto_record.titolo_progetto,
            'Scadenza per presentare la rendicontazione finale del progetto',
            progetto_record.scadenza_rendicontazione_finale, 'non_iniziata', 'critica',
            progetto_record.email_referente_interno
        );
    END IF;

    RAISE NOTICE 'Scadenze automatiche create per progetto: %', progetto_record.titolo_progetto;
END;
$$ LANGUAGE plpgsql;

-- 7. Indici
CREATE INDEX idx_progetti_stato ON scadenze_bandi_progetti(stato);
CREATE INDEX idx_progetti_bando ON scadenze_bandi_progetti(bando_id);
CREATE INDEX idx_progetti_cliente ON scadenze_bandi_progetti(cliente_id);
CREATE INDEX idx_progetti_decreto ON scadenze_bandi_progetti(data_decreto_concessione);
CREATE INDEX idx_documenti_progetto ON scadenze_bandi_documenti_progetto(progetto_id);

-- 8. Progetto di esempio
DO $$
DECLARE
    bando_innovazione_id UUID;
    cliente_blm_id UUID;
    nuovo_progetto_id UUID;
BEGIN
    SELECT id INTO bando_innovazione_id FROM scadenze_bandi_bandi WHERE codice_bando = 'INN-2024-001';
    SELECT id INTO cliente_blm_id FROM scadenze_bandi_clienti LIMIT 1;

    IF bando_innovazione_id IS NOT NULL AND cliente_blm_id IS NOT NULL THEN
        INSERT INTO scadenze_bandi_progetti (
            bando_id, cliente_id, codice_progetto, titolo_progetto, descrizione_progetto,
            stato, importo_totale_progetto, contributo_ammesso, percentuale_contributo,
            data_decreto_concessione, scadenza_accettazione_esiti, scadenza_richiesta_anticipo,
            scadenza_rendicontazione_finale, anticipo_richiedibile, percentuale_anticipo,
            numero_sal, referente_interno, email_referente_interno, note_progetto
        ) VALUES (
            bando_innovazione_id, cliente_blm_id, 'PROJ-INN-2024-001',
            'Digitalizzazione Processi Produttivi',
            'Progetto per l''implementazione di sistemi digitali nei processi produttivi aziendali',
            'DECRETO_RICEVUTO', 800000.00, 400000.00, 50.00,
            CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '30 days',
            CURRENT_DATE + INTERVAL '60 days', CURRENT_DATE + INTERVAL '18 months',
            true, 30.00, 'DUE', 'Responsabile Progetto', 'progetti@blmproject.it',
            'Progetto strategico per la trasformazione digitale'
        ) RETURNING id INTO nuovo_progetto_id;

        PERFORM crea_scadenze_progetto(nuovo_progetto_id);
        RAISE NOTICE 'Progetto di esempio creato con ID: %', nuovo_progetto_id;
    END IF;
END $$;

-- 9. Messaggio finale
DO $$
BEGIN
    RAISE NOTICE '===================================';
    RAISE NOTICE 'SCHEMA PROGETTI RICREATO COMPLETAMENTE!';
    RAISE NOTICE '===================================';
END $$;