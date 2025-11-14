-- Schema completo per il sistema di gestione scadenze (COLLEGATO AI CLIENTI)
-- Eseguire in ordine su Supabase

-- 1. ENUM per tipologie di scadenze
DO $$ BEGIN
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
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. ENUM per stati delle scadenze
DO $$ BEGIN
    CREATE TYPE scadenze_stato AS ENUM (
        'DA_FARE',
        'IN_CORSO',
        'COMPLETATA',
        'SCADUTA',
        'ANNULLATA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. ENUM per priorità delle scadenze
DO $$ BEGIN
    CREATE TYPE scadenze_priorita AS ENUM (
        'BASSA',
        'MEDIA',
        'ALTA',
        'CRITICA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. Tabella principale scadenze (CON foreign key corretta ai clienti)
CREATE TABLE IF NOT EXISTS scadenze_bandi_scadenze (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Informazioni base
    titolo VARCHAR(255) NOT NULL,
    descrizione TEXT,
    tipo_scadenza scadenze_tipo NOT NULL,

    -- Date
    data_scadenza DATE NOT NULL,
    data_completamento DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Stati e priorità
    stato scadenze_stato DEFAULT 'DA_FARE',
    priorita scadenze_priorita DEFAULT 'MEDIA',

    -- Relazioni (collegamento CORRETTO ai clienti)
    cliente_id UUID REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
    bando_id UUID, -- Sarà collegato quando implementeremo i bandi
    bando_nome VARCHAR(255), -- Nome bando per display
    progetto_id UUID, -- Sarà collegato quando implementeremo i progetti
    progetto_nome VARCHAR(255), -- Nome progetto per display

    -- Metadati
    note TEXT,
    documenti_richiesti TEXT[], -- Array di documenti necessari
    importo_correlato DECIMAL(15,2), -- Se la scadenza riguarda importi

    -- Responsabilità
    assegnato_a VARCHAR(100), -- Nome del responsabile
    email_responsabile VARCHAR(255),

    -- Alert e notifiche
    giorni_preavviso INTEGER[] DEFAULT '{30,15,10,7,2,1}', -- Giorni per alert
    alert_inviati JSONB DEFAULT '{}', -- Traccia alert già inviati

    -- Vincoli
    CONSTRAINT check_data_completamento CHECK (
        stato != 'COMPLETATA' OR data_completamento IS NOT NULL
    ),
    CONSTRAINT check_data_scadenza_valida CHECK (
        data_scadenza IS NOT NULL
    )
);

-- 5. Indici per performance
CREATE INDEX IF NOT EXISTS idx_scadenze_data_scadenza ON scadenze_bandi_scadenze(data_scadenza);
CREATE INDEX IF NOT EXISTS idx_scadenze_stato ON scadenze_bandi_scadenze(stato);
CREATE INDEX IF NOT EXISTS idx_scadenze_cliente ON scadenze_bandi_scadenze(cliente_id);
CREATE INDEX IF NOT EXISTS idx_scadenze_tipo ON scadenze_bandi_scadenze(tipo_scadenza);
CREATE INDEX IF NOT EXISTS idx_scadenze_priorita ON scadenze_bandi_scadenze(priorita);
CREATE INDEX IF NOT EXISTS idx_scadenze_responsabile ON scadenze_bandi_scadenze(assegnato_a);

-- 6. Trigger per updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at_column_scadenze()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scadenze_updated_at
    BEFORE UPDATE ON scadenze_bandi_scadenze
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column_scadenze();

-- 7. Funzione per calcolare giorni rimanenti
CREATE OR REPLACE FUNCTION giorni_rimanenti(data_scadenza DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN (data_scadenza - CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- 8. Vista per scadenze con calcoli automatici E info clienti
CREATE OR REPLACE VIEW scadenze_bandi_scadenze_view AS
SELECT
    s.*,
    giorni_rimanenti(s.data_scadenza) as giorni_rimanenti,
    CASE
        WHEN s.stato = 'COMPLETATA' THEN 'COMPLETATA'
        WHEN giorni_rimanenti(s.data_scadenza) < 0 THEN 'SCADUTA'
        WHEN giorni_rimanenti(s.data_scadenza) <= 2 THEN 'URGENTE'
        WHEN giorni_rimanenti(s.data_scadenza) <= 7 THEN 'IMMINENTE'
        WHEN giorni_rimanenti(s.data_scadenza) <= 15 THEN 'PROSSIMA'
        ELSE 'NORMALE'
    END as urgenza,
    -- Info cliente collegato
    c.denominazione as cliente_denominazione,
    c.email as cliente_email,
    c.telefono as cliente_telefono,
    c.piva as cliente_piva,
    c.codice_fiscale as cliente_codice_fiscale,
    c.dimensione_calcolata as cliente_dimensione
FROM scadenze_bandi_scadenze s
LEFT JOIN scadenze_bandi_clienti c ON s.cliente_id = c.id;

-- 9. Funzione per ottenere scadenze che necessitano alert
CREATE OR REPLACE FUNCTION get_scadenze_per_alert()
RETURNS TABLE (
    id UUID,
    titolo VARCHAR(255),
    data_scadenza DATE,
    giorni_rimanenti INTEGER,
    cliente_denominazione TEXT,
    email_responsabile VARCHAR(255),
    tipo_scadenza scadenze_tipo,
    cliente_email VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.titolo,
        s.data_scadenza,
        giorni_rimanenti(s.data_scadenza) as giorni_rimanenti,
        c.denominazione as cliente_denominazione,
        s.email_responsabile,
        s.tipo_scadenza,
        c.email as cliente_email
    FROM scadenze_bandi_scadenze s
    LEFT JOIN scadenze_bandi_clienti c ON s.cliente_id = c.id
    WHERE s.stato IN ('DA_FARE', 'IN_CORSO')
    AND giorni_rimanenti(s.data_scadenza) = ANY(s.giorni_preavviso)
    AND giorni_rimanenti(s.data_scadenza) >= 0
    ORDER BY giorni_rimanenti(s.data_scadenza) ASC;
END;
$$ LANGUAGE plpgsql;

-- 10. Tabella per il log delle notifiche inviate
CREATE TABLE IF NOT EXISTS scadenze_bandi_notifiche_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scadenza_id UUID NOT NULL REFERENCES scadenze_bandi_scadenze(id) ON DELETE CASCADE,
    tipo_notifica VARCHAR(50) NOT NULL, -- 'EMAIL', 'SMS', 'WHATSAPP', 'IN_APP'
    destinatario VARCHAR(255) NOT NULL,
    messaggio TEXT,
    inviata_il TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stato_invio VARCHAR(20) DEFAULT 'INVIATA', -- 'INVIATA', 'ERRORE', 'PENDING'
    errore_dettaglio TEXT,
    giorni_preavviso INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifiche_scadenza ON scadenze_bandi_notifiche_log(scadenza_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_data ON scadenze_bandi_notifiche_log(inviata_il);

-- 11. Dati di esempio per testing (con clienti collegati)
-- Prendo il primo cliente esistente per collegare le scadenze di esempio
INSERT INTO scadenze_bandi_scadenze (
    titolo,
    descrizione,
    tipo_scadenza,
    data_scadenza,
    priorita,
    assegnato_a,
    email_responsabile,
    cliente_id,
    bando_nome,
    note
)
SELECT
    'Accettazione Decreto Comune Digitale',
    'Accettazione formale del decreto di concessione per il bando Comune Digitale',
    'ACCETTAZIONE_DECRETO',
    CURRENT_DATE + INTERVAL '15 days',
    'ALTA',
    'Marco Rossi',
    'marco.rossi@blmproject.it',
    c.id,
    'Comune Digitale 2024',
    'Decreto ricevuto il ' || CURRENT_DATE
FROM scadenze_bandi_clienti c
LIMIT 1;

INSERT INTO scadenze_bandi_scadenze (
    titolo,
    descrizione,
    tipo_scadenza,
    data_scadenza,
    priorita,
    assegnato_a,
    email_responsabile,
    cliente_id,
    bando_nome,
    note
)
SELECT
    'Rendicontazione Q1 Bando Turismo',
    'Prima rendicontazione trimestrale per il progetto turismo sostenibile',
    'SCADENZA_RENDICONTAZIONE',
    CURRENT_DATE + INTERVAL '7 days',
    'CRITICA',
    'Lucia Bianchi',
    'lucia.bianchi@blmproject.it',
    c.id,
    'Turismo Sostenibile 2024',
    'Preparare documentazione spese Q1'
FROM scadenze_bandi_clienti c
LIMIT 1;

INSERT INTO scadenze_bandi_scadenze (
    titolo,
    descrizione,
    tipo_scadenza,
    data_scadenza,
    priorita,
    assegnato_a,
    email_responsabile,
    cliente_id,
    bando_nome,
    note
)
SELECT
    'Richiesta Anticipo Bando Innovazione',
    'Richiesta del primo anticipo per avvio attività progettuali',
    'RICHIESTA_ANTICIPO',
    CURRENT_DATE + INTERVAL '30 days',
    'MEDIA',
    'Alessandro Verdi',
    'alessandro.verdi@blmproject.it',
    c.id,
    'Innovazione PMI 2024',
    'Anticipo 30% del contributo totale'
FROM scadenze_bandi_clienti c
LIMIT 1;

INSERT INTO scadenze_bandi_scadenze (
    titolo,
    descrizione,
    tipo_scadenza,
    data_scadenza,
    priorita,
    assegnato_a,
    email_responsabile,
    cliente_id,
    bando_nome,
    note
)
SELECT
    'Scadenza URGENTE Test',
    'Scadenza di test per verificare il sistema di alert',
    'SCADENZA_INTERAZIONE',
    CURRENT_DATE + INTERVAL '2 days',
    'CRITICA',
    'Admin Test',
    'admin@blmproject.it',
    c.id,
    'Bando Test',
    'Scadenza di test molto urgente'
FROM scadenze_bandi_clienti c
LIMIT 1;

INSERT INTO scadenze_bandi_scadenze (
    titolo,
    descrizione,
    tipo_scadenza,
    data_scadenza,
    priorita,
    assegnato_a,
    email_responsabile,
    cliente_id,
    bando_nome,
    note
)
SELECT
    'Scadenza OGGI',
    'Scadenza per oggi per testare il sistema',
    'FINE_PROGETTO',
    CURRENT_DATE,
    'CRITICA',
    'Admin Test',
    'admin@blmproject.it',
    c.id,
    'Progetto Test',
    'Scadenza oggi'
FROM scadenze_bandi_clienti c
LIMIT 1;

-- 12. Commenti per documentazione
COMMENT ON TABLE scadenze_bandi_scadenze IS
'Tabella principale per la gestione delle scadenze di bandi e progetti. Collegata ai clienti esistenti e supporta alert progressivi e notifiche multi-canale.';

COMMENT ON COLUMN scadenze_bandi_scadenze.giorni_preavviso IS
'Array di giorni prima della scadenza quando inviare alert (es: {30,15,10,7,2,1})';

COMMENT ON COLUMN scadenze_bandi_scadenze.alert_inviati IS
'JSON che traccia quali alert sono già stati inviati per evitare duplicati';

COMMENT ON VIEW scadenze_bandi_scadenze_view IS
'Vista con calcoli automatici di giorni rimanenti, livello di urgenza e informazioni complete del cliente collegato';

COMMENT ON FUNCTION get_scadenze_per_alert() IS
'Funzione per ottenere tutte le scadenze che necessitano di invio alert in base ai giorni di preavviso configurati, con informazioni complete del cliente';