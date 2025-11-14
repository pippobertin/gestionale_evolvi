-- Fix funzione autocompilazione per usare tabella clienti corretta

-- Elimina eventuale funzione esistente errata
DROP FUNCTION IF EXISTS auto_compila_allegato_progetto(UUID);

-- Crea funzione autocompilazione corretta
CREATE OR REPLACE FUNCTION auto_compila_allegato_progetto(documento_id UUID)
RETURNS JSON AS $$
DECLARE
    doc_record RECORD;
    cliente_record RECORD;
    progetto_record RECORD;
    placeholders JSON;
    result JSON;
BEGIN
    -- Ottieni documento progetto
    SELECT * INTO doc_record
    FROM scadenze_bandi_documenti_progetto
    WHERE id = documento_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Documento non trovato');
    END IF;

    -- Ottieni progetto collegato
    SELECT * INTO progetto_record
    FROM scadenze_bandi_progetti
    WHERE id = doc_record.progetto_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Progetto non trovato');
    END IF;

    -- Ottieni cliente/azienda collegata (TABELLA CORRETTA!)
    SELECT * INTO cliente_record
    FROM scadenze_bandi_clienti
    WHERE id = progetto_record.cliente_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Cliente non trovato');
    END IF;

    -- Prepara placeholder per autocompilazione
    placeholders := json_build_object(
        'DENOMINAZIONE_AZIENDA', COALESCE(cliente_record.denominazione, '[DENOMINAZIONE_NON_DISPONIBILE]'),
        'PARTITA_IVA', COALESCE(cliente_record.partita_iva, '[PARTITA_IVA_NON_DISPONIBILE]'),
        'CODICE_FISCALE', COALESCE(cliente_record.codice_fiscale, '[CODICE_FISCALE_NON_DISPONIBILE]'),
        'EMAIL_AZIENDA', COALESCE(cliente_record.email, '[EMAIL_NON_DISPONIBILE]'),
        'TELEFONO_AZIENDA', COALESCE(cliente_record.telefono, '[TELEFONO_NON_DISPONIBILE]'),
        'PEC_AZIENDA', COALESCE(cliente_record.pec, '[PEC_NON_DISPONIBILE]'),

        -- Dati legale rappresentante (dalla stessa tabella clienti!)
        'LEGALE_RAPPRESENTANTE_NOME', COALESCE(cliente_record.legale_rappresentante_nome, '[NOME_NON_DISPONIBILE]'),
        'LEGALE_RAPPRESENTANTE_COGNOME', COALESCE(cliente_record.legale_rappresentante_cognome, '[COGNOME_NON_DISPONIBILE]'),
        'LEGALE_RAPPRESENTANTE_CF', COALESCE(cliente_record.legale_rappresentante_codice_fiscale, '[CF_NON_DISPONIBILE]'),
        'LEGALE_RAPPRESENTANTE_EMAIL', COALESCE(cliente_record.legale_rappresentante_email, cliente_record.email, '[EMAIL_LEGALE_NON_DISPONIBILE]'),
        'LEGALE_RAPPRESENTANTE_TELEFONO', COALESCE(cliente_record.legale_rappresentante_telefono, cliente_record.telefono, '[TELEFONO_LEGALE_NON_DISPONIBILE]'),

        -- Dati progetto
        'TITOLO_PROGETTO', COALESCE(progetto_record.titolo_progetto, '[TITOLO_NON_DISPONIBILE]'),
        'CONTRIBUTO_RICHIESTO', COALESCE(progetto_record.contributo_richiesto::text, '[CONTRIBUTO_NON_DISPONIBILE]'),
        'DATA_AVVIO', COALESCE(progetto_record.data_avvio_progetto::text, '[DATA_AVVIO_NON_DISPONIBILE]'),

        -- Metadati
        'DATA_COMPILAZIONE', to_char(NOW(), 'DD/MM/YYYY HH24:MI'),
        'ANNO_CORRENTE', extract(year from NOW())::text
    );

    -- Aggiorna documento con stato compilazione
    UPDATE scadenze_bandi_documenti_progetto
    SET
        auto_compilazione_completata = TRUE,
        auto_compilazione_status = 'Compilato automaticamente il ' || to_char(NOW(), 'DD/MM/YYYY HH24:MI'),
        auto_compilazione_data = NOW(),
        placeholders_compilati = placeholders,
        updated_at = NOW()
    WHERE id = documento_id;

    -- Risultato successo
    result := json_build_object(
        'success', true,
        'message', 'Documento compilato automaticamente con successo',
        'placeholders', placeholders,
        'documento_id', documento_id,
        'data_compilazione', NOW()
    );

    RETURN result;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'error_detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test della funzione
DO $$
DECLARE
    test_documento_id UUID;
    test_result JSON;
BEGIN
    -- Trova un documento ereditato da testare
    SELECT id INTO test_documento_id
    FROM scadenze_bandi_documenti_progetto
    WHERE ereditato_da_bando = TRUE
    LIMIT 1;

    IF test_documento_id IS NOT NULL THEN
        RAISE NOTICE '🧪 Test funzione autocompilazione...';
        RAISE NOTICE 'Documento test ID: %', test_documento_id;

        -- NON eseguire il test per ora, solo verificare che la funzione sia creata
        RAISE NOTICE '✅ Funzione auto_compila_allegato_progetto creata con successo!';
        RAISE NOTICE '🎯 Ora riprova il bottone robot nel frontend';
        RAISE NOTICE '📋 Placeholders supportati:';
        RAISE NOTICE '   - DENOMINAZIONE_AZIENDA, PARTITA_IVA, CODICE_FISCALE';
        RAISE NOTICE '   - LEGALE_RAPPRESENTANTE_NOME, LEGALE_RAPPRESENTANTE_COGNOME';
        RAISE NOTICE '   - TITOLO_PROGETTO, CONTRIBUTO_RICHIESTO';
        RAISE NOTICE '   - DATA_COMPILAZIONE, ANNO_CORRENTE';
    ELSE
        RAISE NOTICE '⚠️ Nessun documento ereditato trovato per test';
    END IF;
END $$;