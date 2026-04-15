-- =============================================
-- 012: Tabella Uffici/Dipartimenti + colonna referenti
-- =============================================

CREATE TABLE IF NOT EXISTS scadenze_bandi_uffici_dipartimenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(150) NOT NULL,
  descrizione TEXT DEFAULT '',
  ordine INT NOT NULL DEFAULT 0,
  attivo BOOLEAN NOT NULL DEFAULT TRUE,
  personalizzato BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uffici_nome
  ON scadenze_bandi_uffici_dipartimenti(nome) WHERE attivo = TRUE;

-- Seed: uffici/reparti/dipartimenti standard
INSERT INTO scadenze_bandi_uffici_dipartimenti (nome, ordine) VALUES
  ('Direzione Generale',           1),
  ('Amministrazione',              2),
  ('Risorse Umane',                3),
  ('Ufficio del Personale',        4),
  ('Contabilità e Finanza',        5),
  ('Controllo di Gestione',        6),
  ('Ufficio Acquisti',             7),
  ('Ufficio Commerciale',          8),
  ('Marketing e Comunicazione',    9),
  ('Ufficio Tecnico',             10),
  ('Produzione',                  11),
  ('Logistica e Magazzino',       12),
  ('Qualità',                     13),
  ('Ricerca e Sviluppo',          14),
  ('IT / Sistemi Informativi',    15),
  ('Ufficio Legale',              16),
  ('Sicurezza e Prevenzione',     17),
  ('Formazione',                  18),
  ('Segreteria',                  19),
  ('Altro',                       99)
ON CONFLICT DO NOTHING;

-- Aggiunge colonna ufficio_id alla tabella referenti
ALTER TABLE scadenze_bandi_clienti_referenti
  ADD COLUMN IF NOT EXISTS ufficio_id UUID REFERENCES scadenze_bandi_uffici_dipartimenti(id),
  ADD COLUMN IF NOT EXISTS ruolo VARCHAR(150) DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_referenti_ufficio
  ON scadenze_bandi_clienti_referenti(ufficio_id);
