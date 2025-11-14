-- Fix per schema bandi - gestisce trigger esistenti
-- Eseguire dopo setup_storage_buckets.sql

-- 1. ENUM per stati bandi
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

-- 2. ENUM per tipo valutazione
DO $$ BEGIN
    CREATE TYPE bando_tipo_valutazione AS ENUM (
        'A_PUNTEGGIO',
        'JUST_IN_TIME'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Aggiorna tabella bandi esistente
ALTER TABLE scadenze_bandi_bandi
ADD COLUMN IF NOT EXISTS codice_bando VARCHAR(50),
ADD COLUMN IF NOT EXISTS ente_erogatore TEXT,
ADD COLUMN IF NOT EXISTS tipologia_bando TEXT,
ADD COLUMN IF NOT EXISTS contributo_massimo DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS budget_totale DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS percentuale_contributo DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS data_pubblicazione DATE,
ADD COLUMN IF NOT EXISTS data_apertura_presentazione DATE,
ADD COLUMN IF NOT EXISTS data_chiusura_presentazione DATE,
ADD COLUMN IF NOT EXISTS tempo_valutazione_giorni INTEGER DEFAULT 90,
ADD COLUMN IF NOT EXISTS data_pubblicazione_graduatoria DATE,
ADD COLUMN IF NOT EXISTS tipo_valutazione bando_tipo_valutazione DEFAULT 'A_PUNTEGGIO',
ADD COLUMN IF NOT EXISTS stato_bando bando_stato DEFAULT 'PROSSIMA_APERTURA',
ADD COLUMN IF NOT EXISTS link_bando_ufficiale TEXT,
ADD COLUMN IF NOT EXISTS documenti_paths TEXT[],
ADD COLUMN IF NOT EXISTS settori_ammessi TEXT[],
ADD COLUMN IF NOT EXISTS dimensioni_aziendali_ammesse TEXT[],
ADD COLUMN IF NOT EXISTS localizzazione_geografica TEXT,
ADD COLUMN IF NOT EXISTS note_interne TEXT,
ADD COLUMN IF NOT EXISTS referente_bando TEXT,
ADD COLUMN IF NOT EXISTS email_referente TEXT;

-- 4. Aggiungi vincolo UNIQUE se non esiste
DO $$
BEGIN
    ALTER TABLE scadenze_bandi_bandi
    ADD CONSTRAINT unique_codice_bando UNIQUE (codice_bando);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Tabella per tipologie bandi (popolata dinamicamente)
CREATE TABLE IF NOT EXISTS scadenze_bandi_tipologie_bando (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT UNIQUE NOT NULL,
    descrizione TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabella documenti bandi
CREATE TABLE IF NOT EXISTS scadenze_bandi_documenti_bando (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bando_id UUID NOT NULL REFERENCES scadenze_bandi_bandi(id) ON DELETE CASCADE,
    nome_documento TEXT NOT NULL,
    path_storage TEXT NOT NULL,
    dimensione_bytes INTEGER,
    tipo_mime TEXT,
    tipo_documento TEXT,
    uploaded_by TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Vista completa bandi con calcoli automatici
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
    (SELECT COUNT(*) FROM scadenze_bandi_progetti p WHERE p.bando_id = b.id AND p.stato = 'attivo') as progetti_attivi,

    -- Documenti caricati
    (SELECT COUNT(*) FROM scadenze_bandi_documenti_bando d WHERE d.bando_id = b.id) as documenti_caricati

FROM scadenze_bandi_bandi b;

-- 8. Indici per performance
CREATE INDEX IF NOT EXISTS idx_bandi_stato ON scadenze_bandi_bandi(stato_bando);
CREATE INDEX IF NOT EXISTS idx_bandi_apertura ON scadenze_bandi_bandi(data_apertura_presentazione);
CREATE INDEX IF NOT EXISTS idx_bandi_chiusura ON scadenze_bandi_bandi(data_chiusura_presentazione);
CREATE INDEX IF NOT EXISTS idx_bandi_tipologia ON scadenze_bandi_bandi(tipologia_bando);
CREATE INDEX IF NOT EXISTS idx_documenti_bando ON scadenze_bandi_documenti_bando(bando_id);

-- 9. Popola alcune tipologie comuni
INSERT INTO scadenze_bandi_tipologie_bando (nome, descrizione) VALUES
('Innovazione e R&S', 'Bandi per ricerca, sviluppo e innovazione'),
('Digitalizzazione', 'Bandi per trasformazione digitale e Industria 4.0'),
('Turismo', 'Bandi per sviluppo turistico e promozione territoriale'),
('Ambiente e Sostenibilità', 'Bandi per progetti green e sostenibilità ambientale'),
('Formazione', 'Bandi per formazione aziendale e sviluppo competenze'),
('Internazionalizzazione', 'Bandi per export e sviluppo mercati esteri'),
('Startup e PMI', 'Bandi specifici per startup e piccole medie imprese'),
('Agricoltura', 'Bandi per sviluppo agricolo e agroalimentare')
ON CONFLICT (nome) DO NOTHING;

-- 10. Dati di esempio
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
    'https://www.regione.lombardia.it/bandi/innovazione-pmi-2024',
    ARRAY['Manifatturiero', 'Servizi', 'ICT'],
    ARRAY['MICRO', 'PICCOLA', 'MEDIA'],
    'Lombardia',
    'Bando molto competitivo, preparare documentazione dettagliata',
    'Marco Bianchi',
    'marco.bianchi@regione.lombardia.it'
) ON CONFLICT (codice_bando) DO NOTHING;

-- 11. Messaggio finale
DO $$
BEGIN
    RAISE NOTICE 'Schema bandi aggiornato con successo!';
    RAISE NOTICE 'Creata vista: scadenze_bandi_bandi_view';
    RAISE NOTICE 'Aggiunto bando di esempio con codice: INN-2024-001';
END $$;