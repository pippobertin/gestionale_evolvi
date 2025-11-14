-- Verifica completa struttura tabella clienti per autocompilazione

-- 1. Mostra tutte le colonne della tabella clienti
SELECT 'STRUTTURA TABELLA CLIENTI:' as info;
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'scadenze_bandi_clienti'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Mostra un record di esempio per vedere i dati disponibili
SELECT 'ESEMPIO RECORD CLIENTE:' as info;
SELECT *
FROM scadenze_bandi_clienti
WHERE denominazione ILIKE '%blm%' OR denominazione ILIKE '%project%'
LIMIT 1;

-- 3. Controlla se esistono campi legale rappresentante
DO $$
DECLARE
    has_legale_fields BOOLEAN;
    missing_fields TEXT[];
BEGIN
    -- Verifica campi legale rappresentante comuni
    SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'scadenze_bandi_clienti'
        AND table_schema = 'public'
        AND column_name IN ('legale_rappresentante', 'nome_legale', 'cognome_legale', 'legale_rappresentante_nome')
    ) INTO has_legale_fields;

    IF has_legale_fields THEN
        RAISE NOTICE '✅ Campi legale rappresentante trovati nella tabella clienti';
    ELSE
        RAISE NOTICE '❌ Campi legale rappresentante NON trovati nella tabella clienti';
        RAISE NOTICE '🔧 OPZIONI:';
        RAISE NOTICE '1. Aggiungere colonne legale rappresentante alla tabella clienti';
        RAISE NOTICE '2. Modificare funzione autocompilazione per usare solo dati azienda';
        RAISE NOTICE '3. Usare placeholder generici per il legale rappresentante';
    END IF;
END $$;