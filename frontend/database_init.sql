-- Gestionale Evolvi - Schema Database
-- Creazione tabelle principali

-- Tabella utenti (per autenticazione)
CREATE TABLE IF NOT EXISTS utenti (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nome VARCHAR(100) NOT NULL,
  cognome VARCHAR(100) NOT NULL,
  livello_permessi VARCHAR(20) DEFAULT 'collaboratore' CHECK (livello_permessi IN ('admin', 'collaboratore')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella clienti
CREATE TABLE IF NOT EXISTS clienti (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  denominazione VARCHAR(255) NOT NULL,
  partita_iva VARCHAR(11) UNIQUE,
  codice_fiscale VARCHAR(16) UNIQUE,
  indirizzo TEXT,
  citta VARCHAR(100),
  cap VARCHAR(5),
  provincia VARCHAR(2),
  telefono VARCHAR(20),
  email VARCHAR(255),
  pec VARCHAR(255),
  referente_nome VARCHAR(100),
  referente_ruolo VARCHAR(100),
  note_cliente TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES utenti(id)
);

-- Tabella bandi
CREATE TABLE IF NOT EXISTS bandi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  codice_bando VARCHAR(100) UNIQUE NOT NULL,
  ente_finanziatore VARCHAR(255),
  descrizione TEXT,
  tipologia_bando VARCHAR(100),
  stato VARCHAR(50) DEFAULT 'ATTIVO' CHECK (stato IN ('ATTIVO', 'CHIUSO', 'SOSPESO')),
  data_apertura DATE,
  data_chiusura DATE,
  contributo_massimo DECIMAL(15,2),
  percentuale_contributo DECIMAL(5,2),
  tipologia_beneficiari TEXT,
  settori_ammissibili TEXT[],
  link_bando TEXT,
  documenti_richiesti TEXT[],
  note_bando TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES utenti(id)
);

-- Tabella progetti
CREATE TABLE IF NOT EXISTS progetti (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bando_id UUID REFERENCES bandi(id),
  cliente_id UUID REFERENCES clienti(id) NOT NULL,
  codice_progetto VARCHAR(100) UNIQUE NOT NULL,
  titolo_progetto VARCHAR(255) NOT NULL,
  descrizione_progetto TEXT,
  stato VARCHAR(50) DEFAULT 'DECRETO_ATTESO' CHECK (stato IN ('DECRETO_ATTESO', 'DECRETO_RICEVUTO', 'ACCETTATO', 'IN_CORSO', 'COMPLETATO')),
  importo_totale_progetto DECIMAL(15,2),
  contributo_ammesso DECIMAL(15,2),
  percentuale_contributo DECIMAL(5,2),
  data_base_calcolo DATE,
  evento_base_id UUID,
  anticipo_richiedibile BOOLEAN DEFAULT false,
  percentuale_anticipo DECIMAL(5,2) DEFAULT 0,
  numero_sal VARCHAR(10) DEFAULT 'UNICO' CHECK (numero_sal IN ('UNICO', 'DUE', 'TRE')),
  proroga_richiedibile BOOLEAN DEFAULT false,
  referente_interno VARCHAR(100),
  email_referente_interno VARCHAR(255),
  note_progetto TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES utenti(id)
);

-- Tabella eventi progetto
CREATE TABLE IF NOT EXISTS eventi_progetto (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  progetto_id UUID REFERENCES progetti(id) ON DELETE CASCADE,
  evento_id UUID NOT NULL,
  data_evento DATE,
  note_evento TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella documenti
CREATE TABLE IF NOT EXISTS documenti (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  progetto_id UUID REFERENCES progetti(id),
  bando_id UUID REFERENCES bandi(id),
  nome_file VARCHAR(255) NOT NULL,
  url_file TEXT NOT NULL,
  tipo_documento VARCHAR(100),
  categoria VARCHAR(100) CHECK (categoria IN ('allegati', 'normativa')),
  inherited_from_bando BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'to_compile', 'compiled')),
  descrizione TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES utenti(id)
);

-- Tabella scadenze
CREATE TABLE IF NOT EXISTS scadenze (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  progetto_id UUID REFERENCES progetti(id),
  bando_id UUID REFERENCES bandi(id),
  cliente_id UUID REFERENCES clienti(id),
  titolo VARCHAR(255) NOT NULL,
  descrizione TEXT,
  data_scadenza DATE NOT NULL,
  priorita VARCHAR(20) DEFAULT 'media' CHECK (priorita IN ('bassa', 'media', 'alta', 'critica')),
  stato VARCHAR(20) DEFAULT 'da_fare' CHECK (stato IN ('da_fare', 'in_corso', 'completata', 'rinviata')),
  tipo VARCHAR(50) DEFAULT 'custom' CHECK (tipo IN ('custom', 'milestone', 'documenti', 'pagamento')),
  note_scadenza TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES utenti(id)
);

-- Indici per prestazioni
CREATE INDEX IF NOT EXISTS idx_clienti_denominazione ON clienti(denominazione);
CREATE INDEX IF NOT EXISTS idx_bandi_nome ON bandi(nome);
CREATE INDEX IF NOT EXISTS idx_progetti_codice ON progetti(codice_progetto);
CREATE INDEX IF NOT EXISTS idx_progetti_cliente ON progetti(cliente_id);
CREATE INDEX IF NOT EXISTS idx_progetti_bando ON progetti(bando_id);
CREATE INDEX IF NOT EXISTS idx_documenti_progetto ON documenti(progetto_id);
CREATE INDEX IF NOT EXISTS idx_documenti_bando ON documenti(bando_id);
CREATE INDEX IF NOT EXISTS idx_scadenze_data ON scadenze(data_scadenza);
CREATE INDEX IF NOT EXISTS idx_scadenze_progetto ON scadenze(progetto_id);

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Applicazione trigger a tutte le tabelle
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('utenti', 'clienti', 'bandi', 'progetti', 'documenti', 'scadenze')
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS update_' || t || '_updated_at ON ' || t;
        EXECUTE 'CREATE TRIGGER update_' || t || '_updated_at BEFORE UPDATE ON ' || t || ' FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
    END LOOP;
END;
$$;

-- Utente admin di default
INSERT INTO utenti (email, password_hash, nome, cognome, livello_permessi)
VALUES ('admin@blm.com', '$2b$10$rQZ1vZ1wOcGxKGsJCJCJOer4O9dL/xZ9K1kR8Z9Z9Z9Z9Z9Z9Z9Z9', 'Admin', 'Sistema', 'admin')
ON CONFLICT (email) DO NOTHING;