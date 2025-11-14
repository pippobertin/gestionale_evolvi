-- Schema Database Clienti - Update per evitare conflitti
-- Aggiornato secondo raccomandazione UE 2003/361/CE per PMI
-- Codici ATECO 2025 e rapporti di collegamento/controllo

-- Enable extensions (se non già abilitato)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Nuovi enum types secondo normativa UE
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scadenze_bandi_dimensione_azienda') THEN
        CREATE TYPE scadenze_bandi_dimensione_azienda AS ENUM ('MICRO', 'PICCOLA', 'MEDIA', 'GRANDE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scadenze_bandi_sesso') THEN
        CREATE TYPE scadenze_bandi_sesso AS ENUM ('M', 'F');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scadenze_bandi_categoria_evolvi') THEN
        CREATE TYPE scadenze_bandi_categoria_evolvi AS ENUM ('BASE', 'PREMIUM', 'BUSINESS', 'ENTERPRISE');
    END IF;

    -- Tipo per rapporti di collegamento (UE 2003/361/CE)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scadenze_bandi_tipo_collegamento') THEN
        CREATE TYPE scadenze_bandi_tipo_collegamento AS ENUM ('AUTONOMA', 'ASSOCIATA', 'COLLEGATA');
    END IF;
END $$;

-- Sequence per numero azienda auto-incrementale
CREATE SEQUENCE IF NOT EXISTS seq_numero_azienda START 1;

-- Elimina tutte le tabelle vecchie se esistono (ATTENZIONE: cancellerà i dati!)
DROP TABLE IF EXISTS scadenze_bandi_documenti_cliente CASCADE;
DROP TABLE IF EXISTS scadenze_bandi_contatti CASCADE;
DROP TABLE IF EXISTS scadenze_bandi_legali_rappresentanti CASCADE;
DROP TABLE IF EXISTS scadenze_bandi_clienti CASCADE;
DROP TABLE IF EXISTS scadenze_bandi_ateco_2025 CASCADE;

-- Tabella Clienti (Aziende) - Schema completo basato su VTE
CREATE TABLE scadenze_bandi_clienti (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Dati Aziendali Base
    denominazione TEXT NOT NULL,
    numero_azienda TEXT UNIQUE DEFAULT 'AZ' || EXTRACT(YEAR FROM NOW()) || LPAD(nextval('seq_numero_azienda')::TEXT, 6, '0'),
    partita_iva TEXT,
    rea TEXT,
    codice_fiscale TEXT,
    ateco_2025 TEXT, -- Codice ATECO 2025 (6 cifre max)
    ateco_descrizione TEXT, -- Descrizione attività
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

    -- Dimensionamento (cruciale per bandi) - Calcolo automatico secondo UE 2003/361/CE
    ula DECIMAL(10,2), -- Unità Lavorative Annue (< 250 per PMI)
    ultimo_fatturato DECIMAL(15,2), -- In euro (≤ 50M per medie imprese)
    attivo_bilancio DECIMAL(15,2), -- Totale di bilancio in euro (≤ 43M per medie)
    dimensione scadenze_bandi_dimensione_azienda GENERATED ALWAYS AS (
        CASE
            WHEN ula < 10 AND (ultimo_fatturato <= 2000000 OR attivo_bilancio <= 2000000) THEN 'MICRO'::scadenze_bandi_dimensione_azienda
            WHEN ula < 50 AND (ultimo_fatturato <= 10000000 OR attivo_bilancio <= 10000000) THEN 'PICCOLA'::scadenze_bandi_dimensione_azienda
            WHEN ula < 250 AND (ultimo_fatturato <= 50000000 OR attivo_bilancio <= 43000000) THEN 'MEDIA'::scadenze_bandi_dimensione_azienda
            ELSE 'GRANDE'::scadenze_bandi_dimensione_azienda
        END
    ) STORED,
    matricola_inps TEXT,
    pat_inail TEXT,
    numero_dipendenti INTEGER DEFAULT 0,
    numero_volontari INTEGER DEFAULT 0,
    numero_collaboratori INTEGER DEFAULT 0,

    -- Rapporti di collegamento/controllo secondo UE 2003/361/CE
    tipo_collegamento scadenze_bandi_tipo_collegamento DEFAULT 'AUTONOMA',
    impresa_collegata_id UUID REFERENCES scadenze_bandi_clienti(id),
    percentuale_partecipazione DECIMAL(5,2) CHECK (percentuale_partecipazione >= 0 AND percentuale_partecipazione <= 100),
    diritti_voto DECIMAL(5,2) CHECK (diritti_voto >= 0 AND diritti_voto <= 100),
    influenza_dominante BOOLEAN DEFAULT false,
    note_collegamento TEXT,

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

-- Indexes per performance
CREATE INDEX idx_clienti_denominazione ON scadenze_bandi_clienti(denominazione);
CREATE INDEX idx_clienti_partita_iva ON scadenze_bandi_clienti(partita_iva);
CREATE INDEX idx_clienti_dimensione ON scadenze_bandi_clienti(dimensione);
CREATE INDEX idx_legali_rappresentanti_cliente ON scadenze_bandi_legali_rappresentanti(cliente_id);
CREATE INDEX idx_contatti_cliente ON scadenze_bandi_contatti(cliente_id);
CREATE INDEX idx_documenti_cliente ON scadenze_bandi_documenti_cliente(cliente_id);

-- Triggers per updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_clienti_updated_at ON scadenze_bandi_clienti;
CREATE TRIGGER update_clienti_updated_at BEFORE UPDATE ON scadenze_bandi_clienti FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_legali_rappresentanti_updated_at ON scadenze_bandi_legali_rappresentanti;
CREATE TRIGGER update_legali_rappresentanti_updated_at BEFORE UPDATE ON scadenze_bandi_legali_rappresentanti FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_contatti_updated_at ON scadenze_bandi_contatti;
CREATE TRIGGER update_contatti_updated_at BEFORE UPDATE ON scadenze_bandi_contatti FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_documenti_updated_at ON scadenze_bandi_documenti_cliente;
CREATE TRIGGER update_documenti_updated_at BEFORE UPDATE ON scadenze_bandi_documenti_cliente FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- View per lista clienti con informazioni aggregate
DROP VIEW IF EXISTS scadenze_bandi_view_clienti_lista;
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

-- Tabella ATECO 2025 - Classificazione completa delle attività economiche
CREATE TABLE scadenze_bandi_ateco_2025 (
    codice TEXT PRIMARY KEY, -- Codice ATECO (fino a 6 cifre)
    descrizione TEXT NOT NULL,
    livello INTEGER NOT NULL CHECK (livello >= 1 AND livello <= 6),
    codice_padre TEXT REFERENCES scadenze_bandi_ateco_2025(codice),
    attivo BOOLEAN DEFAULT true,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes per ATECO
CREATE INDEX idx_ateco_descrizione ON scadenze_bandi_ateco_2025(descrizione);
CREATE INDEX idx_ateco_livello ON scadenze_bandi_ateco_2025(livello);
CREATE INDEX idx_ateco_padre ON scadenze_bandi_ateco_2025(codice_padre);

-- Inserimento codici ATECO 2025 principali (struttura gerarchica)
-- Sezioni (livello 1) - 21 sezioni da A a U
INSERT INTO scadenze_bandi_ateco_2025 (codice, descrizione, livello) VALUES
('A', 'Agricoltura, silvicoltura e pesca', 1),
('B', 'Estrazione di minerali da cave e miniere', 1),
('C', 'Attività manifatturiere', 1),
('D', 'Fornitura di energia elettrica, gas, vapore e aria condizionata', 1),
('E', 'Fornitura di acqua; reti fognarie, attività di gestione dei rifiuti e risanamento', 1),
('F', 'Costruzioni', 1),
('G', 'Commercio all''ingrosso e al dettaglio; riparazione di autoveicoli e motocicli', 1),
('H', 'Trasporto e magazzinaggio', 1),
('I', 'Attività dei servizi di alloggio e di ristorazione', 1),
('J', 'Servizi di informazione e comunicazione', 1),
('K', 'Attività finanziarie e assicurative', 1),
('L', 'Attività immobiliari', 1),
('M', 'Attività professionali, scientifiche e tecniche', 1),
('N', 'Noleggio, agenzie di viaggio, servizi di supporto alle imprese', 1),
('O', 'Amministrazione pubblica e difesa; assicurazione sociale obbligatoria', 1),
('P', 'Istruzione', 1),
('Q', 'Sanità e assistenza sociale', 1),
('R', 'Attività artistiche, sportive, di intrattenimento e divertimento', 1),
('S', 'Altre attività di servizi', 1),
('T', 'Attività di famiglie e convivenze come datori di lavoro per personale domestico', 1),
('U', 'Attività di organizzazioni e organismi extraterritoriali', 1);

-- Divisioni principali (livello 2) - Esempi delle più comuni
INSERT INTO scadenze_bandi_ateco_2025 (codice, descrizione, livello, codice_padre) VALUES
-- Sezione C - Attività manifatturiere
('10', 'Industrie alimentari', 2, 'C'),
('11', 'Industria delle bevande', 2, 'C'),
('13', 'Industrie tessili', 2, 'C'),
('14', 'Confezione di articoli di abbigliamento', 2, 'C'),
('16', 'Industria del legno e dei prodotti in legno e sughero', 2, 'C'),
('18', 'Stampa e riproduzione su supporti registrati', 2, 'C'),
('20', 'Fabbricazione di prodotti chimici', 2, 'C'),
('22', 'Fabbricazione di articoli in gomma e materie plastiche', 2, 'C'),
('23', 'Fabbricazione di altri prodotti della lavorazione di minerali non metalliferi', 2, 'C'),
('25', 'Fabbricazione di prodotti in metallo', 2, 'C'),
('26', 'Fabbricazione di computer e prodotti di elettronica e ottica', 2, 'C'),
('27', 'Fabbricazione di apparecchiature elettriche', 2, 'C'),
('28', 'Fabbricazione di macchinari e apparecchiature nca', 2, 'C'),
('29', 'Fabbricazione di autoveicoli, rimorchi e semirimorchi', 2, 'C'),
('30', 'Fabbricazione di altri mezzi di trasporto', 2, 'C'),
('31', 'Fabbricazione di mobili', 2, 'C'),
('32', 'Altre industrie manifatturiere', 2, 'C'),
-- Sezione F - Costruzioni
('41', 'Sviluppo di progetti immobiliari', 2, 'F'),
('42', 'Ingegneria civile', 2, 'F'),
('43', 'Lavori di costruzione specializzati', 2, 'F'),
-- Sezione G - Commercio
('45', 'Commercio all''ingrosso e al dettaglio e riparazione di autoveicoli e motocicli', 2, 'G'),
('46', 'Commercio all''ingrosso', 2, 'G'),
('47', 'Commercio al dettaglio', 2, 'G'),
-- Sezione J - Servizi ICT
('58', 'Attività editoriali', 2, 'J'),
('59', 'Attività di produzione cinematografica, di video e di programmi televisivi', 2, 'J'),
('60', 'Attività di programmazione e trasmissione', 2, 'J'),
('61', 'Telecomunicazioni', 2, 'J'),
('62', 'Produzione di software, consulenza informatica e attività connesse', 2, 'J'),
('63', 'Attività dei servizi d''informazione e altri servizi informatici', 2, 'J'),
-- Sezione M - Attività professionali
('69', 'Attività legali e contabilità', 2, 'M'),
('70', 'Attività di direzione aziendale e di consulenza gestionale', 2, 'M'),
('71', 'Attività degli studi di architettura e d''ingegneria', 2, 'M'),
('72', 'Ricerca scientifica e sviluppo', 2, 'M'),
('73', 'Pubblicità e ricerche di mercato', 2, 'M'),
('74', 'Altre attività professionali, scientifiche e tecniche', 2, 'M'),
('75', 'Servizi veterinari', 2, 'M');

-- Gruppi più comuni (livello 3) - Esempi
INSERT INTO scadenze_bandi_ateco_2025 (codice, descrizione, livello, codice_padre) VALUES
-- Software e ICT (molto rilevanti per i bandi)
('62.0', 'Produzione di software, consulenza informatica e attività connesse', 3, '62'),
('62.1', 'Produzione di software e consulenza informatica', 3, '62'),
('62.2', 'Consulenza nel settore delle tecnologie dell''informatica', 3, '62'),
-- Ricerca e sviluppo
('72.1', 'Ricerca e sviluppo sperimentale nel campo delle scienze naturali e dell''ingegneria', 3, '72'),
('72.2', 'Ricerca e sviluppo sperimentale nel campo delle scienze sociali e umanistiche', 3, '72'),
-- Consulenza
('70.1', 'Attività di direzione aziendale', 3, '70'),
('70.2', 'Attività di consulenza gestionale', 3, '70'),
-- Commercio elettronico
('47.9', 'Commercio al dettaglio via internet e per corrispondenza', 3, '47');

-- Classi più specifiche (livello 4) - Solo alcuni esempi per dimostrare la struttura
INSERT INTO scadenze_bandi_ateco_2025 (codice, descrizione, livello, codice_padre) VALUES
('62.01', 'Produzione di software non connesso all''edizione', 4, '62.0'),
('62.02', 'Consulenza nel settore delle tecnologie dell''informatica', 4, '62.0'),
('62.03', 'Gestione di strutture e apparecchiature informatiche hardware', 4, '62.0'),
('62.09', 'Altre attività dei servizi connessi alle tecnologie dell''informatica', 4, '62.0'),
('72.11', 'Ricerca e sviluppo sperimentale nel campo delle biotecnologie', 4, '72.1'),
('72.19', 'Ricerca e sviluppo sperimentale in altri campi delle scienze naturali e dell''ingegneria', 4, '72.1');

-- Sottoclassi (livello 5) - Esempi per dimostrare il formato completo
INSERT INTO scadenze_bandi_ateco_2025 (codice, descrizione, livello, codice_padre) VALUES
('62.01.0', 'Produzione di software non connesso all''edizione', 5, '62.01'),
('62.02.0', 'Consulenza nel settore delle tecnologie dell''informatica', 5, '62.02'),
('62.09.0', 'Altre attività dei servizi connessi alle tecnologie dell''informatica', 5, '62.09');

-- Categorie (livello 6) - Esempi per il formato finale a 6 cifre
INSERT INTO scadenze_bandi_ateco_2025 (codice, descrizione, livello, codice_padre) VALUES
('62.01.00', 'Produzione di software non connesso all''edizione', 6, '62.01.0'),
('62.02.00', 'Consulenza nel settore delle tecnologie dell''informatica', 6, '62.02.0'),
('62.09.00', 'Altre attività dei servizi connessi alle tecnologie dell''informatica', 6, '62.09.0');

-- Aggiorna riferimento ATECO nella tabella clienti
ALTER TABLE scadenze_bandi_clienti
ADD CONSTRAINT fk_clienti_ateco
FOREIGN KEY (ateco_2025) REFERENCES scadenze_bandi_ateco_2025(codice);

-- Inserisci alcuni dati di esempio
INSERT INTO scadenze_bandi_clienti (
    denominazione, partita_iva, codice_fiscale, email, telefono,
    ula, ultimo_fatturato, numero_dipendenti,
    categoria_evolvi, scadenza_evolvi
) VALUES
(
    'Esempio Azienda SRL',
    '12345678901',
    'XMPAAZ123456789A',
    'info@esempio.it',
    '+39 071 123456',
    2.5,
    325000,
    3,
    'PREMIUM',
    '2025-12-31'
),
(
    'Test Company SpA',
    '98765432109',
    'TSTCMP987654321B',
    'contact@testcompany.it',
    '+39 06 987654',
    15.2,
    2500000,
    18,
    'BUSINESS',
    '2026-06-30'
);