-- =============================================================================
-- Migration 013: Relazione Consulenti <-> Clienti
-- Date: 2026-04-27
-- Feature: Tabella di relazione per collegare consulenti ai clienti segnalati
-- =============================================================================

CREATE TABLE IF NOT EXISTS scadenze_bandi_consulenti_clienti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consulente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
  tipo_segnalazione TEXT NOT NULL CHECK (tipo_segnalazione IN ('bandi', 'spot', 'formazione')),
  data_segnalazione DATE DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(consulente_id, cliente_id, tipo_segnalazione)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consulenti_clienti_consulente
  ON scadenze_bandi_consulenti_clienti(consulente_id);
CREATE INDEX IF NOT EXISTS idx_consulenti_clienti_cliente
  ON scadenze_bandi_consulenti_clienti(cliente_id);

-- RLS
ALTER TABLE scadenze_bandi_consulenti_clienti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accesso completo consulenti_clienti"
  ON scadenze_bandi_consulenti_clienti FOR ALL USING (true);
