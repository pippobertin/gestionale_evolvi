-- ============================================================================
-- Modulo: Integrazione RNA — aggiornamenti a richiesta
-- File:   016_create_rna_richieste.sql
-- Scopo:  rna.gov.it non risponde ai server cloud, quindi l'importazione gira
--         su un Mac (agente launchd). Il gestionale non può avviarla
--         direttamente: scrive una RICHIESTA in questa tabella e l'agente,
--         che controlla ogni 5 minuti, la esegue e aggiorna lo stato.
--         L'agente crea anche le richieste automatiche (ogni 7 giorni gli
--         ultimi 4 mesi, ogni 30 giorni lo storico completo).
--         Idempotente.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS scadenze_bandi_rna_richieste (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mese_da           TEXT NOT NULL,                      -- 'AAAA_MM'
  mese_a            TEXT NOT NULL,                      -- 'AAAA_MM'
  origine           TEXT NOT NULL DEFAULT 'MANUALE',    -- 'MANUALE' | 'AUTOMATICA'
  stato             TEXT NOT NULL DEFAULT 'IN_ATTESA',  -- 'IN_ATTESA' | 'IN_CORSO' | 'OK' | 'ERRORE'
  mesi_totali       INTEGER NULL,
  mesi_completati   INTEGER NOT NULL DEFAULT 0,
  mese_corrente     TEXT NULL,
  aiuti_clienti     INTEGER NULL,
  nuovi             INTEGER NULL,
  aggiornati        INTEGER NULL,
  collegati_auto    INTEGER NULL,
  mesi_in_errore    INTEGER NULL,
  errore            TEXT NULL,
  richiesta_da      UUID NULL,                          -- utente del gestionale (NULL se automatica)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  avviata_at        TIMESTAMPTZ NULL,
  completata_at     TIMESTAMPTZ NULL,

  CONSTRAINT chk_rna_richieste_mesi CHECK (mese_da ~ '^\d{4}_\d{2}$' AND mese_a ~ '^\d{4}_\d{2}$' AND mese_da <= mese_a),
  CONSTRAINT chk_rna_richieste_stato CHECK (stato IN ('IN_ATTESA', 'IN_CORSO', 'OK', 'ERRORE')),
  CONSTRAINT chk_rna_richieste_origine CHECK (origine IN ('MANUALE', 'AUTOMATICA'))
);

ALTER TABLE scadenze_bandi_rna_richieste DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_rna_richieste_stato ON scadenze_bandi_rna_richieste(stato, created_at);
CREATE INDEX IF NOT EXISTS idx_rna_richieste_created ON scadenze_bandi_rna_richieste(created_at DESC);

COMMENT ON TABLE scadenze_bandi_rna_richieste IS
  'Richieste di aggiornamento degli aiuti RNA, eseguite dall''agente sul Mac (rna.gov.it non risponde ai server cloud).';

-- Stato dell'agente (una riga per macchina): serve al gestionale per sapere se il Mac è attivo
CREATE TABLE IF NOT EXISTS scadenze_bandi_rna_agente (
  id                  TEXT PRIMARY KEY,                 -- nome macchina
  ultimo_contatto_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stato               TEXT NULL                         -- es. 'in ascolto', 'in corso 2023_05'
);

ALTER TABLE scadenze_bandi_rna_agente DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE scadenze_bandi_rna_agente IS
  'Ultimo contatto dell''agente RNA sul Mac (aggiornato ogni 5 minuti quando il Mac è acceso).';

-- Lo storico completo è già stato importato il 14/10/2026: lo registriamo come
-- esecuzione automatica riuscita, così l'agente non lo rifà subito.
INSERT INTO scadenze_bandi_rna_richieste (mese_da, mese_a, origine, stato, mesi_totali, mesi_completati, avviata_at, completata_at)
SELECT '2020_01', '2026_10', 'AUTOMATICA', 'OK', 82, 82, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM scadenze_bandi_rna_richieste);

COMMIT;
