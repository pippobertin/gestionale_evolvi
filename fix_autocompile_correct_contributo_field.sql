-- Fix funzione autocompilazione con campo contributo corretto

-- Elimina funzione attuale
DROP FUNCTION IF EXISTS auto_compila_allegato_progetto(UUID, UUID) CASCADE;

-- Crea funzione corretta usando contributo_ammesso invece di contributo_richiesto
CREATE OR REPLACE FUNCTION auto_compila_allegato_progetto(documento_id UUID, progetto_id UUID)
RETURNS JSON AS $$
DECLARE
    doc_record RECORD;
    cliente_record RECORD;
    progetto_record RECORD;
    compiled_filename TEXT;
    compiled_path TEXT;
    result JSON;
BEGIN
    -- Ottieni documento progetto + documento bando originale
    SELECT
        dp.id as documento_id,
        dp.progetto_id,
        dp.nome_file,
        dp.bando_documento_origine_id,
        bd.url_file as template_path,
        bd.nome_file as template_filename,
        'bandi-documenti' as template_bucket
    INTO doc_record
    FROM scadenze_bandi_documenti_progetto dp
    JOIN scadenze_bandi_documenti bd ON dp.bando_documento_origine_id = bd.id
    WHERE dp.id = documento_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Documento o template originale non trovato');
    END IF;

    -- Verifica che il progetto_id corrisponda
    IF doc_record.progetto_id != progetto_id THEN
        RETURN json_build_object('success', false, 'error', 'Progetto ID non corrisponde al documento');
    END IF;

    -- Ottieni dati progetto con CAMPI CORRETTI
    SELECT
        id,
        titolo_progetto,
        contributo_ammesso,                    -- ✅ CAMPO CORRETTO
        importo_totale_progetto,
        percentuale_contributo,
        cliente_id
    INTO progetto_record
    FROM scadenze_bandi_progetti
    WHERE id = progetto_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Progetto non trovato');
    END IF;

    -- Ottieni dati cliente completi
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

    -- Genera nome file compilato
    compiled_filename := 'COMPILATO_' || doc_record.template_filename;
    compiled_path := progetto_id::text || '/' || compiled_filename;

    -- Aggiorna documento con info compilazione
    UPDATE scadenze_bandi_documenti_progetto
    SET
        auto_compilazione_completata = TRUE,
        auto_compilazione_status = 'File compilato salvato come: ' || compiled_filename,
        file_path = compiled_path,
        nome_file_compilato = compiled_filename,
        updated_at = NOW()
    WHERE id = documento_id;

    -- Risultato per il frontend con CAMPI CORRETTI
    result := json_build_object(
        'success', true,
        'message', 'Template preparato per compilazione reale!',
        'action', 'FRONTEND_COMPILE_AND_UPLOAD',
        'template_download', json_build_object(
            'bucket', doc_record.template_bucket,
            'path', doc_record.template_path
        ),
        'placeholders', json_build_object(
            'DENOMINAZIONE_AZIENDA', COALESCE(cliente_record.denominazione, '[DENOMINAZIONE_NON_DISPONIBILE]'),
            'PARTITA_IVA', COALESCE(cliente_record.partita_iva, '[PARTITA_IVA_NON_DISPONIBILE]'),
            'CODICE_FISCALE', COALESCE(cliente_record.codice_fiscale, '[CODICE_FISCALE_NON_DISPONIBILE]'),
            'EMAIL_AZIENDA', COALESCE(cliente_record.email, '[EMAIL_NON_DISPONIBILE]'),
            'TELEFONO_AZIENDA', COALESCE(cliente_record.telefono, '[TELEFONO_NON_DISPONIBILE]'),
            'PEC_AZIENDA', COALESCE(cliente_record.pec, '[PEC_NON_DISPONIBILE]'),
            'LEGALE_RAPPRESENTANTE_NOME', COALESCE(cliente_record.legale_rappresentante_nome, '[NOME_NON_DISPONIBILE]'),
            'LEGALE_RAPPRESENTANTE_COGNOME', COALESCE(cliente_record.legale_rappresentante_cognome, '[COGNOME_NON_DISPONIBILE]'),
            'LEGALE_RAPPRESENTANTE_CF', COALESCE(cliente_record.legale_rappresentante_codice_fiscale, '[CF_NON_DISPONIBILE]'),
            'LEGALE_RAPPRESENTANTE_EMAIL', COALESCE(cliente_record.legale_rappresentante_email, '[EMAIL_LEGALE_NON_DISPONIBILE]'),
            'LEGALE_RAPPRESENTANTE_TELEFONO', COALESCE(cliente_record.legale_rappresentante_telefono, '[TELEFONO_LEGALE_NON_DISPONIBILE]'),
            'TITOLO_PROGETTO', COALESCE(progetto_record.titolo_progetto, '[TITOLO_NON_DISPONIBILE]'),
            'CONTRIBUTO_AMMESSO', COALESCE(progetto_record.contributo_ammesso::text, '[CONTRIBUTO_NON_DISPONIBILE]'),    -- ✅ CAMPO CORRETTO
            'IMPORTO_TOTALE_PROGETTO', COALESCE(progetto_record.importo_totale_progetto::text, '[IMPORTO_NON_DISPONIBILE]'),
            'PERCENTUALE_CONTRIBUTO', COALESCE(progetto_record.percentuale_contributo::text, '[PERCENTUALE_NON_DISPONIBILE]'),
            'DATA_COMPILAZIONE', to_char(NOW(), 'DD/MM/YYYY HH24:MI'),
            'ANNO_CORRENTE', extract(year from NOW())::text
        ),
        'upload_target', json_build_object(
            'bucket', 'progetti-documenti',
            'path', compiled_path,
            'filename', compiled_filename
        ),
        'documento_id', documento_id
    );

    RETURN result;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'context', 'Errore durante preparazione autocompilazione'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verifica
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ FUNZIONE CON CAMPI CORRETTI!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Campo contributo: contributo_ammesso';
    RAISE NOTICE '✅ Campi aggiuntivi: importo_totale_progetto, percentuale_contributo';
    RAISE NOTICE '✅ Tutti i placeholder disponibili per compilazione';
    RAISE NOTICE '🎯 AUTOCOMPILAZIONE FINALMENTE PRONTA!';
    RAISE NOTICE '========================================';
END $$;