-- Fix per ripristinare ENUM bandi e dati
-- Gli ENUM dei bandi sono stati eliminati per errore

-- 1. Ricrea ENUM bandi se non esistono
DO $$ BEGIN
    CREATE TYPE bando_stato AS ENUM (
        'PROSSIMA_APERTURA',
        'APERTO',
        'CHIUSO',
        'IN_VALUTAZIONE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE bando_tipo_valutazione AS ENUM (
        'A_PUNTEGGIO',
        'JUST_IN_TIME'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Aggiorna tabella bandi se mancano colonne ENUM
DO $$
BEGIN
    -- Controlla se la colonna stato_bando esiste ed è del tipo corretto
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_bandi'
        AND column_name = 'stato_bando'
        AND data_type = 'USER-DEFINED'
    ) THEN
        -- Aggiungi la colonna se non esiste o ricreala se del tipo sbagliato
        ALTER TABLE scadenze_bandi_bandi DROP COLUMN IF EXISTS stato_bando;
        ALTER TABLE scadenze_bandi_bandi ADD COLUMN stato_bando bando_stato DEFAULT 'PROSSIMA_APERTURA';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_bandi'
        AND column_name = 'tipo_valutazione'
        AND data_type = 'USER-DEFINED'
    ) THEN
        ALTER TABLE scadenze_bandi_bandi DROP COLUMN IF EXISTS tipo_valutazione;
        ALTER TABLE scadenze_bandi_bandi ADD COLUMN tipo_valutazione bando_tipo_valutazione DEFAULT 'A_PUNTEGGIO';
    END IF;
END $$;

-- 3. Ripristina il bando di esempio se non esiste
INSERT INTO scadenze_bandi_bandi (
    codice_bando,
    nome,
    descrizione,
    ente_erogatore,
    tipologia_bando,
    contributo_massimo,
    budget_totale,
    percentuale_contributo,
    data_pubblicazione,
    data_apertura_presentazione,
    data_chiusura_presentazione,
    tempo_valutazione_giorni,
    tipo_valutazione,
    stato_bando,
    link_bando_ufficiale,
    settori_ammessi,
    dimensioni_aziendali_ammesse,
    localizzazione_geografica,
    note_interne,
    referente_bando,
    email_referente
) VALUES (
    'INN-2024-001',
    'Innovazione PMI 2024',
    'Bando per supporto innovazione nelle piccole e medie imprese',
    'Regione Lombardia',
    'Innovazione e R&S',
    500000.00,
    10000000.00,
    50.00,
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE - INTERVAL '20 days',
    CURRENT_DATE + INTERVAL '45 days',
    60,
    'A_PUNTEGGIO',
    'APERTO',
    'https://www.regione.lombardia.it/bandi/innovazione-pmi-2024',
    ARRAY['Manifatturiero', 'Servizi', 'ICT'],
    ARRAY['MICRO', 'PICCOLA', 'MEDIA'],
    'Lombardia',
    'Bando molto competitivo, preparare documentazione dettagliata',
    'Marco Bianchi',
    'marco.bianchi@regione.lombardia.it'
) ON CONFLICT (codice_bando) DO UPDATE SET
    stato_bando = EXCLUDED.stato_bando,
    tipo_valutazione = EXCLUDED.tipo_valutazione;

-- 4. Ricrea vista bandi se necessario
CREATE OR REPLACE VIEW scadenze_bandi_bandi_view AS
SELECT
    b.*,
    -- Calcoli automatici
    CASE
        WHEN b.data_apertura_presentazione > CURRENT_DATE THEN 'PROSSIMA_APERTURA'
        WHEN b.data_apertura_presentazione <= CURRENT_DATE AND b.data_chiusura_presentazione >= CURRENT_DATE THEN 'APERTO'
        WHEN b.data_chiusura_presentazione < CURRENT_DATE AND (b.data_pubblicazione_graduatoria IS NULL OR b.data_pubblicazione_graduatoria > CURRENT_DATE) THEN 'IN_VALUTAZIONE'
        ELSE 'CHIUSO'
    END as stato_calcolato,

    -- Giorni rimanenti per varie scadenze
    CASE WHEN b.data_apertura_presentazione > CURRENT_DATE
         THEN (b.data_apertura_presentazione - CURRENT_DATE)
         ELSE NULL END as giorni_ad_apertura,

    CASE WHEN b.data_chiusura_presentazione >= CURRENT_DATE
         THEN (b.data_chiusura_presentazione - CURRENT_DATE)
         ELSE NULL END as giorni_a_chiusura,

    -- Conteggi progetti collegati
    (SELECT COUNT(*) FROM scadenze_bandi_progetti p WHERE p.bando_id = b.id) as progetti_collegati,
    (SELECT COUNT(*) FROM scadenze_bandi_progetti p WHERE p.bando_id = b.id AND p.stato IN ('IN_CORSO', 'ACCETTATO')) as progetti_attivi,

    -- Documenti caricati
    (SELECT COUNT(*) FROM scadenze_bandi_documenti_bando d WHERE d.bando_id = b.id) as documenti_caricati

FROM scadenze_bandi_bandi b;

DO $$
BEGIN
    RAISE NOTICE 'ENUM bandi e dati ripristinati con successo!';
END $$;