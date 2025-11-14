-- Test manuale sistema eredità documenti

-- PARTE 1: Test condizioni per l'eredità
DO $$
DECLARE
    bando_test_id INTEGER;
    progetto_test_id INTEGER;
    allegati_count INTEGER;
    progetti_count INTEGER;
BEGIN
    -- Trova il bando "pid marche"
    SELECT id INTO bando_test_id
    FROM scadenze_bandi_bandi
    WHERE nome ILIKE '%pid%marche%' OR nome ILIKE '%marche%'
    LIMIT 1;

    IF bando_test_id IS NULL THEN
        RAISE NOTICE '❌ BANDO NON TROVATO';
        RETURN;
    END IF;

    RAISE NOTICE '✅ Bando trovato ID: %', bando_test_id;

    -- Conta allegati disponibili per eredità
    SELECT COUNT(*) INTO allegati_count
    FROM scadenze_bandi_documenti
    WHERE bando_id = bando_test_id
    AND categoria = 'allegato'
    AND tipo_documento IN ('allegato', 'modulistica');

    RAISE NOTICE '✅ Allegati disponibili: %', allegati_count;

    -- Trova progetti da questo bando
    SELECT COUNT(*) INTO progetti_count
    FROM scadenze_bandi_progetti
    WHERE bando_id = bando_test_id;

    RAISE NOTICE '✅ Progetti collegati: %', progetti_count;

    IF allegati_count > 0 AND progetti_count > 0 THEN
        RAISE NOTICE '🎯 CONDIZIONI EREDITÀ SODDISFATTE';

        -- Prova a chiamare manualmente la funzione eredità
        RAISE NOTICE 'Tentativo chiamata manuale funzione eredità...';

        SELECT id INTO progetto_test_id
        FROM scadenze_bandi_progetti
        WHERE bando_id = bando_test_id
        ORDER BY created_at DESC
        LIMIT 1;

        RAISE NOTICE 'Test progetto ID: %', progetto_test_id;

        -- Chiama la funzione manualmente
        PERFORM eredita_allegati_da_bando();

        RAISE NOTICE '✅ Funzione eredità chiamata manualmente';

        -- Verifica se ora ci sono documenti ereditati
        SELECT COUNT(*) INTO allegati_count
        FROM scadenze_bandi_documenti_progetto
        WHERE progetto_id = progetto_test_id
        AND ereditato_da_bando = true;

        IF allegati_count > 0 THEN
            RAISE NOTICE '🎉 EREDITÀ FUNZIONA! Documenti ereditati: %', allegati_count;
        ELSE
            RAISE NOTICE '❌ EREDITÀ NON FUNZIONA - Nessun documento ereditato';
            RAISE NOTICE 'Verifica funzione trigger e condizioni';
        END IF;
    ELSE
        RAISE NOTICE '❌ CONDIZIONI NON SODDISFATTE';
        RAISE NOTICE 'Allegati: %, Progetti: %', allegati_count, progetti_count;
    END IF;
END $$;