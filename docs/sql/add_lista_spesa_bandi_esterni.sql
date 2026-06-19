-- =====================================================================
-- Migration: Lista della spesa cliente + Bandi esterni (Agevolando) — Fase A
-- Da eseguire in Supabase SQL Editor
--
-- Aggiunge:
--   - scadenze_bandi_clienti_esigenze  (la "lista della spesa" del cliente)
--   - scadenze_bandi_bandi_esterni      (catalogo condiviso bandi esterni)
--   - scadenze_bandi_clienti_bandi_esterni (override per-cliente: scartato/convertito)
--   - Indici GIN sugli array text[] (categorie / investimenti_spesati) per il match &&
--   - RPC match_bandi_esterni_per_cliente(p_cliente_id)
--   - Trigger updated_at, RLS, indici, commenti
--
-- Vocabolario condiviso (14 voci "Tipologia di investimento" Agevolando) lato app:
--   frontend/src/lib/tipologieInvestimento.ts
--
-- Nota di modello: l'override e' a livello CLIENTE (non per-esigenza) perche' il
-- match aggrega tutte le esigenze attive del cliente in un solo confronto.
--
-- Idempotente: IF NOT EXISTS / CREATE OR REPLACE. Sicura da rieseguire (additiva).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabella esigenze cliente ("lista della spesa")
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scadenze_bandi_clienti_esigenze (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,

    -- Subset delle 14 voci del vocabolario condiviso. Validazione contenuti lato app.
    categorie TEXT[] NOT NULL DEFAULT '{}',

    -- Campo libero (gemello delle note): cattura la sfumatura dell'esigenza.
    descrizione TEXT,

    origine TEXT NOT NULL DEFAULT 'manuale'
        CHECK (origine IN ('manuale', 'da_nota')),
    -- Se estratta da una nota riunione, riferimento alla nota di origine.
    nota_id UUID REFERENCES scadenze_bandi_clienti_note(id) ON DELETE SET NULL,

    stato TEXT NOT NULL DEFAULT 'attiva'
        CHECK (stato IN ('attiva', 'soddisfatta', 'archiviata')),

    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_esigenze_cliente_id
    ON scadenze_bandi_clienti_esigenze(cliente_id);

CREATE INDEX IF NOT EXISTS idx_esigenze_stato
    ON scadenze_bandi_clienti_esigenze(stato);

-- Indice GIN sull'array categorie: necessario per il match con l'operatore &&
CREATE INDEX IF NOT EXISTS idx_esigenze_categorie_gin
    ON scadenze_bandi_clienti_esigenze
    USING gin (categorie);


-- ---------------------------------------------------------------------
-- 2. Tabella catalogo bandi esterni (condiviso, non per-utente)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scadenze_bandi_bandi_esterni (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    fonte TEXT NOT NULL DEFAULT 'agevolando',

    titolo TEXT NOT NULL,

    -- Subset delle 14 voci del vocabolario condiviso (campo che alimenta il match).
    investimenti_spesati TEXT[] NOT NULL DEFAULT '{}',

    tipologia_aiuto TEXT,                 -- es. 'Contributi a fondo perduto'

    -- Gate del match: stato deriva da "Bando attivo" dell'alert.
    stato TEXT NOT NULL DEFAULT 'attivo'
        CHECK (stato IN ('attivo', 'scaduto', 'archiviato')),

    data_apertura TEXT,                   -- 'Bando attivo' o data (best-effort)
    data_scadenza DATE,                   -- best-effort; NON gate del match in Fase A

    url_dettagli TEXT,                    -- link "Vedi dettagli" Agevolando

    -- Campi di dettaglio (alimentati da ingest PDF / Fase B; opzionali in Fase A)
    territorio TEXT,
    destinatari TEXT,
    settori TEXT,

    email_msg_id TEXT,                    -- dedup (Fase B); null in Fase A
    raw_payload JSONB DEFAULT '{}'::jsonb,-- sorgente originale; contenuto Agevolando = SOLO uso interno

    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bandi_esterni_stato
    ON scadenze_bandi_bandi_esterni(stato);

CREATE INDEX IF NOT EXISTS idx_bandi_esterni_email_msg_id
    ON scadenze_bandi_bandi_esterni(email_msg_id);

-- Indice GIN sull'array investimenti_spesati: necessario per il match &&
CREATE INDEX IF NOT EXISTS idx_bandi_esterni_invest_gin
    ON scadenze_bandi_bandi_esterni
    USING gin (investimenti_spesati);


-- ---------------------------------------------------------------------
-- 3. Override per-cliente del match (decisioni del consulente)
--    Il match "suggerito" NON si persiste (e' la vista live della RPC).
--    Qui vivono solo le decisioni: scartato o convertito in progetto.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scadenze_bandi_clienti_bandi_esterni (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    cliente_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
    bando_esterno_id UUID NOT NULL REFERENCES scadenze_bandi_bandi_esterni(id) ON DELETE CASCADE,

    stato TEXT NOT NULL
        CHECK (stato IN ('scartato', 'convertito')),

    -- Se 'convertito', l'eventuale progetto generato (Fase A: nullable, conversione futura).
    progetto_id UUID REFERENCES scadenze_bandi_progetti(id) ON DELETE SET NULL,

    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (cliente_id, bando_esterno_id)
);

CREATE INDEX IF NOT EXISTS idx_cli_bandi_est_cliente
    ON scadenze_bandi_clienti_bandi_esterni(cliente_id);

CREATE INDEX IF NOT EXISTS idx_cli_bandi_est_bando
    ON scadenze_bandi_clienti_bandi_esterni(bando_esterno_id);


-- ---------------------------------------------------------------------
-- 4. Trigger updated_at (riusa update_updated_at_column gia' nel repo)
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_esigenze_updated_at ON scadenze_bandi_clienti_esigenze;
CREATE TRIGGER update_esigenze_updated_at
    BEFORE UPDATE ON scadenze_bandi_clienti_esigenze
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bandi_esterni_updated_at ON scadenze_bandi_bandi_esterni;
CREATE TRIGGER update_bandi_esterni_updated_at
    BEFORE UPDATE ON scadenze_bandi_bandi_esterni
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cli_bandi_est_updated_at ON scadenze_bandi_clienti_bandi_esterni;
CREATE TRIGGER update_cli_bandi_est_updated_at
    BEFORE UPDATE ON scadenze_bandi_clienti_bandi_esterni
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ---------------------------------------------------------------------
-- 5. RLS coerente con il pattern del repo
-- ---------------------------------------------------------------------
ALTER TABLE scadenze_bandi_clienti_esigenze ENABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_bandi_esterni ENABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_clienti_bandi_esterni ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for authenticated users"
    ON scadenze_bandi_clienti_esigenze;
CREATE POLICY "Allow all operations for authenticated users"
    ON scadenze_bandi_clienti_esigenze
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users"
    ON scadenze_bandi_bandi_esterni;
CREATE POLICY "Allow all operations for authenticated users"
    ON scadenze_bandi_bandi_esterni
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users"
    ON scadenze_bandi_clienti_bandi_esterni;
CREATE POLICY "Allow all operations for authenticated users"
    ON scadenze_bandi_clienti_bandi_esterni
    FOR ALL USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 6. RPC di match deterministico esigenze cliente <-> bandi esterni
--    Aggrega le categorie delle esigenze ATTIVE del cliente in un solo
--    array e fa un singolo overlap && contro i bandi ATTIVI, escludendo
--    quelli gia' scartati/convertiti dal consulente (override).
--    STABLE, non SECURITY DEFINER: eredita le RLS del chiamante.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_bandi_esterni_per_cliente(
    p_cliente_id UUID
)
RETURNS SETOF scadenze_bandi_bandi_esterni
LANGUAGE sql
STABLE
AS $$
    WITH cat AS (
        SELECT array_agg(DISTINCT c) AS categorie
        FROM scadenze_bandi_clienti_esigenze e,
             unnest(e.categorie) AS c
        WHERE e.cliente_id = p_cliente_id
          AND e.stato = 'attiva'
    )
    SELECT b.*
    FROM scadenze_bandi_bandi_esterni b, cat
    WHERE b.stato = 'attivo'
      AND cat.categorie IS NOT NULL
      AND b.investimenti_spesati && cat.categorie
      AND NOT EXISTS (
          SELECT 1
          FROM scadenze_bandi_clienti_bandi_esterni ov
          WHERE ov.cliente_id = p_cliente_id
            AND ov.bando_esterno_id = b.id
      )
    ORDER BY b.data_scadenza ASC NULLS LAST, b.created_at DESC;
$$;

COMMENT ON FUNCTION match_bandi_esterni_per_cliente IS
    'Match deterministico: bandi esterni attivi le cui categorie di spesa intersecano le esigenze attive del cliente, esclusi quelli scartati/convertiti. Vista live.';


-- ---------------------------------------------------------------------
-- 7. Commenti documentari
-- ---------------------------------------------------------------------
COMMENT ON TABLE scadenze_bandi_clienti_esigenze IS
    'Lista della spesa del cliente: esigenze come subset delle 14 categorie Agevolando + descrizione libera. Inserite a mano o estratte dalle note.';
COMMENT ON COLUMN scadenze_bandi_clienti_esigenze.categorie IS
    'Subset delle 14 voci "Tipologia di investimento" (vocabolario condiviso lato app).';
COMMENT ON TABLE scadenze_bandi_bandi_esterni IS
    'Catalogo condiviso di bandi esterni (Agevolando). Uso interno: i contenuti non vanno redistribuiti verbatim ai clienti.';
COMMENT ON COLUMN scadenze_bandi_bandi_esterni.investimenti_spesati IS
    'Subset delle 14 voci "Tipologia di investimento" (vocabolario condiviso): campo che alimenta il match.';
COMMENT ON TABLE scadenze_bandi_clienti_bandi_esterni IS
    'Override per-cliente del match: decisioni del consulente (scartato/convertito). Il match suggerito non si persiste.';


-- ---------------------------------------------------------------------
-- 8. Smoke test (commentato)
-- ---------------------------------------------------------------------
-- SELECT 'Migration lista spesa + bandi esterni completata' AS status;
-- SELECT count(*) FROM scadenze_bandi_clienti_esigenze;
-- SELECT count(*) FROM scadenze_bandi_bandi_esterni;
-- SELECT * FROM match_bandi_esterni_per_cliente('<un-cliente-id>');
