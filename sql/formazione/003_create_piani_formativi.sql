-- Piani formativi: cuore del modulo formazione
-- Puo' essere FPI (collegato a un'adesione) oppure privato

CREATE TABLE IF NOT EXISTS scadenze_bandi_piani_formativi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
  adesione_fpi_id UUID REFERENCES scadenze_bandi_clienti_adesioni_fpi(id),  -- NULL = piano privato
  fondo_id UUID REFERENCES scadenze_bandi_fondi_interprofessionali(id),      -- ridondante ma utile per report
  codice_piano VARCHAR(100),
  titolo VARCHAR(500) NOT NULL,
  descrizione TEXT,
  tipologia VARCHAR(50)                          -- tipo di piano
    CHECK (tipologia IN ('AZIENDALE', 'PLURIAZIENDALE', 'SETTORIALE', 'TERRITORIALE', 'PRIVATO', 'OBBLIGATORIO')),
  canale_finanziamento VARCHAR(50)               -- fonte dei fondi
    CHECK (canale_finanziamento IN ('CONTO_FORMAZIONE', 'CONTO_SISTEMA', 'AVVISO', 'PRIVATO', 'NON_APPLICABILE')),
  avviso_riferimento VARCHAR(200),               -- es. "Avviso 3/2024"

  -- Stato con automa definito in pianoStateMachine.ts
  stato VARCHAR(30) DEFAULT 'BOZZA'
    CHECK (stato IN (
      'BOZZA', 'IN_PRESENTAZIONE', 'PRESENTATO', 'APPROVATO',
      'IN_EROGAZIONE', 'CONCLUSO', 'RENDICONTATO', 'SALDATO',
      'RESPINTO', 'ANNULLATO'
    )),

  -- Date del ciclo di vita
  data_presentazione DATE,
  data_approvazione DATE,
  data_inizio_attivita DATE,
  data_fine_attivita DATE,
  data_scadenza_rendicontazione DATE,
  data_saldo DATE,

  -- Importi
  importo_richiesto NUMERIC(15,2),
  importo_approvato NUMERIC(15,2),
  importo_erogato NUMERIC(15,2),
  importo_saldato NUMERIC(15,2),

  -- Ore e partecipanti
  ore_previste INTEGER,
  ore_erogate INTEGER,
  num_partecipanti_previsti INTEGER,
  num_partecipanti_effettivi INTEGER,

  -- Collegamenti con altri moduli
  progetto_collegato_id UUID,                    -- FK scadenze_bandi_progetti se esiste
  bando_collegato_id UUID,                       -- FK scadenze_bandi_bandi se esiste

  -- Google Drive
  drive_folder_id VARCHAR(200),
  drive_folder_url VARCHAR(500),

  -- Responsabile piano (array JSONB: [{tipo, id, nome}])
  responsabile_piano JSONB,

  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES scadenze_bandi_utenti(id)
);

CREATE INDEX IF NOT EXISTS idx_piani_formativi_cliente_stato
  ON scadenze_bandi_piani_formativi(cliente_id, stato);

CREATE INDEX IF NOT EXISTS idx_piani_formativi_fondo
  ON scadenze_bandi_piani_formativi(fondo_id);

CREATE INDEX IF NOT EXISTS idx_piani_formativi_scadenza_rendicontazione
  ON scadenze_bandi_piani_formativi(data_scadenza_rendicontazione);
