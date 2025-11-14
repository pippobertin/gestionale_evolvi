-- Test debug autocompilazione per capire l'errore

-- 1. Test manuale della funzione con logging dettagliato
DO $$
DECLARE
    test_documento_id UUID;
    test_progetto_id UUID;
    test_result JSON;
    cliente_exists BOOLEAN;
    progetto_exists BOOLEAN;
    documento_exists BOOLEAN;
BEGIN
    -- Trova un documento ereditato per il test
    SELECT
        dp.id,
        dp.progetto_id
    INTO test_documento_id, test_progetto_id
    FROM scadenze_bandi_documenti_progetto dp
    WHERE dp.ereditato_da_bando = TRUE
    LIMIT 1;

    IF test_documento_id IS NULL THEN
        RAISE NOTICE '❌ Nessun documento ereditato trovato per test';
        RETURN;
    END IF;

    RAISE NOTICE '🧪 TEST DEBUG AUTOCOMPILAZIONE';
    RAISE NOTICE 'Documento ID: %', test_documento_id;
    RAISE NOTICE 'Progetto ID: %', test_progetto_id;

    -- Verifica esistenza documento
    SELECT EXISTS (
        SELECT 1 FROM scadenze_bandi_documenti_progetto
        WHERE id = test_documento_id AND progetto_id = test_progetto_id
    ) INTO documento_exists;
    RAISE NOTICE 'Documento esiste: %', documento_exists;

    -- Verifica esistenza progetto
    SELECT EXISTS (
        SELECT 1 FROM scadenze_bandi_progetti
        WHERE id = test_progetto_id
    ) INTO progetto_exists;
    RAISE NOTICE 'Progetto esiste: %', progetto_exists;

    -- Verifica esistenza cliente
    SELECT EXISTS (
        SELECT 1 FROM scadenze_bandi_clienti c
        JOIN scadenze_bandi_progetti p ON c.id = p.cliente_id
        WHERE p.id = test_progetto_id
    ) INTO cliente_exists;
    RAISE NOTICE 'Cliente collegato esiste: %', cliente_exists;

    IF documento_exists AND progetto_exists AND cliente_exists THEN
        RAISE NOTICE '✅ Tutte le condizioni soddisfatte, test funzione...';

        -- Esegui la funzione di autocompilazione
        SELECT auto_compila_allegato_progetto(test_documento_id, test_progetto_id)
        INTO test_result;

        RAISE NOTICE 'Risultato funzione: %', test_result;

        -- Analizza il risultato
        IF (test_result->>'success')::boolean THEN
            RAISE NOTICE '🎉 AUTOCOMPILAZIONE RIUSCITA!';
            RAISE NOTICE 'Messaggio: %', test_result->>'message';
            RAISE NOTICE 'Dati: %', test_result->'data';
        ELSE
            RAISE NOTICE '❌ AUTOCOMPILAZIONE FALLITA!';
            RAISE NOTICE 'Errore: %', test_result->>'error';
            RAISE NOTICE 'Codice errore: %', test_result->>'error_code';
            RAISE NOTICE 'Contesto: %', test_result->>'error_context';
        END IF;
    ELSE
        RAISE NOTICE '❌ Condizioni non soddisfatte per il test';
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERRORE DURANTE TEST: %', SQLERRM;
    RAISE NOTICE 'Codice errore: %', SQLSTATE;
END $$;

-- 2. Verifica stato documento dopo tentativo
SELECT
    'STATO POST-TEST:' as info,
    id,
    nome_file,
    auto_compilazione_completata,
    auto_compilazione_status,
    updated_at
FROM scadenze_bandi_documenti_progetto
WHERE ereditato_da_bando = TRUE
ORDER BY updated_at DESC
LIMIT 1;