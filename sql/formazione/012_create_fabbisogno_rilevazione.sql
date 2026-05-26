-- ============================================================================
-- Modulo: Rilevazione Fabbisogno Formativo
-- File:   012_create_fabbisogno_rilevazione.sql
-- Scopo:  Estende l'enum tipo_obbligo della tabella certificazioni esistente
--         e crea le quattro tabelle del nuovo modulo (rilevazioni + popolazione
--         + inserimenti previsti + obblighi dichiarati).
--         Lo script è idempotente: può essere eseguito più volte senza errori.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Estensione enum tipo_obbligo nella tabella certificazioni esistente
-- ----------------------------------------------------------------------------
-- Aggiunge i due valori RESPONSABILITA_AMMINISTRATIVA_231 e USO_ATTREZZATURE
-- per coprire tutte le righe della sezione C del questionario.

ALTER TABLE scadenze_bandi_certificazioni_obbligatorie
  DROP CONSTRAINT IF EXISTS scadenze_bandi_certificazioni_obbligatorie_tipo_obbligo_check;

ALTER TABLE scadenze_bandi_certificazioni_obbligatorie
  ADD CONSTRAINT scadenze_bandi_certificazioni_obbligatorie_tipo_obbligo_check
  CHECK (tipo_obbligo IN (
    'FORMAZIONE_LAVORATORI_RISCHIO_BASSO',
    'FORMAZIONE_LAVORATORI_RISCHIO_MEDIO',
    'FORMAZIONE_LAVORATORI_RISCHIO_ALTO',
    'RSPP',
    'DIRIGENTI_SSL',
    'PREPOSTI',
    'RLS',
    'ANTINCENDIO_BASSO',
    'ANTINCENDIO_MEDIO',
    'ANTINCENDIO_ALTO',
    'PRIMO_SOCCORSO',
    'HACCP',
    'PRIVACY_GDPR',
    'ANTIRICICLAGGIO',
    'RESPONSABILITA_AMMINISTRATIVA_231',
    'USO_ATTREZZATURE',
    'ALTRO'
  ));


-- ----------------------------------------------------------------------------
-- 2. Tabella principale: rilevazioni
-- ----------------------------------------------------------------------------
-- Una riga per ogni questionario inviato a un cliente. Contiene token di
-- accesso pubblico, stato di compilazione e tutte le risposte scalari delle
-- sei sezioni del questionario. Le risposte di tipo "lista" (popolazione,
-- inserimenti, obblighi) stanno nelle tabelle figlie più sotto.

CREATE TABLE IF NOT EXISTS scadenze_bandi_fabbisogno_rilevazioni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,

  -- Identificativo della rilevazione (es. "2026 — Annuale", "2026 Q2 produzione")
  titolo VARCHAR(200) NOT NULL,
  anno_riferimento INTEGER NOT NULL,

  -- Token di accesso pubblico (256 bit di entropia)
  token VARCHAR(128) NOT NULL UNIQUE
    DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_scadenza TIMESTAMPTZ DEFAULT (now() + interval '90 days'),

  -- Stato del workflow
  stato VARCHAR(30) NOT NULL DEFAULT 'BOZZA' CHECK (stato IN (
    'BOZZA',           -- creata dal consulente, link non ancora inviato
    'INVIATA',         -- link inviato al cliente, non ancora aperto
    'IN_COMPILAZIONE', -- cliente ha aperto / sta compilando
    'COMPLETATA',      -- cliente ha cliccato Invia, scheda chiusa
    'SCADUTA',         -- token expired senza completamento
    'ARCHIVIATA'       -- nascosta dal consulente (soft-delete)
  )),

  -- Tracking compilazione
  data_invio TIMESTAMPTZ,
  data_prima_apertura TIMESTAMPTZ,
  data_ultima_modifica TIMESTAMPTZ,
  data_completamento TIMESTAMPTZ,
  ultimo_step_visitato SMALLINT DEFAULT 0,

  -- ------------------------------------------------------------------
  -- SEZIONE A — Anagrafica e contesto
  -- ------------------------------------------------------------------
  referente_nome VARCHAR(200),
  referente_ruolo VARCHAR(60) CHECK (referente_ruolo IS NULL OR referente_ruolo IN (
    'TITOLARE_AMMINISTRATORE',
    'DIRETTORE_GENERALE',
    'HR_MANAGER',
    'RESPONSABILE_FUNZIONE',
    'RESPONSABILE_STABILIMENTO',
    'ALTRO'
  )),
  ateco_dichiarato VARCHAR(50),
  ateco_descrizione_dichiarata TEXT,
  ccnl_dichiarato VARCHAR(300),
  numero_dipendenti_dichiarato INTEGER,
  popolazione_target TEXT[],            -- array A8: TUTTA_AZIENDA, FUNZIONE_SPECIFICA, OPERATIVE, ecc.
  popolazione_target_specifica TEXT,    -- A9: testo libero se A8 contiene FUNZIONE_SPECIFICA

  -- ------------------------------------------------------------------
  -- SEZIONE B — Strategia formativa
  -- ------------------------------------------------------------------
  piano_formazione_esistente VARCHAR(40) CHECK (piano_formazione_esistente IS NULL OR piano_formazione_esistente IN (
    'SI_AGGIORNATO',
    'SI_NON_AGGIORNATO',
    'NO_CASO_PER_CASO',
    'NO_PRIMA_VOLTA'
  )),
  obiettivi_strategici TEXT,            -- B2: testo libero, max 3 priorità
  cambiamenti_previsti TEXT[],          -- B3: array di codici

  -- ------------------------------------------------------------------
  -- SEZIONE C — Formazione obbligatoria (gli stati per tipo_obbligo
  -- stanno nella tabella figlia scadenze_bandi_fabbisogno_obblighi_dichiarati)
  -- ------------------------------------------------------------------
  scadenze_imminenti VARCHAR(20) CHECK (scadenze_imminenti IS NULL OR scadenze_imminenti IN (
    'SI', 'NO', 'DA_VERIFICARE'
  )),
  altri_obblighi_settore TEXT,          -- C3

  -- ------------------------------------------------------------------
  -- SEZIONE D — Fabbisogni non obbligatori
  -- ------------------------------------------------------------------
  aree_gap_competenze TEXT[],           -- D1: max 5 codici
  altri_fabbisogni TEXT,                -- D2
  livello_competenze_attuali SMALLINT CHECK (livello_competenze_attuali IS NULL OR livello_competenze_attuali BETWEEN 1 AND 5),
  figure_prioritarie TEXT[],            -- D4

  -- ------------------------------------------------------------------
  -- SEZIONE E — Modalità, budget, vincoli
  -- ------------------------------------------------------------------
  modalita_erogazione TEXT[],           -- E1
  budget_annuo VARCHAR(40) CHECK (budget_annuo IS NULL OR budget_annuo IN (
    'FINO_3000',
    '3001_10000',
    '10001_30000',
    'OLTRE_30000',
    'NON_DEFINITO'
  )),
  vincoli_organizzativi TEXT[],         -- E3
  picchi_operativita INTEGER[]          -- E4: array di mesi (1-12)
    CHECK (picchi_operativita IS NULL OR picchi_operativita <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::int[]),

  -- ------------------------------------------------------------------
  -- SEZIONE F — Priorità e valutazione
  -- ------------------------------------------------------------------
  orizzonte_temporale VARCHAR(40) CHECK (orizzonte_temporale IS NULL OR orizzonte_temporale IN (
    'ENTRO_3_MESI',
    'ENTRO_6_MESI',
    'ENTRO_FINE_ANNO',
    'PLURIENNALE'
  )),
  strategicita_formazione SMALLINT CHECK (strategicita_formazione IS NULL OR strategicita_formazione BETWEEN 1 AND 5),
  misurazione_efficacia TEXT[],         -- F3
  note_libere TEXT,                     -- F4

  -- ------------------------------------------------------------------
  -- Audit
  -- ------------------------------------------------------------------
  inviata_da_utente_id UUID REFERENCES scadenze_bandi_utenti(id),
  ip_compilazione INET,
  user_agent_compilazione TEXT,
  risposte_extra JSONB,                 -- estensioni future senza migrazione

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fabbisogno_riv_cliente_stato
  ON scadenze_bandi_fabbisogno_rilevazioni(cliente_id, stato);

CREATE INDEX IF NOT EXISTS idx_fabbisogno_riv_token
  ON scadenze_bandi_fabbisogno_rilevazioni(token);

CREATE INDEX IF NOT EXISTS idx_fabbisogno_riv_anno
  ON scadenze_bandi_fabbisogno_rilevazioni(cliente_id, anno_riferimento);


-- ----------------------------------------------------------------------------
-- 3. Tabella figlia: mappatura popolazione per dipartimento (A6)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scadenze_bandi_fabbisogno_popolazione (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rilevazione_id UUID NOT NULL
    REFERENCES scadenze_bandi_fabbisogno_rilevazioni(id) ON DELETE CASCADE,
  area VARCHAR(200) NOT NULL,
  numero_dipendenti INTEGER,
  note VARCHAR(500),
  ordine SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fabbisogno_pop_rilevazione
  ON scadenze_bandi_fabbisogno_popolazione(rilevazione_id);


-- ----------------------------------------------------------------------------
-- 4. Tabella figlia: inserimenti previsti (A7)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scadenze_bandi_fabbisogno_inserimenti_previsti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rilevazione_id UUID NOT NULL
    REFERENCES scadenze_bandi_fabbisogno_rilevazioni(id) ON DELETE CASCADE,
  area VARCHAR(200) NOT NULL,
  numero_inserimenti INTEGER,
  periodo VARCHAR(100),
  ordine SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fabbisogno_ins_rilevazione
  ON scadenze_bandi_fabbisogno_inserimenti_previsti(rilevazione_id);


-- ----------------------------------------------------------------------------
-- 5. Tabella figlia: stato obblighi formativi dichiarati (C1)
-- ----------------------------------------------------------------------------
-- Una riga per ogni tipo_obbligo dichiarato dal cliente. Tiene traccia anche
-- dello stato proposto in pre-compilazione (a partire dalla scheda
-- Certificazioni Obbligatorie del gestionale) per evidenziare le discrepanze.

CREATE TABLE IF NOT EXISTS scadenze_bandi_fabbisogno_obblighi_dichiarati (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rilevazione_id UUID NOT NULL
    REFERENCES scadenze_bandi_fabbisogno_rilevazioni(id) ON DELETE CASCADE,

  -- Riusa lo stesso enum esteso applicato alla tabella certificazioni
  tipo_obbligo VARCHAR(100) NOT NULL CHECK (tipo_obbligo IN (
    'FORMAZIONE_LAVORATORI_RISCHIO_BASSO',
    'FORMAZIONE_LAVORATORI_RISCHIO_MEDIO',
    'FORMAZIONE_LAVORATORI_RISCHIO_ALTO',
    'RSPP',
    'DIRIGENTI_SSL',
    'PREPOSTI',
    'RLS',
    'ANTINCENDIO_BASSO',
    'ANTINCENDIO_MEDIO',
    'ANTINCENDIO_ALTO',
    'PRIMO_SOCCORSO',
    'HACCP',
    'PRIVACY_GDPR',
    'ANTIRICICLAGGIO',
    'RESPONSABILITA_AMMINISTRATIVA_231',
    'USO_ATTREZZATURE',
    'ALTRO'
  )),

  stato_dichiarato VARCHAR(30) NOT NULL CHECK (stato_dichiarato IN (
    'ADEMPIUTO',
    'DA_RINNOVARE',
    'NON_SVOLTO',
    'NON_APPLICABILE'
  )),

  -- Stato proposto in pre-compilazione (NULL se non c'erano dati nel gestionale)
  stato_precompilato VARCHAR(30) CHECK (stato_precompilato IS NULL OR stato_precompilato IN (
    'ADEMPIUTO',
    'DA_RINNOVARE',
    'NON_SVOLTO',
    'NON_APPLICABILE'
  )),

  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(rilevazione_id, tipo_obbligo)
);

CREATE INDEX IF NOT EXISTS idx_fabbisogno_obb_rilevazione
  ON scadenze_bandi_fabbisogno_obblighi_dichiarati(rilevazione_id);


-- ----------------------------------------------------------------------------
-- 6. Trigger: aggiorna updated_at sulla rilevazione a ogni modifica
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_fabbisogno_rilevazione_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fabbisogno_riv_updated_at
  ON scadenze_bandi_fabbisogno_rilevazioni;

CREATE TRIGGER trg_fabbisogno_riv_updated_at
  BEFORE UPDATE ON scadenze_bandi_fabbisogno_rilevazioni
  FOR EACH ROW
  EXECUTE FUNCTION update_fabbisogno_rilevazione_timestamp();


-- ----------------------------------------------------------------------------
-- 7. RLS coerente con il resto del modulo formazione (disabilitate)
-- ----------------------------------------------------------------------------
-- Le altre tabelle del modulo non usano RLS: la protezione avviene a livello
-- API tramite verifyJWT() per gli endpoint del consulente, e tramite token
-- per gli endpoint pubblici del cliente. Manteniamo lo stesso pattern.

ALTER TABLE scadenze_bandi_fabbisogno_rilevazioni             DISABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_fabbisogno_popolazione             DISABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_fabbisogno_inserimenti_previsti    DISABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_fabbisogno_obblighi_dichiarati     DISABLE ROW LEVEL SECURITY;


COMMIT;

-- ============================================================================
-- Verifica post-esecuzione (queste query sono solo da copiare nel SQL Editor
-- per controllare che tutto sia andato bene; non fanno parte della migrazione)
-- ============================================================================

-- 1. Verifica enum esteso
-- SELECT pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'scadenze_bandi_certificazioni_obbligatorie_tipo_obbligo_check';

-- 2. Verifica esistenza nuove tabelle
-- SELECT tablename FROM pg_tables
-- WHERE tablename LIKE 'scadenze_bandi_fabbisogno_%'
-- ORDER BY tablename;

-- 3. Conta righe (devono essere 0 dopo la prima esecuzione)
-- SELECT
--   (SELECT count(*) FROM scadenze_bandi_fabbisogno_rilevazioni) AS rilevazioni,
--   (SELECT count(*) FROM scadenze_bandi_fabbisogno_popolazione) AS popolazione,
--   (SELECT count(*) FROM scadenze_bandi_fabbisogno_inserimenti_previsti) AS inserimenti,
--   (SELECT count(*) FROM scadenze_bandi_fabbisogno_obblighi_dichiarati) AS obblighi;
