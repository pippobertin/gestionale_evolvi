-- =====================================================================
-- Migration: viste per il match bandi esterni <-> clienti (Interrogazioni)
-- Da eseguire in Supabase SQL Editor (DOPO le migrazioni Fase A + in_apertura)
--
-- Espone il match come DATI interrogabili dalla pagina "Ricerche"/Interrogazioni.
-- Due viste:
--   1. vista_match_bandi_clienti      -> 1 riga per coppia (cliente, bando) in match
--                                        (dettaglio; base riusabile)
--   2. vista_match_bandi_per_cliente  -> 1 riga per cliente, aggregata
--                                        (ambito "Bandi esterni <-> Clienti")
--
-- Logica gemella della RPC match_bandi_esterni_per_cliente: categorie delle
-- esigenze ATTIVE del cliente che intersecano gli investimenti_spesati di bandi
-- 'attivo'/'in_apertura', esclusi quelli scartati/convertiti (override).
--
-- Viste = proiezione LIVE: si aggiornano da sole con esigenze/bandi/override.
-- Idempotente. Le tendine usano il client Supabase pubblico -> GRANT SELECT.
-- =====================================================================

DROP VIEW IF EXISTS vista_match_bandi_per_cliente;
DROP VIEW IF EXISTS vista_match_bandi_clienti;

-- ---------------------------------------------------------------------
-- 1. Vista di dettaglio: 1 riga per coppia (cliente, bando) in match
-- ---------------------------------------------------------------------
CREATE VIEW vista_match_bandi_clienti AS
WITH esig AS (
    SELECT e.cliente_id, array_agg(DISTINCT c) AS categorie
    FROM scadenze_bandi_clienti_esigenze e,
         unnest(e.categorie) AS c
    WHERE e.stato = 'attiva'
    GROUP BY e.cliente_id
)
SELECT
    cl.id                       AS cliente_id,
    cl.denominazione            AS cliente_denominazione,
    cl.partita_iva              AS cliente_partita_iva,
    cl.provincia_fatturazione   AS cliente_provincia,
    b.id                        AS bando_id,
    b.titolo,
    b.fonte,
    b.tipologia_aiuto,
    b.stato,
    b.data_apertura,
    b.data_scadenza,
    b.url_dettagli,
    b.investimenti_spesati,
    -- Il "perche'" del match: intersezione categorie esigenze <-> spesa bando.
    ARRAY(
        SELECT unnest(b.investimenti_spesati)
        INTERSECT
        SELECT unnest(esig.categorie)
    )                           AS categorie_in_comune
FROM esig
JOIN scadenze_bandi_clienti cl ON cl.id = esig.cliente_id
JOIN scadenze_bandi_bandi_esterni b
      ON b.stato IN ('attivo', 'in_apertura')
     AND b.investimenti_spesati && esig.categorie
WHERE NOT EXISTS (
    SELECT 1
    FROM scadenze_bandi_clienti_bandi_esterni ov
    WHERE ov.cliente_id = cl.id
      AND ov.bando_esterno_id = b.id
);

COMMENT ON VIEW vista_match_bandi_clienti IS
    'Match bandi esterni <-> clienti, 1 riga per coppia. Uso interno (contenuti Agevolando non redistribuibili ai clienti).';

-- ---------------------------------------------------------------------
-- 2. Vista aggregata per cliente: 1 riga per cliente con il riepilogo
-- ---------------------------------------------------------------------
CREATE VIEW vista_match_bandi_per_cliente AS
WITH cats AS (
    -- Unione distinta delle categorie coperte da TUTTI i bandi del cliente.
    SELECT m.cliente_id, array_agg(DISTINCT cc ORDER BY cc) AS categorie_coperte
    FROM vista_match_bandi_clienti m,
         unnest(m.categorie_in_comune) AS cc
    GROUP BY m.cliente_id
)
SELECT
    m.cliente_id,
    m.cliente_denominazione,
    m.cliente_partita_iva,
    m.cliente_provincia,
    count(*)::int                                          AS n_bandi,
    count(*) FILTER (WHERE m.stato = 'attivo')::int        AS n_bandi_attivi,
    count(*) FILTER (WHERE m.stato = 'in_apertura')::int   AS n_bandi_in_apertura,
    c.categorie_coperte,
    array_agg(m.titolo ORDER BY m.titolo)                  AS bandi_titoli
FROM vista_match_bandi_clienti m
JOIN cats c USING (cliente_id)
GROUP BY m.cliente_id, m.cliente_denominazione, m.cliente_partita_iva,
         m.cliente_provincia, c.categorie_coperte;

COMMENT ON VIEW vista_match_bandi_per_cliente IS
    'Riepilogo per cliente dei bandi esterni in match (n. bandi, categorie coperte, titoli). Alimenta l''ambito Interrogazioni "Bandi esterni <-> Clienti".';

-- ---------------------------------------------------------------------
-- 3. Permessi: la pagina Interrogazioni interroga col client pubblico.
-- ---------------------------------------------------------------------
GRANT SELECT ON vista_match_bandi_clienti     TO anon, authenticated;
GRANT SELECT ON vista_match_bandi_per_cliente TO anon, authenticated;

-- Ricarica la cache schema di PostgREST (Supabase di solito lo fa da solo).
NOTIFY pgrst, 'reload schema';

-- Smoke test (commentato):
-- SELECT * FROM vista_match_bandi_per_cliente ORDER BY n_bandi DESC;
