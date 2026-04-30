-- =====================================================================
-- Migration: Sistema Note Cliente (ingestione automatica da trascrizioni)
-- Da eseguire in Supabase SQL Editor
--
-- Aggiunge:
--   - Estensione pg_trgm per fuzzy matching nomi cliente
--   - Indice GIN trgm su denominazione clienti
--   - Tabella scadenze_bandi_clienti_note (note timeline + inbox)
--   - Tabelle di join scadenze_bandi_note_bandi e scadenze_bandi_note_progetti
--     (collegamento bidirezionale con stato suggerito/confermato/rifiutato)
--   - Trigger updated_at, RLS, indici, commenti, view aggregate
--
-- Idempotente: usa IF NOT EXISTS / CREATE OR REPLACE dove possibile.
-- Sicura da rieseguire (additiva, niente DROP).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Estensione pg_trgm per fuzzy matching
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ---------------------------------------------------------------------
-- 2. Indice GIN trigram su denominazione clienti (per /api/clienti/match)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clienti_denominazione_trgm
    ON scadenze_bandi_clienti
    USING gin (denominazione gin_trgm_ops);


-- ---------------------------------------------------------------------
-- 3. Tabella note cliente
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scadenze_bandi_clienti_note (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Cliente associato. NULL = nota in inbox, da assegnare manualmente.
    cliente_id UUID REFERENCES scadenze_bandi_clienti(id) ON DELETE SET NULL,

    -- Metadati riunione
    data_riunione DATE,
    data_caricamento DATE,
    durata_minuti_stimata INTEGER,
    tipo TEXT CHECK (tipo IN (
        'riunione_cliente',
        'riunione_interna',
        'rassegna_multi_cliente',
        'altro'
    )),

    -- Contenuto display
    titolo TEXT NOT NULL,
    sintesi_one_liner TEXT,
    contenuto_markdown TEXT NOT NULL,

    -- Dati strutturati estratti da Gemini
    entita JSONB DEFAULT '{}'::jsonb,
    verifiche_suggerite JSONB DEFAULT '[]'::jsonb,

    -- Sorgente e tracking del file originale su Drive
    sorgente TEXT NOT NULL DEFAULT 'plaud'
        CHECK (sorgente IN ('plaud', 'manuale', 'altro')),
    drive_file_id TEXT,
    drive_file_url TEXT,
    filename_originale TEXT,

    -- Matching cliente
    match_confidence NUMERIC(3,2),
    match_method TEXT CHECK (match_method IN (
        'filename',
        'gemini',
        'pg_trgm',
        'manuale',
        'inbox'
    )),

    -- Stato workflow
    stato TEXT NOT NULL DEFAULT 'pubblicata'
        CHECK (stato IN ('pubblicata', 'in_inbox', 'archiviata', 'scartata')),

    -- Audit
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- 4. Indici tabella note
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_note_cliente_id
    ON scadenze_bandi_clienti_note(cliente_id);

CREATE INDEX IF NOT EXISTS idx_note_stato
    ON scadenze_bandi_clienti_note(stato);

CREATE INDEX IF NOT EXISTS idx_note_data_riunione
    ON scadenze_bandi_clienti_note(data_riunione DESC);

CREATE INDEX IF NOT EXISTS idx_note_drive_file_id
    ON scadenze_bandi_clienti_note(drive_file_id);

-- Indice GIN sul JSONB delle entità: utile per il backward link
-- (es. cercare tutte le note che citano "Bando Fiere" tra i bandi)
CREATE INDEX IF NOT EXISTS idx_note_entita
    ON scadenze_bandi_clienti_note
    USING gin(entita);


-- ---------------------------------------------------------------------
-- 5. Tabella di join nota - bando (collegamento bidirezionale)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scadenze_bandi_note_bandi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nota_id UUID NOT NULL REFERENCES scadenze_bandi_clienti_note(id) ON DELETE CASCADE,
    bando_id UUID NOT NULL REFERENCES scadenze_bandi_bandi(id) ON DELETE CASCADE,

    stato TEXT NOT NULL DEFAULT 'suggerito'
        CHECK (stato IN ('suggerito', 'confermato', 'rifiutato')),
    score NUMERIC(3,2),
    metodo TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(nota_id, bando_id)
);

CREATE INDEX IF NOT EXISTS idx_note_bandi_nota
    ON scadenze_bandi_note_bandi(nota_id);

CREATE INDEX IF NOT EXISTS idx_note_bandi_bando
    ON scadenze_bandi_note_bandi(bando_id);

CREATE INDEX IF NOT EXISTS idx_note_bandi_stato
    ON scadenze_bandi_note_bandi(stato);


-- ---------------------------------------------------------------------
-- 6. Tabella di join nota - progetto (collegamento bidirezionale)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scadenze_bandi_note_progetti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nota_id UUID NOT NULL REFERENCES scadenze_bandi_clienti_note(id) ON DELETE CASCADE,
    progetto_id UUID NOT NULL REFERENCES scadenze_bandi_progetti(id) ON DELETE CASCADE,

    stato TEXT NOT NULL DEFAULT 'suggerito'
        CHECK (stato IN ('suggerito', 'confermato', 'rifiutato')),
    score NUMERIC(3,2),
    metodo TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(nota_id, progetto_id)
);

CREATE INDEX IF NOT EXISTS idx_note_progetti_nota
    ON scadenze_bandi_note_progetti(nota_id);

CREATE INDEX IF NOT EXISTS idx_note_progetti_progetto
    ON scadenze_bandi_note_progetti(progetto_id);

CREATE INDEX IF NOT EXISTS idx_note_progetti_stato
    ON scadenze_bandi_note_progetti(stato);


-- ---------------------------------------------------------------------
-- 7. Trigger updated_at (riusa la funzione gia' definita nel repo)
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_clienti_note_updated_at ON scadenze_bandi_clienti_note;
CREATE TRIGGER update_clienti_note_updated_at
    BEFORE UPDATE ON scadenze_bandi_clienti_note
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_note_bandi_updated_at ON scadenze_bandi_note_bandi;
CREATE TRIGGER update_note_bandi_updated_at
    BEFORE UPDATE ON scadenze_bandi_note_bandi
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_note_progetti_updated_at ON scadenze_bandi_note_progetti;
CREATE TRIGGER update_note_progetti_updated_at
    BEFORE UPDATE ON scadenze_bandi_note_progetti
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ---------------------------------------------------------------------
-- 8. RLS (Row Level Security) coerente con il pattern del repo
-- ---------------------------------------------------------------------
ALTER TABLE scadenze_bandi_clienti_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_note_bandi ENABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_note_progetti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for authenticated users"
    ON scadenze_bandi_clienti_note;
CREATE POLICY "Allow all operations for authenticated users"
    ON scadenze_bandi_clienti_note
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users"
    ON scadenze_bandi_note_bandi;
CREATE POLICY "Allow all operations for authenticated users"
    ON scadenze_bandi_note_bandi
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users"
    ON scadenze_bandi_note_progetti;
CREATE POLICY "Allow all operations for authenticated users"
    ON scadenze_bandi_note_progetti
    FOR ALL USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 9. Commenti documentari
-- ---------------------------------------------------------------------
COMMENT ON TABLE scadenze_bandi_clienti_note IS
    'Note cliente generate da trascrizioni audio (Plaud) o input manuale, ingestionate via pipeline n8n + Gemini';
COMMENT ON COLUMN scadenze_bandi_clienti_note.cliente_id IS
    'Cliente associato. NULL = nota in inbox da assegnare manualmente.';
COMMENT ON COLUMN scadenze_bandi_clienti_note.entita IS
    'JSONB con persone, bandi, progetti, fondi, fornitori, importi, scadenze estratte da Gemini';
COMMENT ON COLUMN scadenze_bandi_clienti_note.verifiche_suggerite IS
    'Array JSONB di entita sospette (storpiature) con suggerimento di correzione';
COMMENT ON COLUMN scadenze_bandi_clienti_note.match_confidence IS
    'Score 0-1 della confidenza di matching cliente';
COMMENT ON COLUMN scadenze_bandi_clienti_note.match_method IS
    'Metodo usato per matchare il cliente: filename, gemini, pg_trgm, manuale, inbox';
COMMENT ON COLUMN scadenze_bandi_clienti_note.stato IS
    'Stato della nota: pubblicata (visibile in timeline), in_inbox (da assegnare), archiviata, scartata';

COMMENT ON TABLE scadenze_bandi_note_bandi IS
    'Collegamenti N-a-N tra note e bandi, con stato suggerito/confermato/rifiutato';
COMMENT ON TABLE scadenze_bandi_note_progetti IS
    'Collegamenti N-a-N tra note e progetti, con stato suggerito/confermato/rifiutato';


-- ---------------------------------------------------------------------
-- 10. View aggregate per il frontend
-- ---------------------------------------------------------------------

-- View completa: note con bandi e progetti collegati
CREATE OR REPLACE VIEW scadenze_bandi_clienti_note_full AS
SELECT
    n.*,
    -- Bandi collegati
    COALESCE(
        (SELECT json_agg(json_build_object(
            'link_id', nb.id,
            'bando_id', nb.bando_id,
            'bando_nome', b.nome,
            'stato', nb.stato,
            'score', nb.score,
            'metodo', nb.metodo
        ) ORDER BY nb.created_at DESC)
        FROM scadenze_bandi_note_bandi nb
        LEFT JOIN scadenze_bandi_bandi b ON b.id = nb.bando_id
        WHERE nb.nota_id = n.id),
        '[]'::json
    ) AS bandi_collegati,

    -- Progetti collegati
    COALESCE(
        (SELECT json_agg(json_build_object(
            'link_id', np.id,
            'progetto_id', np.progetto_id,
            'progetto_nome', p.titolo_progetto,
            'stato', np.stato,
            'score', np.score,
            'metodo', np.metodo
        ) ORDER BY np.created_at DESC)
        FROM scadenze_bandi_note_progetti np
        LEFT JOIN scadenze_bandi_progetti p ON p.id = np.progetto_id
        WHERE np.nota_id = n.id),
        '[]'::json
    ) AS progetti_collegati,

    -- Denominazione cliente per comodita di display
    c.denominazione AS cliente_denominazione

FROM scadenze_bandi_clienti_note n
LEFT JOIN scadenze_bandi_clienti c ON c.id = n.cliente_id;


-- ---------------------------------------------------------------------
-- 11. Funzione di matching cliente con word_similarity (pg_trgm)
--     Asimmetrica: cerca quanto bene query_text si trova come "porzione"
--     dentro la denominazione del cliente. Restituisce i top N candidati
--     ordinati per score DESC.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_clienti(
    query_text TEXT,
    max_results INTEGER DEFAULT 5,
    soglia_minima REAL DEFAULT 0.2
)
RETURNS TABLE (
    id UUID,
    denominazione TEXT,
    partita_iva VARCHAR,
    codice_fiscale VARCHAR,
    score REAL
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        c.id,
        c.denominazione,
        c.partita_iva,
        c.codice_fiscale,
        word_similarity(lower(query_text), lower(c.denominazione)) AS score
    FROM scadenze_bandi_clienti c
    WHERE
        word_similarity(lower(query_text), lower(c.denominazione)) > soglia_minima
    ORDER BY score DESC
    LIMIT max_results;
$$;

COMMENT ON FUNCTION match_clienti IS
    'Fuzzy matching cliente via word_similarity. Restituisce top N candidati ordinati per score DESC. Usa lower() per case-insensitivity.';


-- ---------------------------------------------------------------------
-- 12. Indici trigram e funzioni di matching per bandi e progetti
--     (usati da /api/notes/ingest per il forward link automatico)
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_bandi_nome_trgm
    ON scadenze_bandi_bandi
    USING gin (nome gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_progetti_titolo_trgm
    ON scadenze_bandi_progetti
    USING gin (titolo_progetto gin_trgm_ops);


CREATE OR REPLACE FUNCTION match_bandi(
    query_text TEXT,
    max_results INTEGER DEFAULT 3,
    soglia_minima REAL DEFAULT 0.3
)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    score REAL
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        b.id,
        b.nome,
        word_similarity(lower(query_text), lower(b.nome)) AS score
    FROM scadenze_bandi_bandi b
    WHERE
        word_similarity(lower(query_text), lower(b.nome)) > soglia_minima
    ORDER BY score DESC
    LIMIT max_results;
$$;

COMMENT ON FUNCTION match_bandi IS
    'Fuzzy matching bando via word_similarity. Restituisce top N candidati ordinati per score DESC.';


CREATE OR REPLACE FUNCTION match_progetti(
    query_text TEXT,
    max_results INTEGER DEFAULT 3,
    soglia_minima REAL DEFAULT 0.3
)
RETURNS TABLE (
    id UUID,
    titolo_progetto TEXT,
    score REAL
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        p.id,
        p.titolo_progetto,
        word_similarity(lower(query_text), lower(p.titolo_progetto)) AS score
    FROM scadenze_bandi_progetti p
    WHERE
        p.titolo_progetto IS NOT NULL
        AND word_similarity(lower(query_text), lower(p.titolo_progetto)) > soglia_minima
    ORDER BY score DESC
    LIMIT max_results;
$$;

COMMENT ON FUNCTION match_progetti IS
    'Fuzzy matching progetto via word_similarity su titolo_progetto. Restituisce top N candidati ordinati per score DESC.';


-- ---------------------------------------------------------------------
-- 13. Funzioni di backward-link per bandi e progetti
--     Dato un bando_id (o progetto_id), scansiona le entita.bandi
--     (o entita.progetti) di tutte le note pubblicate/archiviate, calcola
--     word_similarity contro il nome, esclude quelle gia' collegate
--     (qualunque stato) e ritorna i candidati ordinati per score.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION find_note_candidate_for_bando(
    p_bando_id UUID,
    p_soglia REAL DEFAULT 0.4
)
RETURNS TABLE (
    nota_id UUID,
    titolo TEXT,
    cliente_id UUID,
    cliente_denominazione TEXT,
    data_riunione DATE,
    score REAL
)
LANGUAGE sql
STABLE
AS $$
    WITH bando AS (
        SELECT lower(nome) AS nome_l
        FROM scadenze_bandi_bandi
        WHERE id = p_bando_id
    ),
    candidati AS (
        SELECT
            n.id AS nota_id,
            n.titolo,
            n.cliente_id,
            n.data_riunione,
            MAX(word_similarity(
                (SELECT nome_l FROM bando),
                lower(elem)
            )) AS score
        FROM scadenze_bandi_clienti_note n,
             jsonb_array_elements_text(
                COALESCE(n.entita->'bandi', '[]'::jsonb)
             ) AS elem
        WHERE n.stato IN ('pubblicata', 'archiviata')
        GROUP BY n.id, n.titolo, n.cliente_id, n.data_riunione
    )
    SELECT
        c.nota_id,
        c.titolo,
        c.cliente_id,
        cl.denominazione AS cliente_denominazione,
        c.data_riunione,
        c.score
    FROM candidati c
    LEFT JOIN scadenze_bandi_clienti cl ON cl.id = c.cliente_id
    WHERE c.score > p_soglia
      AND NOT EXISTS (
          SELECT 1 FROM scadenze_bandi_note_bandi nb
          WHERE nb.nota_id = c.nota_id
            AND nb.bando_id = p_bando_id
      )
    ORDER BY c.score DESC
    LIMIT 20;
$$;

COMMENT ON FUNCTION find_note_candidate_for_bando IS
    'Scansiona le note che citano nelle entita un bando simile a quello indicato e non sono ancora collegate. Backward link bando -> note.';


CREATE OR REPLACE FUNCTION find_note_candidate_for_progetto(
    p_progetto_id UUID,
    p_soglia REAL DEFAULT 0.4
)
RETURNS TABLE (
    nota_id UUID,
    titolo TEXT,
    cliente_id UUID,
    cliente_denominazione TEXT,
    data_riunione DATE,
    score REAL
)
LANGUAGE sql
STABLE
AS $$
    WITH progetto AS (
        SELECT lower(titolo_progetto) AS nome_l
        FROM scadenze_bandi_progetti
        WHERE id = p_progetto_id AND titolo_progetto IS NOT NULL
    ),
    candidati AS (
        SELECT
            n.id AS nota_id,
            n.titolo,
            n.cliente_id,
            n.data_riunione,
            MAX(word_similarity(
                (SELECT nome_l FROM progetto),
                lower(elem)
            )) AS score
        FROM scadenze_bandi_clienti_note n,
             jsonb_array_elements_text(
                COALESCE(n.entita->'progetti', '[]'::jsonb)
             ) AS elem
        WHERE n.stato IN ('pubblicata', 'archiviata')
          AND EXISTS (SELECT 1 FROM progetto)
        GROUP BY n.id, n.titolo, n.cliente_id, n.data_riunione
    )
    SELECT
        c.nota_id,
        c.titolo,
        c.cliente_id,
        cl.denominazione AS cliente_denominazione,
        c.data_riunione,
        c.score
    FROM candidati c
    LEFT JOIN scadenze_bandi_clienti cl ON cl.id = c.cliente_id
    WHERE c.score > p_soglia
      AND NOT EXISTS (
          SELECT 1 FROM scadenze_bandi_note_progetti np
          WHERE np.nota_id = c.nota_id
            AND np.progetto_id = p_progetto_id
      )
    ORDER BY c.score DESC
    LIMIT 20;
$$;

COMMENT ON FUNCTION find_note_candidate_for_progetto IS
    'Scansiona le note che citano nelle entita un progetto simile a quello indicato e non sono ancora collegate. Backward link progetto -> note.';


-- ---------------------------------------------------------------------
-- 14. Verifica finale: query di smoke test (commentata)
-- ---------------------------------------------------------------------
-- SELECT 'Migration completata con successo' AS status;
-- SELECT count(*) AS note_count FROM scadenze_bandi_clienti_note;
-- SELECT count(*) AS link_bandi FROM scadenze_bandi_note_bandi;
-- SELECT count(*) AS link_progetti FROM scadenze_bandi_note_progetti;
-- SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
