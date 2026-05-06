-- =============================================================================
-- Migration: 6 Nuove Funzionalità Gestionale Evolvi
-- Date: 2026-04-08
-- Features: Prospect, Contratti Evolvi, Fatturazione, Documenti Amministrativi,
--           Contract Tracking, Scadenze Contrattuali
-- =============================================================================

-- =============================================================================
-- 1. PROSPECT
-- =============================================================================

-- Tabella principale prospect
CREATE TABLE IF NOT EXISTS scadenze_bandi_prospect (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_prospect TEXT UNIQUE,
  denominazione TEXT NOT NULL,
  partita_iva TEXT,
  codice_fiscale TEXT,
  email TEXT,
  pec TEXT,
  telefono TEXT,
  sito_web TEXT,
  indirizzo TEXT,
  cap TEXT,
  citta TEXT,
  provincia TEXT,
  settore TEXT,
  ateco_2025 TEXT,
  dimensione TEXT CHECK (dimensione IN ('MICRO', 'PICCOLA', 'MEDIA', 'GRANDE')),
  numero_dipendenti INTEGER,
  ultimo_fatturato NUMERIC,
  legale_rappresentante_nome TEXT,
  legale_rappresentante_cognome TEXT,
  legale_rappresentante_email TEXT,
  legale_rappresentante_telefono TEXT,
  profiling_data JSONB DEFAULT '{}',
  profiling_score INTEGER DEFAULT 0,
  fonte_acquisizione TEXT CHECK (fonte_acquisizione IN ('referral', 'web', 'evento', 'cold_call', 'altro')),
  assegnato_a TEXT,
  stato TEXT NOT NULL DEFAULT 'nuovo' CHECK (stato IN ('nuovo', 'in_valutazione', 'valutato', 'approvato', 'rifiutato', 'convertito')),
  decisione TEXT CHECK (decisione IN ('EVOLVI', 'SPOT', 'RIFIUTATO')),
  motivo_rifiuto TEXT,
  data_decisione TIMESTAMPTZ,
  deciso_da TEXT,
  cliente_id UUID REFERENCES scadenze_bandi_clienti(id),
  data_conversione TIMESTAMPTZ,
  convertito_da TEXT,
  note TEXT,
  note_valutazione TEXT,
  creato_da TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate numero_prospect
CREATE OR REPLACE FUNCTION generate_numero_prospect()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_prospect FROM 10) AS INTEGER)), 0) + 1
  INTO next_num
  FROM scadenze_bandi_prospect
  WHERE numero_prospect LIKE 'PROS-' || current_year || '-%';
  NEW.numero_prospect := 'PROS-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_generate_numero_prospect
  BEFORE INSERT ON scadenze_bandi_prospect
  FOR EACH ROW
  WHEN (NEW.numero_prospect IS NULL)
  EXECUTE FUNCTION generate_numero_prospect();

-- History log per cambi di stato
CREATE TABLE IF NOT EXISTS scadenze_bandi_prospect_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES scadenze_bandi_prospect(id) ON DELETE CASCADE,
  stato_precedente TEXT,
  stato_nuovo TEXT NOT NULL,
  note TEXT,
  utente TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template profilazione dinamico
CREATE TABLE IF NOT EXISTS scadenze_bandi_profiling_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domanda TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('text', 'number', 'select', 'multiselect', 'boolean', 'textarea', 'rating')),
  opzioni JSONB DEFAULT '[]',
  peso INTEGER DEFAULT 1,
  categoria TEXT DEFAULT 'generale',
  ordine INTEGER DEFAULT 0,
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default profiling questions
INSERT INTO scadenze_bandi_profiling_template (domanda, tipo, opzioni, peso, categoria, ordine) VALUES
  ('Fatturato annuale', 'select', '["< 100K", "100K-500K", "500K-2M", "2M-10M", "> 10M"]', 3, 'finanziario', 1),
  ('Numero dipendenti', 'select', '["1-5", "6-15", "16-50", "51-250", "> 250"]', 2, 'dimensione', 2),
  ('Esperienza con bandi/finanziamenti', 'select', '["Nessuna", "1-2 bandi", "3-5 bandi", "> 5 bandi"]', 3, 'esperienza', 3),
  ('Settore di attività principale', 'text', '[]', 1, 'attivita', 4),
  ('Interesse per consulenza continuativa', 'rating', '[]', 4, 'interesse', 5),
  ('Urgenza della richiesta', 'select', '["Bassa", "Media", "Alta", "Immediata"]', 2, 'urgenza', 6),
  ('Budget disponibile per consulenza', 'select', '["< 5K", "5K-15K", "15K-50K", "> 50K"]', 3, 'finanziario', 7),
  ('Canale di acquisizione', 'select', '["Passaparola", "Web/Social", "Evento", "Telefonata", "Altro"]', 1, 'acquisizione', 8),
  ('Note aggiuntive sulla valutazione', 'textarea', '[]', 1, 'note', 9)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 2. CONTRATTI EVOLVI
-- =============================================================================

CREATE TABLE IF NOT EXISTS scadenze_bandi_contratti_evolvi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id),
  numero_contratto TEXT UNIQUE,
  tipo_contratto TEXT DEFAULT 'EVOLVI',
  data_contratto DATE,
  data_inizio DATE,
  data_fine DATE,
  importo_annuale NUMERIC,
  importo_totale NUMERIC,
  modalita_pagamento TEXT CHECK (modalita_pagamento IN ('mensile', 'trimestrale', 'semestrale', 'annuale')),
  template_name TEXT DEFAULT 'MODELLO CONTRATTO EVOLVI',
  contract_word_id TEXT,
  contract_word_url TEXT,
  contract_pdf_id TEXT,
  contract_pdf_url TEXT,
  stato TEXT NOT NULL DEFAULT 'bozza' CHECK (stato IN ('bozza', 'in_revisione', 'approvato', 'inviato', 'firmato', 'attivo', 'scaduto', 'annullato')),
  approvato_da TEXT,
  approvato_il TIMESTAMPTZ,
  inviato_a_email TEXT,
  inviato_il TIMESTAMPTZ,
  firmato_il TIMESTAMPTZ,
  rinnovo_automatico BOOLEAN DEFAULT false,
  contratto_rinnovato_id UUID REFERENCES scadenze_bandi_contratti_evolvi(id),
  note TEXT,
  creato_da TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate numero_contratto
CREATE OR REPLACE FUNCTION generate_numero_contratto_evolvi()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_contratto FROM 13) AS INTEGER)), 0) + 1
  INTO next_num
  FROM scadenze_bandi_contratti_evolvi
  WHERE numero_contratto LIKE 'EVOLVI-' || current_year || '-%';
  NEW.numero_contratto := 'EVOLVI-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_generate_numero_contratto_evolvi
  BEFORE INSERT ON scadenze_bandi_contratti_evolvi
  FOR EACH ROW
  WHEN (NEW.numero_contratto IS NULL)
  EXECUTE FUNCTION generate_numero_contratto_evolvi();

-- =============================================================================
-- 3. FATTURAZIONE EVOLVI
-- =============================================================================

CREATE TABLE IF NOT EXISTS scadenze_bandi_evolvi_fatture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contratto_id UUID NOT NULL REFERENCES scadenze_bandi_contratti_evolvi(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id),
  numero_fattura TEXT UNIQUE,
  data_fattura DATE,
  data_scadenza_pagamento DATE,
  importo_netto NUMERIC NOT NULL,
  importo_iva NUMERIC DEFAULT 0,
  importo_totale NUMERIC NOT NULL,
  periodo_inizio DATE,
  periodo_fine DATE,
  stato_pagamento TEXT NOT NULL DEFAULT 'PENDING' CHECK (stato_pagamento IN ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED')),
  data_pagamento DATE,
  metodo_pagamento TEXT,
  riferimento_pagamento TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- Auto-generate numero_fattura
CREATE OR REPLACE FUNCTION generate_numero_fattura_evolvi()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_fattura FROM 16) AS INTEGER)), 0) + 1
  INTO next_num
  FROM scadenze_bandi_evolvi_fatture
  WHERE numero_fattura LIKE 'FAT-EVOLVI-' || current_year || '-%';
  NEW.numero_fattura := 'FAT-EVOLVI-' || current_year || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_generate_numero_fattura_evolvi
  BEFORE INSERT ON scadenze_bandi_evolvi_fatture
  FOR EACH ROW
  WHEN (NEW.numero_fattura IS NULL)
  EXECUTE FUNCTION generate_numero_fattura_evolvi();

-- =============================================================================
-- 4. DOCUMENTI AMMINISTRATIVI
-- =============================================================================

CREATE TABLE IF NOT EXISTS scadenze_bandi_documenti_amministrativi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL CHECK (tipo_documento IN (
    'VISURA_CAMERALE', 'ATTO_COSTITUTIVO', 'STATUTO', 'BILANCIO',
    'DOCUMENTO_IDENTITA', 'CODICE_FISCALE', 'CERT_PARTITA_IVA',
    'CERT_ANTIMAFIA', 'DURC', 'ISCRIZIONE_RUNTS', 'ALTRO'
  )),
  categoria TEXT NOT NULL CHECK (categoria IN (
    'SOCIETARI', 'FISCALI', 'IDENTITA', 'CERTIFICAZIONI', 'BILANCI', 'ALTRO'
  )),
  nome_file TEXT NOT NULL,
  nome_originale TEXT NOT NULL,
  dimensione_bytes INTEGER,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  descrizione TEXT,
  data_documento DATE,
  data_scadenza DATE,
  verificato BOOLEAN DEFAULT false,
  verificato_da TEXT,
  verificato_il TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 5. CONTRACT TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS scadenze_bandi_contract_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('PROGETTO', 'CONTRATTO_EVOLVI')),
  entity_id UUID NOT NULL,
  cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id),
  contract_document_url TEXT,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  email_sent_to TEXT,
  email_message_id TEXT,
  email_delivery_status TEXT DEFAULT 'PENDING' CHECK (email_delivery_status IN ('PENDING', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED')),
  email_delivery_error TEXT,
  signed_contract_received BOOLEAN DEFAULT false,
  signed_contract_received_at TIMESTAMPTZ,
  signed_contract_storage_path TEXT,
  signed_contract_notes TEXT,
  reminder_sent_count INTEGER DEFAULT 0,
  last_reminder_sent_at TIMESTAMPTZ,
  reminder_interval_days INTEGER DEFAULT 7,
  overall_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (overall_status IN ('DRAFT', 'SENT', 'DELIVERED', 'REMINDED', 'SIGNED_RECEIVED', 'COMPLETED', 'FAILED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 6. SCADENZE CONTRATTUALI
-- =============================================================================

CREATE TABLE IF NOT EXISTS scadenze_bandi_scadenze_contrattuali (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL DEFAULT 'GENERALE' CHECK (entity_type IN ('CLIENTE', 'CONTRATTO_EVOLVI', 'GENERALE')),
  entity_id UUID,
  titolo TEXT NOT NULL,
  descrizione TEXT,
  tipo_scadenza TEXT NOT NULL CHECK (tipo_scadenza IN (
    'CONTRATTUALE', 'FISCALE', 'AMMINISTRATIVA', 'CERTIFICAZIONE', 'PAGAMENTO', 'REVISIONE', 'ALTRO'
  )),
  categoria TEXT,
  data_scadenza DATE NOT NULL,
  data_promemoria DATE,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT CHECK (recurrence_pattern IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),
  recurrence_interval INTEGER DEFAULT 1,
  recurrence_end_date DATE,
  stato TEXT NOT NULL DEFAULT 'APERTA' CHECK (stato IN ('APERTA', 'IN_CORSO', 'COMPLETATA', 'ANNULLATA')),
  priorita TEXT NOT NULL DEFAULT 'MEDIA' CHECK (priorita IN ('BASSA', 'MEDIA', 'ALTA', 'CRITICA')),
  responsabile_email TEXT,
  notifiche_attive BOOLEAN DEFAULT true,
  notifica_giorni_prima INTEGER[] DEFAULT '{30,15,7,3,1}',
  data_completamento TIMESTAMPTZ,
  completato_da TEXT,
  note_completamento TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log azioni scadenze contrattuali
CREATE TABLE IF NOT EXISTS scadenze_bandi_scadenze_contrattuali_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scadenza_id UUID NOT NULL REFERENCES scadenze_bandi_scadenze_contrattuali(id) ON DELETE CASCADE,
  azione TEXT NOT NULL CHECK (azione IN ('creazione', 'modifica', 'completamento', 'notifica_inviata', 'ricorrenza_generata', 'annullamento')),
  dettagli JSONB DEFAULT '{}',
  utente TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_prospect_stato ON scadenze_bandi_prospect(stato);
CREATE INDEX IF NOT EXISTS idx_prospect_assegnato ON scadenze_bandi_prospect(assegnato_a);
CREATE INDEX IF NOT EXISTS idx_prospect_cliente ON scadenze_bandi_prospect(cliente_id);

CREATE INDEX IF NOT EXISTS idx_contratti_evolvi_cliente ON scadenze_bandi_contratti_evolvi(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contratti_evolvi_stato ON scadenze_bandi_contratti_evolvi(stato);

CREATE INDEX IF NOT EXISTS idx_fatture_evolvi_contratto ON scadenze_bandi_evolvi_fatture(contratto_id);
CREATE INDEX IF NOT EXISTS idx_fatture_evolvi_cliente ON scadenze_bandi_evolvi_fatture(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fatture_evolvi_stato ON scadenze_bandi_evolvi_fatture(stato_pagamento);

CREATE INDEX IF NOT EXISTS idx_doc_amm_cliente ON scadenze_bandi_documenti_amministrativi(cliente_id);
CREATE INDEX IF NOT EXISTS idx_doc_amm_tipo ON scadenze_bandi_documenti_amministrativi(tipo_documento);

CREATE INDEX IF NOT EXISTS idx_tracking_entity ON scadenze_bandi_contract_tracking(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tracking_cliente ON scadenze_bandi_contract_tracking(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tracking_status ON scadenze_bandi_contract_tracking(overall_status);

CREATE INDEX IF NOT EXISTS idx_scadenze_contr_entity ON scadenze_bandi_scadenze_contrattuali(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_scadenze_contr_data ON scadenze_bandi_scadenze_contrattuali(data_scadenza);
CREATE INDEX IF NOT EXISTS idx_scadenze_contr_stato ON scadenze_bandi_scadenze_contrattuali(stato);

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'scadenze_bandi_prospect',
      'scadenze_bandi_contratti_evolvi',
      'scadenze_bandi_evolvi_fatture',
      'scadenze_bandi_documenti_amministrativi',
      'scadenze_bandi_contract_tracking',
      'scadenze_bandi_scadenze_contrattuali'
    ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trigger_updated_at_%I ON %I;
      CREATE TRIGGER trigger_updated_at_%I
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- =============================================================================
-- SUPABASE STORAGE BUCKETS
-- =============================================================================
-- NOTE: Run these in Supabase Dashboard or via Supabase CLI:
-- 1. Create bucket 'clienti-amministrativi' (private, 100MB limit)
-- 2. Create bucket 'contratti-firmati' (private, 50MB limit)
-- 3. Set RLS policies for authenticated users

-- Example RLS (run in SQL editor):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES
--   ('clienti-amministrativi', 'clienti-amministrativi', false, 104857600, '{"application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","image/jpeg","image/png"}'),
--   ('contratti-firmati', 'contratti-firmati', false, 52428800, '{"application/pdf","image/jpeg","image/png"}');
