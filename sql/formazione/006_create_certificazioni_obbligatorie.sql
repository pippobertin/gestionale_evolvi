-- Certificazioni obbligatorie per adempimenti di legge
-- Logica di scadenza e rinnovo diversa dai corsi, tracciamento ricorrente

CREATE TABLE IF NOT EXISTS scadenze_bandi_certificazioni_obbligatorie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
  tipo_obbligo VARCHAR(100) NOT NULL
    CHECK (tipo_obbligo IN (
      'FORMAZIONE_LAVORATORI_RISCHIO_BASSO',
      'FORMAZIONE_LAVORATORI_RISCHIO_MEDIO',
      'FORMAZIONE_LAVORATORI_RISCHIO_ALTO',
      'RSPP',
      'DIRIGENTI_SSL',
      'PREPOSTI',
      'RLS',
      'ANTINCENDIO_BASSO',
      'ANTINCENDIO_MEDIO',
      'ANTINCENDIO_ALTO',
      'PRIMO_SOCCORSO',
      'HACCP',
      'PRIVACY_GDPR',
      'ANTIRICICLAGGIO',
      'ALTRO'
    )),
  normativa_riferimento VARCHAR(300),            -- es. "D.Lgs. 81/08 art. 37"
  persona_nome VARCHAR(200),                     -- se riferita a persona, altrimenti azienda
  persona_codice_fiscale VARCHAR(16),
  data_conseguimento DATE,
  data_scadenza DATE,
  validita_mesi INTEGER,                         -- per calcolo automatico rinnovo
  stato VARCHAR(30) DEFAULT 'VALIDA'
    CHECK (stato IN ('VALIDA', 'IN_SCADENZA', 'SCADUTA', 'DA_RINNOVARE')),
  corso_collegato_id UUID REFERENCES scadenze_bandi_corsi_formativi(id),
  file_attestato_storage_path VARCHAR(500),       -- path in Supabase Storage
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificazioni_cliente_scadenza
  ON scadenze_bandi_certificazioni_obbligatorie(cliente_id, data_scadenza);

CREATE INDEX IF NOT EXISTS idx_certificazioni_stato
  ON scadenze_bandi_certificazioni_obbligatorie(stato);
