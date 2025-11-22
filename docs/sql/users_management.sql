-- Schema per gestione utenti e permessi
-- Sistema di autenticazione con email/password e controllo accessi

-- Tabella utenti
CREATE TABLE scadenze_bandi_utenti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    cognome VARCHAR(100) NOT NULL,
    livello_permessi VARCHAR(20) NOT NULL CHECK (livello_permessi IN ('admin', 'collaboratore')),
    attivo BOOLEAN NOT NULL DEFAULT true,
    ultimo_accesso TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES scadenze_bandi_utenti(id)
);

-- Tabella sessioni utente (per gestire login/logout)
CREATE TABLE scadenze_bandi_sessioni (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utente_id UUID NOT NULL REFERENCES scadenze_bandi_utenti(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aggiornamento automatico del timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger per aggiornare updated_at su utenti
CREATE TRIGGER update_scadenze_bandi_utenti_updated_at
    BEFORE UPDATE ON scadenze_bandi_utenti
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Aggiungi colonna created_by alle tabelle esistenti per il controllo accessi
-- (Esegui solo se non esistono già)

ALTER TABLE scadenze_bandi_clienti
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES scadenze_bandi_utenti(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES scadenze_bandi_utenti(id);

ALTER TABLE scadenze_bandi_bandi
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES scadenze_bandi_utenti(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES scadenze_bandi_utenti(id);

ALTER TABLE scadenze_bandi_progetti
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES scadenze_bandi_utenti(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES scadenze_bandi_utenti(id);

ALTER TABLE scadenze_bandi_scadenze
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES scadenze_bandi_utenti(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES scadenze_bandi_utenti(id);

-- Indici per performance
CREATE INDEX idx_scadenze_bandi_utenti_email ON scadenze_bandi_utenti(email);
CREATE INDEX idx_scadenze_bandi_utenti_livello ON scadenze_bandi_utenti(livello_permessi);
CREATE INDEX idx_scadenze_bandi_utenti_attivo ON scadenze_bandi_utenti(attivo);

CREATE INDEX idx_scadenze_bandi_sessioni_utente ON scadenze_bandi_sessioni(utente_id);
CREATE INDEX idx_scadenze_bandi_sessioni_token ON scadenze_bandi_sessioni(token_hash);
CREATE INDEX idx_scadenze_bandi_sessioni_expires ON scadenze_bandi_sessioni(expires_at);

-- Indici per le relazioni created_by
CREATE INDEX idx_scadenze_bandi_clienti_created_by ON scadenze_bandi_clienti(created_by);
CREATE INDEX idx_scadenze_bandi_bandi_created_by ON scadenze_bandi_bandi(created_by);
CREATE INDEX idx_scadenze_bandi_progetti_created_by ON scadenze_bandi_progetti(created_by);
CREATE INDEX idx_scadenze_bandi_scadenze_created_by ON scadenze_bandi_scadenze(created_by);

-- Vista utenti per uso nell'applicazione (senza password_hash)
CREATE OR REPLACE VIEW scadenze_bandi_utenti_view AS
SELECT
    id,
    email,
    nome,
    cognome,
    livello_permessi,
    attivo,
    ultimo_accesso,
    created_at,
    updated_at,
    created_by,
    CONCAT(nome, ' ', cognome) as nome_completo
FROM scadenze_bandi_utenti
WHERE attivo = true;

-- Funzione per pulizia automatica sessioni scadute
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM scadenze_bandi_sessioni
    WHERE expires_at < NOW();
END;
$$ LANGUAGE 'plpgsql';

-- Inserimento utente admin di default (password: 'admin123' - cambiare subito!)
-- NOTA: Questa password è hashata con bcrypt, rounds=10
INSERT INTO scadenze_bandi_utenti (
    email,
    password_hash,
    nome,
    cognome,
    livello_permessi,
    attivo
) VALUES (
    'admin@evolvi.it',
    '$2b$10$rKXaEz8MZlJr2kW5v7F6EuPQXNF8Zb9YCfH5Rj3Tg7Qw4E6M8Lp0A',
    'Admin',
    'Sistema',
    'admin',
    true
) ON CONFLICT (email) DO NOTHING;

-- Commenti per documentazione
COMMENT ON TABLE scadenze_bandi_utenti IS 'Tabella utenti del sistema con gestione permessi a livelli';
COMMENT ON COLUMN scadenze_bandi_utenti.livello_permessi IS 'admin: pieni poteri, collaboratore: non può eliminare/modificare cose create da admin';
COMMENT ON COLUMN scadenze_bandi_utenti.password_hash IS 'Password hashata con bcrypt';

COMMENT ON TABLE scadenze_bandi_sessioni IS 'Sessioni attive degli utenti per gestire login/logout';
COMMENT ON COLUMN scadenze_bandi_sessioni.token_hash IS 'Hash del token di sessione per sicurezza';

COMMENT ON VIEW scadenze_bandi_utenti_view IS 'Vista utenti senza dati sensibili per uso nell''applicazione';