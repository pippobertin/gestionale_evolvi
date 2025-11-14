-- Verifica funzione auto-compilazione allegati progetto

-- 1. Verifica se funzione esiste
SELECT 'FUNZIONE AUTO-COMPILAZIONE:' as info;
SELECT
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_name = 'auto_compila_allegato_progetto';

-- 2. Se non esiste, mostra come crearla
DO $$
DECLARE
    function_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.routines
        WHERE routine_name = 'auto_compila_allegato_progetto'
        AND routine_schema = 'public'
    ) INTO function_exists;

    IF function_exists THEN
        RAISE NOTICE '✅ Funzione auto_compila_allegato_progetto ESISTE';
        RAISE NOTICE 'Puoi testare la funzione di autocompilazione dal frontend';
        RAISE NOTICE 'Cerca il bottone "Auto-compila" accanto ai documenti ereditati';
    ELSE
        RAISE NOTICE '❌ Funzione auto_compila_allegato_progetto NON ESISTE';
        RAISE NOTICE '🔧 DEVI CREARE LA FUNZIONE per abilitare autocompilazione';
        RAISE NOTICE 'La funzione dovrebbe:';
        RAISE NOTICE '1. Prendere il documento template';
        RAISE NOTICE '2. Sostituire placeholders con dati azienda/progetto';
        RAISE NOTICE '3. Generare nuovo file con dati compilati';
        RAISE NOTICE '4. Aggiornare auto_compilazione_status';
    END IF;
END $$;