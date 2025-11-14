-- Debug completo sistema eredità documenti bando -> progetto

-- 1. Verifica che il trigger esista e sia attivo
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_eredita_allegati';

-- 2. Verifica che la funzione trigger esista
SELECT
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'eredita_allegati_da_bando';

-- 3. Verifica documenti del bando "pid marche"
-- Prima trova l'ID del bando
WITH bando_info AS (
    SELECT id, nome
    FROM scadenze_bandi_bandi
    WHERE nome ILIKE '%pid%marche%' OR nome ILIKE '%marche%'
    LIMIT 1
)
SELECT
    'BANDO INFO' as tipo,
    b.id as bando_id,
    b.nome as bando_nome,
    NULL::text as categoria,
    NULL::text as tipo_documento,
    NULL::text as nome_file
FROM bando_info b

UNION ALL

-- Poi verifica i documenti di questo bando
SELECT
    'DOCUMENTO BANDO' as tipo,
    bd.bando_id,
    b.nome as bando_nome,
    bd.categoria,
    bd.tipo_documento,
    bd.nome_file
FROM scadenze_bandi_documenti bd
JOIN scadenze_bandi_bandi b ON bd.bando_id = b.id
WHERE b.nome ILIKE '%pid%marche%' OR b.nome ILIKE '%marche%'
ORDER BY tipo, categoria;

-- 4. Verifica progetti creati da questo bando
WITH bando_info AS (
    SELECT id
    FROM scadenze_bandi_bandi
    WHERE nome ILIKE '%pid%marche%' OR nome ILIKE '%marche%'
    LIMIT 1
)
SELECT
    'PROGETTO DA BANDO' as tipo,
    p.id as progetto_id,
    p.titolo_progetto,
    p.bando_id,
    p.created_at,
    -- Verifica se ha documenti ereditati
    (SELECT COUNT(*) FROM scadenze_bandi_documenti_progetto dp WHERE dp.progetto_id = p.id AND dp.ereditato_da_bando = true) as documenti_ereditati,
    (SELECT COUNT(*) FROM scadenze_bandi_documenti_progetto dp WHERE dp.progetto_id = p.id) as documenti_totali
FROM scadenze_bandi_progetti p
JOIN bando_info b ON p.bando_id = b.id
ORDER BY p.created_at DESC;

-- 5. Verifica documenti progetto specifici (ultimi 3 progetti)
SELECT
    'DOCUMENTO PROGETTO' as tipo,
    dp.progetto_id,
    p.titolo_progetto,
    dp.nome_file,
    dp.categoria,
    dp.ereditato_da_bando,
    dp.bando_documento_origine_id,
    dp.created_at
FROM scadenze_bandi_documenti_progetto dp
JOIN scadenze_bandi_progetti p ON dp.progetto_id = p.id
WHERE p.created_at > NOW() - INTERVAL '1 day'  -- Progetti creati oggi
ORDER BY dp.created_at DESC;

-- 6. Test manuale del trigger (simulazione)
-- Trova il bando "pid marche" e conta documenti allegati
WITH test_trigger AS (
    SELECT
        b.id as bando_id,
        b.nome as bando_nome,
        COUNT(CASE WHEN bd.categoria = 'allegato' AND bd.tipo_documento IN ('allegato', 'modulistica') THEN 1 END) as allegati_disponibili,
        ARRAY_AGG(
            CASE
                WHEN bd.categoria = 'allegato' AND bd.tipo_documento IN ('allegato', 'modulistica')
                THEN bd.nome_file
            END
        ) FILTER (WHERE bd.categoria = 'allegato' AND bd.tipo_documento IN ('allegato', 'modulistica')) as nomi_allegati
    FROM scadenze_bandi_bandi b
    LEFT JOIN scadenze_bandi_documenti bd ON b.id = bd.bando_id
    WHERE b.nome ILIKE '%pid%marche%' OR b.nome ILIKE '%marche%'
    GROUP BY b.id, b.nome
)
SELECT
    'TEST TRIGGER' as tipo,
    bando_id,
    bando_nome,
    allegati_disponibili,
    nomi_allegati
FROM test_trigger;

-- 7. Verifica logs del trigger (se ci sono stati errori)
-- PostgreSQL non ha logs diretti, ma possiamo testare la condizione
SELECT
    'CONDIZIONE TRIGGER' as info,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM scadenze_bandi_documenti bd
            JOIN scadenze_bandi_bandi b ON bd.bando_id = b.id
            WHERE (b.nome ILIKE '%pid%marche%' OR b.nome ILIKE '%marche%')
            AND bd.categoria = 'allegato'
            AND bd.tipo_documento IN ('allegato', 'modulistica')
        ) THEN 'ALLEGATI DISPONIBILI PER EREDITÀ'
        ELSE 'NESSUN ALLEGATO COMPATIBILE TROVATO'
    END as risultato;