-- Elenco partecipanti per singolo corso
-- Il lookup sul cliente avviene tramite il corso

CREATE TABLE IF NOT EXISTS scadenze_bandi_partecipanti_formazione (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corso_id UUID NOT NULL REFERENCES scadenze_bandi_corsi_formativi(id) ON DELETE CASCADE,
  cognome VARCHAR(100) NOT NULL,
  nome VARCHAR(100) NOT NULL,
  codice_fiscale VARCHAR(16),
  qualifica VARCHAR(200),                        -- dirigente, quadro, impiegato, operaio, apprendista
  ruolo_sicurezza VARCHAR(100),                  -- RSPP, RLS, preposto, dirigente, lavoratore, etc.
  presente BOOLEAN DEFAULT TRUE,
  ore_frequentate NUMERIC(5,1),
  esito VARCHAR(30) DEFAULT 'NON_APPLICABILE'
    CHECK (esito IN ('SUPERATO', 'NON_SUPERATO', 'NON_APPLICABILE')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partecipanti_formazione_corso
  ON scadenze_bandi_partecipanti_formazione(corso_id);

-- Per individuare la storia formativa di una persona
CREATE INDEX IF NOT EXISTS idx_partecipanti_formazione_cf
  ON scadenze_bandi_partecipanti_formazione(codice_fiscale);
