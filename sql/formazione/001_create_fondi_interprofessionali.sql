-- Anagrafica fondi paritetici interprofessionali (lookup, preseedata)
-- Solo admin può modificare questa tabella

CREATE TABLE IF NOT EXISTS scadenze_bandi_fondi_interprofessionali (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codice VARCHAR(30) UNIQUE NOT NULL,          -- es. FONDIMPRESA, FORTE, FONDARTIGIANATO
  nome VARCHAR(200) NOT NULL,                   -- nome esteso del fondo
  sigla VARCHAR(30),                            -- abbreviazione comune
  settori_ccnl TEXT[],                          -- array CCNL tipicamente associati
  url_area_riservata VARCHAR(500),              -- link portale del fondo
  note TEXT,
  attivo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice per lookup rapido
CREATE INDEX IF NOT EXISTS idx_fondi_interprofessionali_codice
  ON scadenze_bandi_fondi_interprofessionali(codice);

CREATE INDEX IF NOT EXISTS idx_fondi_interprofessionali_attivo
  ON scadenze_bandi_fondi_interprofessionali(attivo);
