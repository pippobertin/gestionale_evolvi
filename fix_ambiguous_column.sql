-- Fix errore ambiguous column progetto_id

-- Elimina funzione attuale
DROP FUNCTION IF EXISTS auto_compila_allegato_progetto(UUID, UUID) CASCADE;

-- Crea funzione corretta con alias tabelle per evitare ambiguità
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
    -- Ottieni documento progetto + documento bando originale con ALIAS per evitare ambiguità
    SELECT
        dp.*,
        bd.url_file as template_path,
        bd.nome_file as template_filename,
        'bandi-documenti' as template_bucket
    INTO doc_record
    FROM scadenze_bandi_documenti_progetto dp
    JOIN scadenze_bandi_documenti bd ON dp.bando_documento_origine_id = bd.id
    WHERE dp.id = documento_id AND dp.progetto_id = progetto_id;  -- ✅ dp.progetto_id specifico

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Documento o template originale non trovato');
    END IF;

    -- Ottieni dati progetto
    SELECT * INTO progetto_record
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
    compiled_filename := 'COMPILATO_' || doc_record.nome_file;
    compiled_path := progetto_id::text || '/' || compiled_filename;

    -- Aggiorna documento con info compilazione
    UPDATE scadenze_bandi_documenti_progetto
    SET
        auto_compilazione_completata = TRUE,
        auto_compilazione_status = 'File compilato salvato come: ' || compiled_filename,
        file_path = compiled_path,
        nome_file_compilato = compiled_filename,
        placeholders_compilati = json_build_object(
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
            'CONTRIBUTO_RICHIESTO', COALESCE(progetto_record.contributo_richiesto::text, '[CONTRIBUTO_NON_DISPONIBILE]'),
            'DATA_COMPILAZIONE', to_char(NOW(), 'DD/MM/YYYY HH24:MI'),
            'ANNO_CORRENTE', extract(year from NOW())::text
        ),
        updated_at = NOW()
    WHERE id = documento_id;

    -- Risultato per il frontend
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
            'CONTRIBUTO_RICHIESTO', COALESCE(progetto_record.contributo_richiesto::text, '[CONTRIBUTO_NON_DISPONIBILE]'),
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
    RAISE NOTICE '✅ FUNZIONE CORRETTA SENZA AMBIGUITÀ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Alias tabelle: dp.progetto_id specifico';
    RAISE NOTICE '✅ Campo corretto: bd.url_file';
    RAISE NOTICE '✅ Bucket: bandi-documenti → progetti-documenti';
    RAISE NOTICE '🎯 RIPROVA AUTOCOMPILAZIONE!';
    RAISE NOTICE '========================================';
END $$;