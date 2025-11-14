-- Verifica completa trigger e funzione eredità

-- 1. Verifica se trigger esiste
SELECT 'TRIGGER ESISTENTE:' as info;
SELECT
    t.trigger_name,
    t.event_manipulation,
    t.action_timing,
    t.action_statement
FROM information_schema.triggers t
WHERE t.trigger_name = 'trigger_eredita_allegati';

-- 2. Verifica se funzione esiste
SELECT 'FUNZIONE ESISTENTE:' as info;
SELECT
    r.routine_name,
    r.routine_type,
    r.data_type
FROM information_schema.routines r
WHERE r.routine_name = 'eredita_allegati_da_bando';

-- 3. Mostra definizione funzione (se esiste)
SELECT 'DEFINIZIONE FUNZIONE:' as info;
SELECT pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'eredita_allegati_da_bando'
AND n.nspname = 'public';

-- 4. Verifica tabelle coinvolte esistono
SELECT 'TABELLE ESISTENTI:' as info;
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_name IN (
    'scadenze_bandi_progetti',
    'scadenze_bandi_documenti',
    'scadenze_bandi_documenti_progetto'
)
AND table_schema = 'public';

-- 5. Test della condizione del trigger
SELECT 'TEST CONDIZIONE TRIGGER:' as info;
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM scadenze_bandi_bandi b
            JOIN scadenze_bandi_documenti bd ON b.id = bd.bando_id
            WHERE bd.categoria = 'allegato'
            AND bd.tipo_documento IN ('allegato', 'modulistica')
        ) THEN 'CONDIZIONI SODDISFATTE ✅'
        ELSE 'NESSUN ALLEGATO TROVATO ❌'
    END as risultato;