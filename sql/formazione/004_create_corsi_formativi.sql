-- Singolo corso o edizione formativa
-- Puo' appartenere a un piano o essere standalone (es. formazione obbligatoria)

CREATE TABLE IF NOT EXISTS scadenze_bandi_corsi_formativi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
  piano_formativo_id UUID REFERENCES scadenze_bandi_piani_formativi(id),  -- NULL = corso standalone
  titolo VARCHAR(500) NOT NULL,
  area_tematica VARCHAR(200),                    -- Sicurezza, Gestionale, Linguistica, Digitale, Soft Skills
  modalita VARCHAR(50)
    CHECK (modalita IN ('AULA', 'ONLINE_SINCRONA', 'ONLINE_ASINCRONA', 'BLENDED', 'AFFIANCAMENTO')),
  ore_durata NUMERIC(5,1),
  data_inizio DATE,
  data_fine DATE,
  sede VARCHAR(500),
  ente_erogatore VARCHAR(300),
  docente VARCHAR(300),
  numero_partecipanti INTEGER,
  stato VARCHAR(30) DEFAULT 'PIANIFICATO'
    CHECK (stato IN ('PIANIFICATO', 'IN_CORSO', 'CONCLUSO', 'ANNULLATO')),
  attestato_rilasciato BOOLEAN DEFAULT FALSE,
  costo_totale NUMERIC(10,2),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corsi_formativi_cliente_data
  ON scadenze_bandi_corsi_formativi(cliente_id, data_inizio DESC);

CREATE INDEX IF NOT EXISTS idx_corsi_formativi_piano
  ON scadenze_bandi_corsi_formativi(piano_formativo_id);
