-- Storico adesioni del cliente ai fondi interprofessionali
-- Un cliente puo' avere piu' adesioni (cambi fondo, categorie diverse di lavoratori)

CREATE TABLE IF NOT EXISTS scadenze_bandi_clienti_adesioni_fpi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
  fondo_id UUID NOT NULL REFERENCES scadenze_bandi_fondi_interprofessionali(id),
  codice_adesione VARCHAR(100),                 -- codice assegnato dal fondo
  data_adesione DATE,
  data_cessazione DATE,                          -- NULL se adesione attiva
  ccnl_applicato VARCHAR(200),
  matricole_inps_associate TEXT[],               -- puo' avere piu' matricole
  dipendenti_aderenti INTEGER,
  stato VARCHAR(30) DEFAULT 'ATTIVA'             -- ATTIVA, CESSATA, SOSPESA
    CHECK (stato IN ('ATTIVA', 'CESSATA', 'SOSPESA')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES scadenze_bandi_utenti(id),

  -- Un'adesione ATTIVA non puo' avere data_cessazione
  CONSTRAINT chk_adesione_attiva CHECK (
    stato != 'ATTIVA' OR data_cessazione IS NULL
  ),
  -- data_cessazione non puo' precedere data_adesione
  CONSTRAINT chk_date_adesione CHECK (
    data_cessazione IS NULL OR data_adesione IS NULL OR data_cessazione >= data_adesione
  )
);

CREATE INDEX IF NOT EXISTS idx_adesioni_fpi_cliente_stato
  ON scadenze_bandi_clienti_adesioni_fpi(cliente_id, stato);

CREATE INDEX IF NOT EXISTS idx_adesioni_fpi_fondo
  ON scadenze_bandi_clienti_adesioni_fpi(fondo_id);
