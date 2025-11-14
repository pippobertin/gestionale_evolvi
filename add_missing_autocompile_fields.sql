-- Aggiungi campi mancanti per autocompilazione alla tabella documenti progetto

-- Verifica e aggiungi campi se mancanti
DO $$
BEGIN
    -- Campo auto_compilazione_status
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_documenti_progetto'
        AND column_name = 'auto_compilazione_status'
    ) THEN
        ALTER TABLE scadenze_bandi_documenti_progetto
        ADD COLUMN auto_compilazione_status TEXT;
        RAISE NOTICE '✅ Campo auto_compilazione_status aggiunto';
    ELSE
        RAISE NOTICE '✅ Campo auto_compilazione_status già esistente';
    END IF;

    -- Campo auto_compilazione_completata
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_documenti_progetto'
        AND column_name = 'auto_compilazione_completata'
    ) THEN
        ALTER TABLE scadenze_bandi_documenti_progetto
        ADD COLUMN auto_compilazione_completata BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ Campo auto_compilazione_completata aggiunto';
    ELSE
        RAISE NOTICE '✅ Campo auto_compilazione_completata già esistente';
    END IF;

    -- Campo file_path
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_documenti_progetto'
        AND column_name = 'file_path'
    ) THEN
        ALTER TABLE scadenze_bandi_documenti_progetto
        ADD COLUMN file_path TEXT;
        RAISE NOTICE '✅ Campo file_path aggiunto';
    ELSE
        RAISE NOTICE '✅ Campo file_path già esistente';
    END IF;

    -- Campo nome_file_compilato
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_documenti_progetto'
        AND column_name = 'nome_file_compilato'
    ) THEN
        ALTER TABLE scadenze_bandi_documenti_progetto
        ADD COLUMN nome_file_compilato TEXT;
        RAISE NOTICE '✅ Campo nome_file_compilato aggiunto';
    ELSE
        RAISE NOTICE '✅ Campo nome_file_compilato già esistente';
    END IF;

    -- Campo placeholders_compilati
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_documenti_progetto'
        AND column_name = 'placeholders_compilati'
    ) THEN
        ALTER TABLE scadenze_bandi_documenti_progetto
        ADD COLUMN placeholders_compilati JSONB;
        RAISE NOTICE '✅ Campo placeholders_compilati aggiunto';
    ELSE
        RAISE NOTICE '✅ Campo placeholders_compilati già esistente';
    END IF;

END $$;

-- Mostra struttura finale
SELECT 'STRUTTURA FINALE TABELLA:' as info;
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'scadenze_bandi_documenti_progetto'
AND table_schema = 'public'
AND column_name ILIKE '%auto%' OR column_name ILIKE '%file%' OR column_name ILIKE '%placeholder%'
ORDER BY ordinal_position;

-- Verifica finale
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ CAMPI AUTOCOMPILAZIONE PRONTI!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ auto_compilazione_status: TEXT';
    RAISE NOTICE '✅ auto_compilazione_completata: BOOLEAN';
    RAISE NOTICE '✅ file_path: TEXT';
    RAISE NOTICE '✅ nome_file_compilato: TEXT';
    RAISE NOTICE '✅ placeholders_compilati: JSONB';
    RAISE NOTICE '🎯 RIPROVA AUTOCOMPILAZIONE!';
    RAISE NOTICE '========================================';
END $$;