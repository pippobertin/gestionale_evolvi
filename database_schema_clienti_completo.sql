-- Schema Database Completo per CRM Bandi
-- Basato sui dati reali VTE Next

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE scadenze_bandi_stato_bando AS ENUM ('attivo', 'archiviato');
CREATE TYPE scadenze_bandi_stato_progetto AS ENUM ('attivo', 'completato', 'sospeso');
CREATE TYPE scadenze_bandi_stato_scadenza AS ENUM ('non_iniziata', 'in_corso', 'completata', 'annullata');
CREATE TYPE scadenze_bandi_priorita AS ENUM ('bassa', 'media', 'alta', 'critica');
CREATE TYPE scadenze_bandi_dimensione_azienda AS ENUM ('MICRO', 'PICCOLA', 'MEDIA', 'GRANDE');
CREATE TYPE scadenze_bandi_sesso AS ENUM ('M', 'F');
CREATE TYPE scadenze_bandi_categoria_evolvi AS ENUM ('BASE', 'PREMIUM', 'BUSINESS', 'ENTERPRISE');

-- Tabella Clienti (Aziende) - Schema completo basato su VTE
CREATE TABLE scadenze_bandi_clienti (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Dati Aziendali Base
    denominazione TEXT NOT NULL,
    numero_azienda TEXT UNIQUE,
    partita_iva TEXT,
    rea TEXT,
    codice_fiscale TEXT,
    ateco TEXT,
    data_costituzione DATE,

    -- Contatti
    email TEXT,
    pec TEXT,
    telefono TEXT,
    sito_web TEXT,
    coordinate_bancarie TEXT,
    sdi TEXT,

    -- Indirizzo Fatturazione
    indirizzo_fatturazione TEXT,
    cap_fatturazione TEXT,
    citta_fatturazione TEXT,
    provincia_fatturazione TEXT,
    stato_fatturazione TEXT DEFAULT 'Italia',

    -- Dimensionamento (cruciale per bandi)
    ula DECIMAL(10,2), -- Unità Lavorative Annue
    ultimo_fatturato DECIMAL(15,2),
    attivo_bilancio DECIMAL(15,2),
    dimensione scadenze_bandi_dimensione_azienda,
    matricola_inps TEXT,
    pat_inail TEXT,
    numero_dipendenti INTEGER DEFAULT 0,
    numero_volontari INTEGER DEFAULT 0,
    numero_collaboratori INTEGER DEFAULT 0,

    -- Dati Evolvi (gestione contratti)
    categoria_evolvi scadenze_bandi_categoria_evolvi,
    durata_evolvi TEXT,
    scadenza_evolvi DATE,

    -- Gestione
    assegnato_a TEXT,
    target TEXT,
    membro_di TEXT,
    proprietario TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    descrizione TEXT,
    note TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    creato_da TEXT
);

-- Tabella Legali Rappresentanti
CREATE TABLE scadenze_bandi_legali_rappresentanti (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,

    cognome TEXT NOT NULL,
    nome TEXT NOT NULL,
    codice_fiscale TEXT,
    sesso scadenze_bandi_sesso,
    luogo_nascita TEXT,
    data_nascita DATE,
    email TEXT,
    telefono TEXT,

    -- Residenza
    citta_residenza TEXT,
    cap_residenza TEXT,
    indirizzo_residenza TEXT,
    numero_civico TEXT,

    in_qualita_di TEXT DEFAULT 'Legale Rappresentante',
    presente BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella Contatti Azienda (persone di riferimento)
CREATE TABLE scadenze_bandi_contatti (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,

    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    email TEXT,
    telefono TEXT,
    ruolo TEXT,
    dipartimento TEXT,
    note TEXT,
    principale BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella Documenti Azienda
CREATE TABLE scadenze_bandi_documenti_cliente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,

    tipo_documento TEXT NOT NULL, -- 'VISURA', 'STATUTO', 'BILANCIO', 'DURC', etc.
    nome_file TEXT,
    path_file TEXT,
    scadenza_validita DATE,
    certificato BOOLEAN DEFAULT false,
    anno_riferimento INTEGER,
    note TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella Bandi (mantenuta dalla struttura precedente)
CREATE TABLE scadenze_bandi_bandi (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    descrizione TEXT,
    tipo_bando TEXT,
    stato scadenze_bandi_stato_bando DEFAULT 'attivo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella Progetti (combinazione bando-cliente)
CREATE TABLE scadenze_bandi_progetti (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bando_id UUID REFERENCES scadenze_bandi_bandi(id),
    cliente_id UUID REFERENCES scadenze_bandi_clienti(id),
    nome TEXT NOT NULL,
    descrizione TEXT,
    importo_richiesto DECIMAL(15,2),
    importo_approvato DECIMAL(15,2),
    stato scadenze_bandi_stato_progetto DEFAULT 'attivo',
    data_inizio DATE,
    data_fine DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella Tipologie Scadenze
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

-- Tabella Scadenze
CREATE TABLE scadenze_bandi_scadenze (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    progetto_id UUID REFERENCES scadenze_bandi_progetti(id),
    tipologia_id UUID REFERENCES scadenze_bandi_tipologie_scadenze(id),
    titolo TEXT NOT NULL,
    descrizione TEXT,
    data_scadenza TIMESTAMP WITH TIME ZONE NOT NULL,
    priorita scadenze_bandi_priorita DEFAULT 'media',
    stato scadenze_bandi_stato_scadenza DEFAULT 'non_iniziata',
    notificato BOOLEAN DEFAULT FALSE,
    giorni_preavviso INTEGER[] DEFAULT ARRAY[30, 15, 7, 1],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes per performance
CREATE INDEX idx_clienti_denominazione ON scadenze_bandi_clienti(denominazione);
CREATE INDEX idx_clienti_partita_iva ON scadenze_bandi_clienti(partita_iva);
CREATE INDEX idx_clienti_dimensione ON scadenze_bandi_clienti(dimensione);
CREATE INDEX idx_legali_rappresentanti_cliente ON scadenze_bandi_legali_rappresentanti(cliente_id);
CREATE INDEX idx_contatti_cliente ON scadenze_bandi_contatti(cliente_id);
CREATE INDEX idx_documenti_cliente ON scadenze_bandi_documenti_cliente(cliente_id);
CREATE INDEX idx_progetti_cliente ON scadenze_bandi_progetti(cliente_id);
CREATE INDEX idx_scadenze_data ON scadenze_bandi_scadenze(data_scadenza);

-- Triggers per updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clienti_updated_at BEFORE UPDATE ON scadenze_bandi_clienti FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_legali_rappresentanti_updated_at BEFORE UPDATE ON scadenze_bandi_legali_rappresentanti FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_contatti_updated_at BEFORE UPDATE ON scadenze_bandi_contatti FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_documenti_updated_at BEFORE UPDATE ON scadenze_bandi_documenti_cliente FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- View per lista clienti con informazioni aggregate
CREATE VIEW scadenze_bandi_view_clienti_lista AS
SELECT
    c.id,
    c.denominazione,
    c.partita_iva,
    c.email,
    c.telefono,
    c.dimensione,
    c.ultimo_fatturato,
    c.numero_dipendenti,
    c.categoria_evolvi,
    c.scadenza_evolvi,
    lr.nome || ' ' || lr.cognome AS legale_rappresentante,
    COUNT(p.id) AS numero_progetti,
    c.created_at,
    c.updated_at
FROM scadenze_bandi_clienti c
LEFT JOIN scadenze_bandi_legali_rappresentanti lr ON c.id = lr.cliente_id
LEFT JOIN scadenze_bandi_progetti p ON c.id = p.cliente_id
GROUP BY c.id, lr.nome, lr.cognome
ORDER BY c.denominazione;