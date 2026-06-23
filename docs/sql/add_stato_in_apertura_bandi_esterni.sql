-- =====================================================================
-- Migration: stato 'in_apertura' per i bandi esterni (Fase B)
-- Da eseguire in Supabase SQL Editor (DOPO add_lista_spesa_bandi_esterni.sql)
--
-- Contesto: gli alert Agevolando includono bandi non ancora aperti
-- ("Apertura: Aprirà il GG/MM/AAAA"). Decisione di prodotto: mostrarli in
-- anticipo al consulente (per preparare il cliente), ma con etichetta distinta
-- da un bando già attivo. Introduciamo quindi lo stato 'in_apertura' e lo
-- includiamo nel match insieme ad 'attivo'.
--
-- Idempotente / additiva. Sicura da rieseguire.
-- =====================================================================

-- 1. Allarga il CHECK sullo stato per ammettere 'in_apertura'.
ALTER TABLE scadenze_bandi_bandi_esterni
    DROP CONSTRAINT IF EXISTS scadenze_bandi_bandi_esterni_stato_check;

ALTER TABLE scadenze_bandi_bandi_esterni
    ADD CONSTRAINT scadenze_bandi_bandi_esterni_stato_check
    CHECK (stato IN ('attivo', 'in_apertura', 'scaduto', 'archiviato'));

-- 2. Aggiorna la RPC del match: ora considera anche i bandi 'in_apertura'.
--    (resto invariato rispetto alla Fase A: overlap && categorie, esclusione override)
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
    WHERE b.stato IN ('attivo', 'in_apertura')
      AND cat.categorie IS NOT NULL
      AND b.investimenti_spesati && cat.categorie
      AND NOT EXISTS (
          SELECT 1
          FROM scadenze_bandi_clienti_bandi_esterni ov
          WHERE ov.cliente_id = p_cliente_id
            AND ov.bando_esterno_id = b.id
      )
    -- I bandi già attivi prima di quelli che apriranno; poi per scadenza.
    ORDER BY (b.stato = 'in_apertura'),
             b.data_scadenza ASC NULLS LAST,
             b.created_at DESC;
$$;

COMMENT ON FUNCTION match_bandi_esterni_per_cliente IS
    'Match deterministico: bandi esterni attivi o in apertura le cui categorie di spesa intersecano le esigenze attive del cliente, esclusi quelli scartati/convertiti. Vista live.';

-- Smoke test (commentato):
-- SELECT stato, count(*) FROM scadenze_bandi_bandi_esterni GROUP BY stato;
