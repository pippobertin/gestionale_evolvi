-- Forza ricreo funzione autocompilazione (elimina tutte le versioni)

-- 1. Elimina TUTTE le possibili versioni della funzione
DROP FUNCTION IF EXISTS auto_compila_allegato_progetto(UUID) CASCADE;
DROP FUNCTION IF EXISTS auto_compila_allegato_progetto(TEXT) CASCADE;
DROP FUNCTION IF EXISTS auto_compila_allegato_progetto() CASCADE;

-- 2. Verifica che sia stata eliminata
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.routines
        WHERE routine_name = 'auto_compila_allegato_progetto'
    ) THEN
        RAISE EXCEPTION 'Funzione ancora presente - eliminazione fallita';
    ELSE
        RAISE NOTICE '✅ Funzione eliminata completamente';
    END IF;
END $$;

-- 3. Ricrea la funzione CORRETTA (versione semplificata per test)
CREATE OR REPLACE FUNCTION auto_compila_allegato_progetto(documento_id UUID)
RETURNS JSON AS $$
DECLARE
    doc_record RECORD;
    cliente_record RECORD;
    progetto_record RECORD;
    result JSON;
BEGIN
    -- Ottieni documento progetto
    SELECT dp.*, p.cliente_id, p.titolo_progetto
    INTO doc_record
    FROM scadenze_bandi_documenti_progetto dp
    JOIN scadenze_bandi_progetti p ON dp.progetto_id = p.id
    WHERE dp.id = documento_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Documento non trovato');
    END IF;

    -- Ottieni dati cliente (USANDO SOLO TABELLA CLIENTI ESISTENTE!)
    SELECT *
    INTO cliente_record
    FROM scadenze_bandi_clienti
    WHERE id = doc_record.cliente_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Cliente non trovato');
    END IF;

    -- Aggiorna documento con compilazione
    UPDATE scadenze_bandi_documenti_progetto
    SET
        auto_compilazione_completata = TRUE,
        auto_compilazione_status = format('Compilato: %s - %s (P.IVA: %s)',
            COALESCE(cliente_record.denominazione, 'N/A'),
            COALESCE(cliente_record.legale_rappresentante_nome || ' ' || cliente_record.legale_rappresentante_cognome, 'Legale non disponibile'),
            COALESCE(cliente_record.partita_iva, 'N/A')
        ),
        updated_at = NOW()
    WHERE id = documento_id;

    -- Risultato
    result := json_build_object(
        'success', true,
        'message', 'Documento compilato con successo!',
        'azienda', cliente_record.denominazione,
        'partita_iva', cliente_record.partita_iva,
        'legale_rappresentante', cliente_record.legale_rappresentante_nome || ' ' || cliente_record.legale_rappresentante_cognome
    );

    RETURN result;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Errore: ' || SQLERRM,
        'detail', SQLSTATE
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

    IF function_exists THEN
        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ FUNZIONE AUTOCOMPILAZIONE RICREATA!';
        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ Usa SOLO tabella scadenze_bandi_clienti';
        RAISE NOTICE '✅ NON cerca più tabelle inesistenti';
        RAISE NOTICE '✅ Compila con dati BLM Project disponibili';
        RAISE NOTICE '🎯 RIPROVA IL BOTTONE ROBOT NEL FRONTEND!';
        RAISE NOTICE '========================================';
    ELSE
        RAISE EXCEPTION 'Funzione non creata correttamente';
    END IF;
END $$;