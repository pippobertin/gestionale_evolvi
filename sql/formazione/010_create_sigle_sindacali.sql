-- =============================================
-- 010: Firmatari CCNL + Tabella di associazione
-- =============================================
-- I firmatari (sigle sindacali e associazioni datoriali)
-- vengono importati dal CSV dell'archivio CNEL
-- tramite l'endpoint /api/formazione/import-ccnl

CREATE TABLE IF NOT EXISTS scadenze_bandi_sigle_sindacali (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sigla VARCHAR(200) UNIQUE NOT NULL,
  nome_completo VARCHAR(300) NOT NULL DEFAULT '',
  confederazione VARCHAR(100) DEFAULT '',
  attivo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella di associazione: quali firmatari sono parte di ciascun CCNL
CREATE TABLE IF NOT EXISTS scadenze_bandi_ccnl_sigle (
  ccnl_id UUID NOT NULL REFERENCES scadenze_bandi_ccnl(id) ON DELETE CASCADE,
  sigla_id UUID NOT NULL REFERENCES scadenze_bandi_sigle_sindacali(id) ON DELETE CASCADE,
  PRIMARY KEY (ccnl_id, sigla_id)
);

CREATE INDEX IF NOT EXISTS idx_ccnl_sigle_ccnl ON scadenze_bandi_ccnl_sigle(ccnl_id);
CREATE INDEX IF NOT EXISTS idx_ccnl_sigle_sigla ON scadenze_bandi_ccnl_sigle(sigla_id);
