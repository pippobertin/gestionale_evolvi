-- ============================================================================
-- Modulo: Contributi Ottenuti (scheda cliente)
-- File:   013_create_contributi_ottenuti.sql
-- Scopo:  Crea lo storico dei contributi pubblici ottenuti da ciascun cliente
--         (3 enum + tabella + indici + trigger updated_at) e fa il backfill
--         dai progetti esistenti con contributo valorizzato.
--         Lo script è idempotente: può essere eseguito più volte senza errori
--         e senza duplicare righe.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. ENUM
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE contributo_forma AS ENUM (
    'FONDO_PERDUTO',
    'CREDITO_IMPOSTA',
    'FINANZIAMENTO_AGEVOLATO',
    'GARANZIA',
    'CONTRIBUTO_INTERESSI',
    'MISTO'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE contributo_stato AS ENUM (
    'AMMESSO',
    'CONCESSO',
    'EROGATO_PARZIALE',
    'EROGATO_TOTALE',
    'REVOCATO',
    'RINUNCIATO'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE contributo_origine AS ENUM (
    'DA_PROGETTO',
    'MANUALE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


-- ----------------------------------------------------------------------------
-- 2. Tabella scadenze_bandi_contributi_ottenuti
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scadenze_bandi_contributi_ottenuti (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id                    UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
  progetto_id                   UUID NULL REFERENCES scadenze_bandi_progetti(id) ON DELETE SET NULL,
  anno_competenza               INTEGER NOT NULL,

  -- Bando: o collegato al catalogo, o descritto a mano
  bando_id                      UUID NULL REFERENCES scadenze_bandi_bandi(id) ON DELETE SET NULL,
  bando_denominazione_manuale   TEXT NULL,
  ente_erogatore                TEXT NULL,

  forma_contributo              contributo_forma NOT NULL DEFAULT 'FONDO_PERDUTO',

  -- Importi
  importo_progetto              NUMERIC(15,2) NULL,
  importo_contributo            NUMERIC(15,2) NULL,
  esl                           NUMERIC(15,2) NULL,
  intensita_aiuto_pct           NUMERIC(5,2) NULL,

  -- Aiuti di Stato / RNA
  regime_aiuto                  TEXT NULL,
  rna_codice_concessione        TEXT NULL,
  rna_url                       TEXT NULL,

  -- Date
  data_concessione              DATE NULL,
  data_erogazione               DATE NULL,

  stato                         contributo_stato NOT NULL DEFAULT 'AMMESSO',
  note                          TEXT NULL,
  origine                       contributo_origine NOT NULL DEFAULT 'MANUALE',

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id            UUID NULL,

  CONSTRAINT chk_contributi_anno_competenza
    CHECK (anno_competenza BETWEEN 1990 AND 2100),
  CONSTRAINT chk_contributi_bando_presente
    CHECK (bando_id IS NOT NULL OR bando_denominazione_manuale IS NOT NULL)
);

-- Un progetto può generare al massimo una riga di contributo
CREATE UNIQUE INDEX IF NOT EXISTS uq_contributi_progetto_id
  ON scadenze_bandi_contributi_ottenuti(progetto_id)
  WHERE progetto_id IS NOT NULL;

-- Il gestionale non usa RLS: l'autorizzazione è fatta lato API con verifyJWT.
ALTER TABLE scadenze_bandi_contributi_ottenuti DISABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 3. Indici
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_contributi_cliente      ON scadenze_bandi_contributi_ottenuti(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contributi_cliente_anno ON scadenze_bandi_contributi_ottenuti(cliente_id, anno_competenza DESC);
CREATE INDEX IF NOT EXISTS idx_contributi_bando        ON scadenze_bandi_contributi_ottenuti(bando_id);
CREATE INDEX IF NOT EXISTS idx_contributi_forma        ON scadenze_bandi_contributi_ottenuti(forma_contributo);
CREATE INDEX IF NOT EXISTS idx_contributi_stato        ON scadenze_bandi_contributi_ottenuti(stato);


-- ----------------------------------------------------------------------------
-- 4. Trigger updated_at
-- ----------------------------------------------------------------------------
-- Riusa update_updated_at_column() se esiste già; la crea solo se manca,
-- così non sovrascriviamo una definizione condivisa con altre tabelle.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'update_updated_at_column'
      AND n.nspname = 'public'
  ) THEN
    CREATE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_contributi_updated_at
  ON scadenze_bandi_contributi_ottenuti;

CREATE TRIGGER trg_contributi_updated_at
  BEFORE UPDATE ON scadenze_bandi_contributi_ottenuti
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ----------------------------------------------------------------------------
-- 5. Backfill dai progetti esistenti
-- ----------------------------------------------------------------------------
-- Una riga per ogni progetto con contributo_ottenuto o contributo_ammesso
-- valorizzato. Ri-eseguibile: ON CONFLICT sull'indice unique di progetto_id.
-- Se il progetto non ha bando_id, la denominazione manuale prende il titolo
-- del progetto (serve a rispettare chk_contributi_bando_presente).

DO $$ BEGIN
  INSERT INTO scadenze_bandi_contributi_ottenuti (
    cliente_id,
    progetto_id,
    anno_competenza,
    bando_id,
    bando_denominazione_manuale,
    forma_contributo,
    importo_progetto,
    importo_contributo,
    data_concessione,
    stato,
    origine
  )
  SELECT
    p.cliente_id,
    p.id,
    EXTRACT(YEAR FROM COALESCE(
      p.data_decreto_concessione,
      p.data_fine_progetto_effettiva,
      p.data_avvio_progetto,
      p.created_at
    ))::int,
    p.bando_id,
    CASE
      WHEN p.bando_id IS NULL
        THEN COALESCE(NULLIF(p.titolo_progetto, ''), p.codice_progetto, 'Progetto ' || p.id::text)
      ELSE NULL
    END,
    'FONDO_PERDUTO'::contributo_forma,
    p.importo_totale_progetto,
    COALESCE(p.contributo_ottenuto, p.contributo_ammesso),
    p.data_decreto_concessione,
    CASE
      WHEN p.data_fine_progetto_effettiva IS NOT NULL THEN 'EROGATO_TOTALE'::contributo_stato
      WHEN p.data_decreto_concessione     IS NOT NULL THEN 'CONCESSO'::contributo_stato
      ELSE 'AMMESSO'::contributo_stato
    END,
    'DA_PROGETTO'::contributo_origine
  FROM scadenze_bandi_progetti p
  WHERE p.contributo_ottenuto IS NOT NULL
     OR p.contributo_ammesso  IS NOT NULL
  ON CONFLICT (progetto_id) WHERE progetto_id IS NOT NULL DO NOTHING;
END $$;


-- ----------------------------------------------------------------------------
-- 6. Commenti
-- ----------------------------------------------------------------------------

COMMENT ON TABLE scadenze_bandi_contributi_ottenuti IS
  'Storico dei contributi pubblici ottenuti dal cliente (agevolazioni, crediti d''imposta, finanziamenti agevolati, garanzie). Può derivare da un progetto gestito (origine DA_PROGETTO) o essere inserito a mano (origine MANUALE).';

COMMENT ON COLUMN scadenze_bandi_contributi_ottenuti.anno_competenza IS
  'Anno a cui attribuire il contributo nei riepiloghi (di norma anno del decreto di concessione).';

COMMENT ON COLUMN scadenze_bandi_contributi_ottenuti.bando_denominazione_manuale IS
  'Nome del bando/misura quando non è presente nel catalogo scadenze_bandi_bandi. Almeno uno tra bando_id e questo campo è obbligatorio.';

COMMENT ON COLUMN scadenze_bandi_contributi_ottenuti.esl IS
  'Equivalente Sovvenzione Lordo (ESL/GGE): valore dell''aiuto espresso come sovvenzione a fondo perduto, usato per il cumulo e i massimali de minimis. Per il fondo perduto coincide con il contributo; per finanziamenti agevolati e garanzie è inferiore.';

COMMENT ON COLUMN scadenze_bandi_contributi_ottenuti.intensita_aiuto_pct IS
  'Intensità di aiuto in percentuale (0-100): rapporto tra aiuto (ESL) e spese ammissibili.';

COMMENT ON COLUMN scadenze_bandi_contributi_ottenuti.regime_aiuto IS
  'Regime di aiuto di Stato applicato (es. de minimis Reg. UE 2023/2831, GBER Reg. UE 651/2014, Temporary Framework).';

COMMENT ON COLUMN scadenze_bandi_contributi_ottenuti.rna_codice_concessione IS
  'Codice COR (Codice Concessione RNA) rilasciato dal Registro Nazionale Aiuti di Stato al momento della concessione.';

COMMENT ON COLUMN scadenze_bandi_contributi_ottenuti.rna_url IS
  'Link alla scheda della concessione sul portale Trasparenza del Registro Nazionale Aiuti (rna.gov.it).';

COMMENT ON COLUMN scadenze_bandi_contributi_ottenuti.origine IS
  'DA_PROGETTO = riga generata/collegata a un record di scadenze_bandi_progetti (backfill o sincronizzazione); MANUALE = inserita a mano dalla scheda cliente.';

COMMENT ON COLUMN scadenze_bandi_contributi_ottenuti.created_by_user_id IS
  'Utente che ha creato la riga (NULL per le righe generate dal backfill).';


COMMIT;

-- ============================================================================
-- Verifica post-esecuzione (da copiare nel SQL Editor; non fa parte della
-- migrazione)
-- ============================================================================

-- 1. Righe create dal backfill vs progetti con contributo
-- SELECT
--   (SELECT count(*) FROM scadenze_bandi_contributi_ottenuti WHERE origine = 'DA_PROGETTO') AS contributi_da_progetto,
--   (SELECT count(*) FROM scadenze_bandi_progetti
--     WHERE contributo_ottenuto IS NOT NULL OR contributo_ammesso IS NOT NULL) AS progetti_con_contributo;

-- 2. Distribuzione per stato
-- SELECT stato, count(*) FROM scadenze_bandi_contributi_ottenuti GROUP BY stato ORDER BY stato;

-- 3. Righe backfill senza bando collegato (da sistemare a mano)
-- SELECT id, cliente_id, progetto_id, bando_denominazione_manuale
-- FROM scadenze_bandi_contributi_ottenuti
-- WHERE bando_id IS NULL AND origine = 'DA_PROGETTO';
