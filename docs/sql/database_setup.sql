-- Database Schema per Gestione Scadenze Bandi
-- Supabase SQL Script

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE scadenze_bandi_stato_bando AS ENUM ('attivo', 'archiviato');
CREATE TYPE scadenze_bandi_stato_progetto AS ENUM ('attivo', 'completato', 'sospeso');
CREATE TYPE scadenze_bandi_stato_scadenza AS ENUM ('non_iniziata', 'in_corso', 'completata', 'annullata');
CREATE TYPE scadenze_bandi_priorita AS ENUM ('bassa', 'media', 'alta', 'critica');

-- Tabella Bandi
CREATE TABLE scadenze_bandi_bandi (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    descrizione TEXT,
    tipo_bando TEXT,
    stato scadenze_bandi_stato_bando DEFAULT 'attivo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella Clienti
CREATE TABLE scadenze_bandi_clienti (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    email TEXT,
    telefono TEXT,
    settore TEXT,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella Tipologie Scadenze (template riutilizzabili)
CREATE TABLE scadenze_bandi_tipologie_scadenze (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    descrizione TEXT,
    giorni_preavviso_default INTEGER[] DEFAULT ARRAY[30, 15, 7, 1],
    colore_hex TEXT DEFAULT '#3B82F6',
    ordine_visualizzazione INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella Progetti (combinazione bando-cliente)
CREATE TABLE scadenze_bandi_progetti (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bando_id UUID NOT NULL REFERENCES scadenze_bandi_bandi(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
    nome_progetto TEXT NOT NULL,
    data_inizio DATE,
    data_fine_prevista DATE,
    stato scadenze_bandi_stato_progetto DEFAULT 'attivo',
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraint per evitare duplicati bando-cliente
    UNIQUE(bando_id, cliente_id)
);

-- Tabella Scadenze
CREATE TABLE scadenze_bandi_scadenze (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    progetto_id UUID NOT NULL REFERENCES scadenze_bandi_progetti(id) ON DELETE CASCADE,
    tipologia_scadenza_id UUID NOT NULL REFERENCES scadenze_bandi_tipologie_scadenze(id) ON DELETE RESTRICT,
    data_scadenza TIMESTAMP WITH TIME ZONE NOT NULL,
    stato scadenze_bandi_stato_scadenza DEFAULT 'non_iniziata',
    priorita scadenze_bandi_priorita DEFAULT 'media',
    responsabile_email TEXT,
    note TEXT,
    completata_da TEXT,
    completata_il TIMESTAMP WITH TIME ZONE,
    giorni_preavviso INTEGER[] DEFAULT ARRAY[30, 15, 7, 1],
    alert_inviati INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX idx_scadenze_data_scadenza ON scadenze_bandi_scadenze(data_scadenza);
CREATE INDEX idx_scadenze_stato ON scadenze_bandi_scadenze(stato);
CREATE INDEX idx_scadenze_progetto ON scadenze_bandi_scadenze(progetto_id);
CREATE INDEX idx_progetti_bando ON scadenze_bandi_progetti(bando_id);
CREATE INDEX idx_progetti_cliente ON scadenze_bandi_progetti(cliente_id);

-- Trigger per updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bandi_updated_at BEFORE UPDATE ON scadenze_bandi_bandi
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clienti_updated_at BEFORE UPDATE ON scadenze_bandi_clienti
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tipologie_updated_at BEFORE UPDATE ON scadenze_bandi_tipologie_scadenze
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_progetti_updated_at BEFORE UPDATE ON scadenze_bandi_progetti
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scadenze_updated_at BEFORE UPDATE ON scadenze_bandi_scadenze
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vista per dashboard con informazioni aggregate
CREATE VIEW scadenze_bandi_dashboard AS
SELECT
    s.id,
    s.data_scadenza,
    s.stato,
    s.priorita,
    s.responsabile_email,
    s.note as nota_scadenza,
    ts.nome as tipo_scadenza,
    ts.colore_hex,
    p.nome_progetto,
    b.nome as nome_bando,
    c.nome as nome_cliente,
    c.email as email_cliente,
    EXTRACT(DAYS FROM (s.data_scadenza - NOW())) as giorni_rimanenti
FROM scadenze_bandi_scadenze s
JOIN scadenze_bandi_tipologie_scadenze ts ON s.tipologia_scadenza_id = ts.id
JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id
WHERE s.stato != 'completata'
ORDER BY s.data_scadenza ASC;

-- Funzione per ottenere scadenze in arrivo
CREATE OR REPLACE FUNCTION get_scadenze_prossime(giorni_limite INTEGER DEFAULT 30)
RETURNS TABLE (
    id UUID,
    data_scadenza TIMESTAMP WITH TIME ZONE,
    giorni_rimanenti NUMERIC,
    tipo_scadenza TEXT,
    progetto TEXT,
    bando TEXT,
    cliente TEXT,
    priorita scadenze_bandi_priorita,
    responsabile_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.data_scadenza,
        EXTRACT(DAYS FROM (s.data_scadenza - NOW())) as giorni_rimanenti,
        ts.nome as tipo_scadenza,
        p.nome_progetto as progetto,
        b.nome as bando,
        c.nome as cliente,
        s.priorita,
        s.responsabile_email
    FROM scadenze_bandi_scadenze s
    JOIN scadenze_bandi_tipologie_scadenze ts ON s.tipologia_scadenza_id = ts.id
    JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
    JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
    JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id
    WHERE s.stato != 'completata'
    AND s.data_scadenza <= NOW() + INTERVAL '1 day' * giorni_limite
    ORDER BY s.data_scadenza ASC;
END;
$$ LANGUAGE plpgsql;