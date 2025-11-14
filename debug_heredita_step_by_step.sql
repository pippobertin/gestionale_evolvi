-- Debug eredità documenti passo per passo
-- Esegui questa query per capire il problema specifico

-- STEP 1: Verifica trigger esiste
SELECT 'STEP 1: VERIFICA TRIGGER' as step;
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_eredita_allegati';

-- STEP 2: Verifica funzione trigger
SELECT 'STEP 2: VERIFICA FUNZIONE' as step;
SELECT
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_name = 'eredita_allegati_da_bando';

-- STEP 3: Trova bando "pid marche"
SELECT 'STEP 3: BANDO PID MARCHE' as step;
SELECT
    id,
    nome,
    created_at
FROM scadenze_bandi_bandi
WHERE nome ILIKE '%pid%marche%' OR nome ILIKE '%marche%'
LIMIT 1;

-- STEP 4: Documenti allegati in questo bando
SELECT 'STEP 4: ALLEGATI NEL BANDO' as step;
SELECT
    bd.id,
    bd.nome_file,
    bd.categoria,
    bd.tipo_documento,
    bd.bando_id
FROM scadenze_bandi_documenti bd
JOIN scadenze_bandi_bandi b ON bd.bando_id = b.id
WHERE (b.nome ILIKE '%pid%marche%' OR b.nome ILIKE '%marche%')
AND bd.categoria = 'allegato'
AND bd.tipo_documento IN ('allegato', 'modulistica');

-- STEP 5: Progetti creati da questo bando
SELECT 'STEP 5: PROGETTI DAL BANDO' as step;
SELECT
    p.id,
    p.titolo_progetto,
    p.bando_id,
    p.created_at,
    b.nome as bando_nome
FROM scadenze_bandi_progetti p
JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
WHERE (b.nome ILIKE '%pid%marche%' OR b.nome ILIKE '%marche%')
ORDER BY p.created_at DESC;

-- STEP 6: Documenti progetti da questo bando
SELECT 'STEP 6: DOCUMENTI NEI PROGETTI' as step;
SELECT
    dp.id,
    dp.progetto_id,
    dp.nome_file,
    dp.ereditato_da_bando,
    dp.bando_documento_origine_id,
    p.titolo_progetto
FROM scadenze_bandi_documenti_progetto dp
JOIN scadenze_bandi_progetti p ON dp.progetto_id = p.id
JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
WHERE (b.nome ILIKE '%pid%marche%' OR b.nome ILIKE '%marche%');