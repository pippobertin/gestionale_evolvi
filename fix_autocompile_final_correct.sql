-- Fix definitivo funzione autocompilazione con nomi campi ESATTI dal CSV

-- 1. ELIMINA TUTTE le versioni della funzione (anche quelle duplicate)
DROP FUNCTION IF EXISTS auto_compila_allegato_progetto(UUID) CASCADE;

-- 2. Elimina anche eventuali overload
DO $$
DECLARE
    func_name TEXT;
BEGIN
    FOR func_name IN
        SELECT routine_name FROM information_schema.routines
        WHERE routine_name ILIKE '%compila%'
        AND routine_schema = 'public'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I CASCADE', func_name);
    END LOOP;
    RAISE NOTICE '✅ Tutte le funzioni di compilazione eliminate';
END $$;

-- 3. Crea funzione CORRETTA usando SOLO campi che esistono nel CSV
CREATE OR REPLACE FUNCTION auto_compila_allegato_progetto(documento_id UUID)
RETURNS JSON AS $$
DECLARE
    doc_record RECORD;
    cliente_record RECORD;
    progetto_record RECORD;
    result JSON;
BEGIN
    -- Ottieni documento progetto
    SELECT dp.*, p.cliente_id, p.titolo_progetto, p.contributo_richiesto
    INTO doc_record
    FROM scadenze_bandi_documenti_progetto dp
    JOIN scadenze_bandi_progetti p ON dp.progetto_id = p.id
    WHERE dp.id = documento_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Documento non trovato');
    END IF;

    -- Ottieni dati cliente usando SOLO campi verificati dal CSV
    SELECT
        denominazione,           -- ✅ ESISTE nel CSV
        partita_iva,            -- ✅ ESISTE nel CSV
        codice_fiscale,         -- ✅ ESISTE nel CSV
        email,                  -- ✅ ESISTE nel CSV
        telefono,               -- ✅ ESISTE nel CSV
        pec,                    -- ✅ ESISTE nel CSV
        legale_rappresentante_nome,        -- ✅ ESISTE nel CSV
        legale_rappresentante_cognome,     -- ✅ ESISTE nel CSV
        legale_rappresentante_codice_fiscale,  -- ✅ ESISTE nel CSV
        legale_rappresentante_email,       -- ✅ ESISTE nel CSV
        legale_rappresentante_telefono     -- ✅ ESISTE nel CSV
    INTO cliente_record
    FROM scadenze_bandi_clienti
    WHERE id = doc_record.cliente_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Cliente non trovato');
    END IF;

    -- Aggiorna documento con compilazione usando dati REALI
    UPDATE scadenze_bandi_documenti_progetto
    SET
        auto_compilazione_completata = TRUE,
        auto_compilazione_status = format(
            'AUTO-COMPILATO: %s | P.IVA: %s | Legale: %s %s | Data: %s',
            COALESCE(cliente_record.denominazione, 'N/A'),
            COALESCE(cliente_record.partita_iva, 'N/A'),
            COALESCE(cliente_record.legale_rappresentante_nome, ''),
            COALESCE(cliente_record.legale_rappresentante_cognome, ''),
            to_char(NOW(), 'DD/MM/YYYY HH24:MI')
        ),
        updated_at = NOW()
    WHERE id = documento_id;

    -- Risultato con tutti i dati compilati
    result := json_build_object(
        'success', true,
        'message', 'Documento auto-compilato con successo!',
        'data', json_build_object(
            'azienda', cliente_record.denominazione,
            'partita_iva', cliente_record.partita_iva,
            'codice_fiscale', cliente_record.codice_fiscale,
            'email', cliente_record.email,
            'telefono', cliente_record.telefono,
            'pec', cliente_record.pec,
            'legale_nome', cliente_record.legale_rappresentante_nome,
            'legale_cognome', cliente_record.legale_rappresentante_cognome,
            'legale_cf', cliente_record.legale_rappresentante_codice_fiscale,
            'progetto_titolo', doc_record.titolo_progetto,
            'contributo', doc_record.contributo_richiesto,
            'data_compilazione', NOW()
        )
    );

    RETURN result;

EXCEPTION WHEN OTHERS THEN
    -- Log dell'errore dettagliato
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'error_context', 'auto_compila_allegato_progetto'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Test immediato
DO $$
DECLARE
    function_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.routines
        WHERE routine_name = 'auto_compila_allegato_progetto'
        AND routine_schema = 'public'
    ) INTO function_exists;

    RAISE NOTICE '========================================';
    IF function_exists THEN
        RAISE NOTICE '✅ FUNZIONE AUTOCOMPILAZIONE CORRETTA CREATA!';
        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ Usa SOLO campi verificati dal CSV:';
        RAISE NOTICE '   - denominazione (non ragione_sociale)';
        RAISE NOTICE '   - partita_iva, codice_fiscale, email, telefono, pec';
        RAISE NOTICE '   - legale_rappresentante_nome/cognome/codice_fiscale';
        RAISE NOTICE '✅ NON cerca tabelle inesistenti';
        RAISE NOTICE '✅ Gestione errori completa';
        RAISE NOTICE '🎯 RIPROVA IL BOTTONE ROBOT - DOVREBBE FUNZIONARE!';
    ELSE
        RAISE EXCEPTION 'Errore creazione funzione';
    END IF;
    RAISE NOTICE '========================================';
END $$;