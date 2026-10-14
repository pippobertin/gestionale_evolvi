-- ============================================================================
-- Modulo: Integrazione Registro Nazionale Aiuti (RNA)
-- File:   015_create_rna_aiuti.sql
-- Scopo:  Archivio degli aiuti RNA ricevuti dai clienti del gestionale
--         (estratti dagli Open Data RNA, filtrati per codice fiscale/P.IVA),
--         registro delle importazioni, origine 'DA_RNA' per i contributi
--         e vista per le Interrogazioni.
--         Idempotente: può essere eseguito più volte.
--
-- Regola di classificazione: un aiuto RNA è "nostro" se e solo se è collegato
-- a un contributo (contributo_id NOT NULL). Tutti gli altri sono "altri aiuti".
--
-- Fonte dati: Registro Nazionale degli Aiuti di Stato – Open Data, CC BY 4.0.
-- ============================================================================

-- ALTER TYPE ... ADD VALUE va fuori dalla transazione (il valore non sarebbe
-- utilizzabile nella stessa transazione, e alcune versioni lo rifiutano).
ALTER TYPE contributo_origine ADD VALUE IF NOT EXISTS 'DA_RNA';

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Aiuti RNA dei clienti
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scadenze_bandi_rna_aiuti (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cor                          TEXT NOT NULL,
  car                          TEXT NULL,
  titolo_misura                TEXT NULL,
  des_tipo_misura              TEXT NULL,
  soggetto_concedente          TEXT NULL,
  data_concessione             DATE NULL,
  anno_concessione             INTEGER NULL,
  titolo_progetto              TEXT NULL,
  descrizione_progetto         TEXT NULL,
  cup                          TEXT NULL,
  atto_concessione             TEXT NULL,
  link_atto_concessione        TEXT NULL,
  link_trasparenza             TEXT NULL,

  codice_fiscale_beneficiario  TEXT NOT NULL,
  denominazione_beneficiario   TEXT NULL,
  des_tipo_beneficiario        TEXT NULL,
  regione_beneficiario         TEXT NULL,
  cliente_id                   UUID NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE SET NULL,

  procedimenti                 TEXT[] NOT NULL DEFAULT '{}',
  regolamenti                  TEXT[] NOT NULL DEFAULT '{}',
  cod_regolamenti              TEXT[] NOT NULL DEFAULT '{}',
  strumenti                    TEXT[] NOT NULL DEFAULT '{}',
  forma_proposta               contributo_forma NULL,
  importo_nominale             NUMERIC(15,2) NULL,
  elemento_aiuto               NUMERIC(15,2) NULL,
  de_minimis                   BOOLEAN NOT NULL DEFAULT false,
  ambito                       TEXT NOT NULL DEFAULT 'ALTRO',
  fondo_interprofessionale     TEXT NULL,
  componenti                   JSONB NULL,

  contributo_id                UUID NULL REFERENCES scadenze_bandi_contributi_ottenuti(id) ON DELETE SET NULL,
  collegamento_automatico      BOOLEAN NOT NULL DEFAULT false,
  escludi_collegamento_auto    BOOLEAN NOT NULL DEFAULT false,
  modificato_da_rna_at         TIMESTAMPTZ NULL,

  file_origine                 TEXT NULL,
  prima_rilevazione_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_rna_aiuti_cor UNIQUE (cor),
  CONSTRAINT chk_rna_aiuti_ambito CHECK (ambito IN ('FPI', 'GARANZIA_PMI', 'ALTRO'))
);

ALTER TABLE scadenze_bandi_rna_aiuti DISABLE ROW LEVEL SECURITY;

-- Un contributo è collegato al massimo a un aiuto RNA
CREATE UNIQUE INDEX IF NOT EXISTS uq_rna_aiuti_contributo
  ON scadenze_bandi_rna_aiuti(contributo_id) WHERE contributo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rna_aiuti_cliente      ON scadenze_bandi_rna_aiuti(cliente_id);
CREATE INDEX IF NOT EXISTS idx_rna_aiuti_cf           ON scadenze_bandi_rna_aiuti(codice_fiscale_beneficiario);
CREATE INDEX IF NOT EXISTS idx_rna_aiuti_data         ON scadenze_bandi_rna_aiuti(data_concessione DESC);
CREATE INDEX IF NOT EXISTS idx_rna_aiuti_ambito       ON scadenze_bandi_rna_aiuti(ambito);
CREATE INDEX IF NOT EXISTS idx_rna_aiuti_fondo        ON scadenze_bandi_rna_aiuti(fondo_interprofessionale);
CREATE INDEX IF NOT EXISTS idx_rna_aiuti_de_minimis   ON scadenze_bandi_rna_aiuti(cliente_id, data_concessione) WHERE de_minimis;

DROP TRIGGER IF EXISTS trg_rna_aiuti_updated_at ON scadenze_bandi_rna_aiuti;
CREATE TRIGGER trg_rna_aiuti_updated_at
  BEFORE UPDATE ON scadenze_bandi_rna_aiuti
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE scadenze_bandi_rna_aiuti IS
  'Aiuti del Registro Nazionale Aiuti (Open Data, CC BY 4.0) ricevuti dai clienti, abbinati per codice fiscale/P.IVA. Un aiuto è "nostro" se contributo_id è valorizzato, altrimenti è tra gli "altri aiuti".';
COMMENT ON COLUMN scadenze_bandi_rna_aiuti.cor IS 'Codice Concessione RNA (univoco).';
COMMENT ON COLUMN scadenze_bandi_rna_aiuti.car IS 'Codice identificativo della misura in RNA.';
COMMENT ON COLUMN scadenze_bandi_rna_aiuti.elemento_aiuto IS 'ELEMENTO_DI_AIUTO RNA = ESL, somma di componenti e strumenti.';
COMMENT ON COLUMN scadenze_bandi_rna_aiuti.importo_nominale IS 'IMPORTO_NOMINALE RNA, somma di componenti e strumenti.';
COMMENT ON COLUMN scadenze_bandi_rna_aiuti.forma_proposta IS 'Forma del contributo proposta a partire da DES_STRUMENTO (da confermare quando si porta tra i nostri).';
COMMENT ON COLUMN scadenze_bandi_rna_aiuti.ambito IS 'FPI = fondi interprofessionali; GARANZIA_PMI = Fondo di garanzia PMI; ALTRO.';
COMMENT ON COLUMN scadenze_bandi_rna_aiuti.collegamento_automatico IS 'true se il collegamento al contributo è stato fatto dall''importazione (stesso COR o stesso cliente/anno/importo).';
COMMENT ON COLUMN scadenze_bandi_rna_aiuti.escludi_collegamento_auto IS 'true se un utente ha riportato l''aiuto tra gli "altri": l''importazione non lo ricollega più in automatico.';
COMMENT ON COLUMN scadenze_bandi_rna_aiuti.modificato_da_rna_at IS 'Valorizzato quando RNA modifica importi o data di un aiuto già collegato a un contributo: da verificare a mano.';

-- ----------------------------------------------------------------------------
-- 2. Registro delle importazioni
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scadenze_bandi_rna_import_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mese             TEXT NOT NULL,                -- es. '2026_09'
  origine          TEXT NOT NULL DEFAULT 'CRON', -- 'CRON' | 'BACKFILL' | 'MANUALE'
  esito            TEXT NOT NULL DEFAULT 'IN_CORSO', -- 'IN_CORSO' | 'OK' | 'ERRORE'
  aiuti_letti      INTEGER NULL,
  aiuti_clienti    INTEGER NULL,
  nuovi            INTEGER NULL,
  aggiornati       INTEGER NULL,
  collegati_auto   INTEGER NULL,
  durata_ms        INTEGER NULL,
  errore           TEXT NULL,
  avviato_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completato_at    TIMESTAMPTZ NULL
);

ALTER TABLE scadenze_bandi_rna_import_log DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_rna_import_log_mese ON scadenze_bandi_rna_import_log(mese, avviato_at DESC);

COMMENT ON TABLE scadenze_bandi_rna_import_log IS 'Una riga per ogni file mensile Open Data RNA elaborato (storico, cron o manuale).';

-- ----------------------------------------------------------------------------
-- 3. Vista per le Interrogazioni
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vista_rna_aiuti
WITH (security_invoker = true) AS
SELECT
  a.id,
  a.cor,
  a.car,
  a.titolo_misura,
  a.soggetto_concedente,
  a.data_concessione,
  a.anno_concessione,
  a.procedimenti,
  a.regolamenti,
  a.strumenti,
  a.forma_proposta,
  a.importo_nominale,
  a.elemento_aiuto,
  a.de_minimis,
  a.ambito,
  a.fondo_interprofessionale,
  (a.contributo_id IS NOT NULL)         AS nostro,
  a.contributo_id,
  a.link_atto_concessione,
  a.link_trasparenza,
  a.cliente_id,
  cl.denominazione                      AS cliente_denominazione,
  cl.partita_iva                        AS cliente_partita_iva,
  cl.provincia_fatturazione             AS cliente_provincia,
  cl.email                              AS cliente_email,
  cl.pec                                AS cliente_pec,
  cl.categoria_evolvi                   AS cliente_categoria_evolvi,
  cl.dimensione                         AS cliente_dimensione
FROM scadenze_bandi_rna_aiuti a
JOIN scadenze_bandi_clienti cl ON cl.id = a.cliente_id;

GRANT SELECT ON vista_rna_aiuti TO anon, authenticated;

COMMENT ON VIEW vista_rna_aiuti IS 'Aiuti RNA dei clienti con dati anagrafici, per l''ambito Interrogazioni "Aiuti RNA".';

COMMIT;
