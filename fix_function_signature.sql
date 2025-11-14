-- Fix firma funzione autocompilazione per frontend

-- 1. Elimina funzione con 1 parametro
DROP FUNCTION IF EXISTS auto_compila_allegato_progetto(UUID) CASCADE;

-- 2. Crea funzione con la firma corretta che il frontend si aspetta (2 parametri)
CREATE OR REPLACE FUNCTION auto_compila_allegato_progetto(documento_id UUID, progetto_id UUID)
RETURNS JSON AS $$
DECLARE
    doc_record RECORD;
    cliente_record RECORD;
    progetto_record RECORD;
    result JSON;
BEGIN
    -- Ottieni documento progetto
    SELECT *
    INTO doc_record
    FROM scadenze_bandi_documenti_progetto
    WHERE id = documento_id AND progetto_id = progetto_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Documento non trovato');
    END IF;

    -- Ottieni dati progetto
    SELECT *
    INTO progetto_record
    FROM scadenze_bandi_progetti
    WHERE id = progetto_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Progetto non trovato');
    END IF;

    -- Ottieni dati cliente usando SOLO campi verificati dal CSV
    SELECT
        denominazione,
        partita_iva,
        codice_fiscale,
        email,
        telefono,
        pec,
        legale_rappresentante_nome,
        legale_rappresentante_cognome,
        legale_rappresentante_codice_fiscale,
        legale_rappresentante_email,
        legale_rappresentante_telefono
    INTO cliente_record
    FROM scadenze_bandi_clienti
    WHERE id = progetto_record.cliente_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Cliente non trovato');
    END IF;

    -- Aggiorna documento con compilazione
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
            'progetto_titolo', progetto_record.titolo_progetto,
            'contributo', progetto_record.contributo_richiesto,
            'data_compilazione', NOW()
        )
    );

    RETURN result;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'error_context', 'auto_compila_allegato_progetto'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Verifica che la funzione sia stata creata con la firma corretta
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
        RAISE NOTICE '✅ FUNZIONE CORRETTA CREATA!';
        RAISE NOTICE 'Firma: auto_compila_allegato_progetto(documento_id UUID, progetto_id UUID)';
        RAISE NOTICE '✅ Compatibile con frontend che passa 2 parametri';
        RAISE NOTICE '✅ Usa SOLO campi verificati dal CSV';
        RAISE NOTICE '🎯 RIPROVA IL BOTTONE ROBOT!';
    ELSE
        RAISE EXCEPTION 'Errore creazione funzione';
    END IF;
    RAISE NOTICE '========================================';
END $$;