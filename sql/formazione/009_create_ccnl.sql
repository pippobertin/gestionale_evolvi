-- =============================================
-- 009: Tabella lookup CCNL
-- =============================================
-- Contratti Collettivi Nazionali di Lavoro
-- I dati vengono importati dal CSV dell'archivio CNEL
-- tramite l'endpoint /api/formazione/import-ccnl

CREATE TABLE IF NOT EXISTS scadenze_bandi_ccnl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codice VARCHAR(300) UNIQUE NOT NULL,
  denominazione VARCHAR(500) NOT NULL,
  settore VARCHAR(100) NOT NULL,
  attivo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccnl_settore ON scadenze_bandi_ccnl(settore);
CREATE INDEX IF NOT EXISTS idx_ccnl_denominazione ON scadenze_bandi_ccnl(denominazione);
