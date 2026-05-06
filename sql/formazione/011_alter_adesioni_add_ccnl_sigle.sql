-- =============================================
-- 011: Aggiunge ccnl_id e sigle_sindacali_ids alla tabella adesioni FPI
-- =============================================

ALTER TABLE scadenze_bandi_clienti_adesioni_fpi
  ADD COLUMN IF NOT EXISTS ccnl_id UUID REFERENCES scadenze_bandi_ccnl(id),
  ADD COLUMN IF NOT EXISTS sigle_sindacali_ids UUID[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_adesioni_fpi_ccnl
  ON scadenze_bandi_clienti_adesioni_fpi(ccnl_id);
