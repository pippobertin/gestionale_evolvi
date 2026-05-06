-- =============================================
-- 008: Documenti Formazione
-- =============================================
-- Documenti allegati alla sezione formazione (attestati, registri presenze, verbali, ecc.)

CREATE TABLE IF NOT EXISTS scadenze_bandi_documenti_formazione (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'ALTRO'
    CHECK (categoria IN (
      'REGISTRO_PRESENZE',
      'ATTESTATO',
      'VERBALE',
      'PROGRAMMA',
      'RENDICONTAZIONE',
      'PROGETTO_FORMATIVO',
      'MATERIALE_DIDATTICO',
      'COMUNICAZIONI_FONDO',
      'ALTRO'
    )),
  nome_file TEXT NOT NULL,
  descrizione TEXT,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id),
  piano_id UUID REFERENCES scadenze_bandi_piani_formativi(id) ON DELETE SET NULL,
  corso_id UUID REFERENCES scadenze_bandi_corsi_formativi(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_documenti_formazione_cliente
  ON scadenze_bandi_documenti_formazione(cliente_id);

CREATE INDEX IF NOT EXISTS idx_documenti_formazione_piano
  ON scadenze_bandi_documenti_formazione(piano_id);

CREATE INDEX IF NOT EXISTS idx_documenti_formazione_corso
  ON scadenze_bandi_documenti_formazione(corso_id);
