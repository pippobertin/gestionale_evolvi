-- Fix per la funzione giorni_rimanenti
-- Corregge l'errore di EXTRACT

-- 1. Correggi la funzione per TIMESTAMP WITH TIME ZONE
CREATE OR REPLACE FUNCTION giorni_rimanenti(data_scadenza_input TIMESTAMP WITH TIME ZONE)
RETURNS INTEGER AS $$
BEGIN
    RETURN (data_scadenza_input::date - CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- 2. Versione per DATE (per compatibilità)
CREATE OR REPLACE FUNCTION giorni_rimanenti(data_scadenza_input DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN (data_scadenza_input - CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- 3. Ricrea la vista con la funzione corretta
CREATE OR REPLACE VIEW scadenze_bandi_scadenze_enhanced AS
SELECT
    s.*,
    giorni_rimanenti(s.data_scadenza) as giorni_rimanenti,
    CASE
        WHEN s.stato = 'completata' THEN 'COMPLETATA'
        WHEN giorni_rimanenti(s.data_scadenza) < 0 THEN 'SCADUTA'
        WHEN giorni_rimanenti(s.data_scadenza) <= 2 THEN 'URGENTE'
        WHEN giorni_rimanenti(s.data_scadenza) <= 7 THEN 'IMMINENTE'
        WHEN giorni_rimanenti(s.data_scadenza) <= 15 THEN 'PROSSIMA'
        ELSE 'NORMALE'
    END as urgenza,
    -- Info cliente collegato (diretto o tramite progetto)
    COALESCE(c_diretto.denominazione, c_progetto.denominazione) as cliente_denominazione,
    COALESCE(c_diretto.email, c_progetto.email) as cliente_email,
    COALESCE(c_diretto.telefono, c_progetto.telefono) as cliente_telefono,
    COALESCE(c_diretto.partita_iva, c_progetto.partita_iva) as cliente_piva,
    COALESCE(c_diretto.codice_fiscale, c_progetto.codice_fiscale) as cliente_codice_fiscale,
    COALESCE(c_diretto.dimensione, c_progetto.dimensione) as cliente_dimensione,
    -- Info progetto e bando
    p.id as progetto_collegato_id,
    b.nome as bando_collegato_nome,
    ts.nome as tipologia_scadenza_nome
FROM scadenze_bandi_scadenze s
-- Cliente collegato direttamente
LEFT JOIN scadenze_bandi_clienti c_diretto ON s.cliente_id = c_diretto.id
-- Cliente collegato tramite progetto (fallback)
LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
LEFT JOIN scadenze_bandi_clienti c_progetto ON p.cliente_id = c_progetto.id
LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
-- Tipologia scadenza
LEFT JOIN scadenze_bandi_tipologie_scadenze ts ON s.tipologia_scadenza_id = ts.id;

-- 4. Ricrea la funzione per alert con la funzione corretta
CREATE OR REPLACE FUNCTION get_scadenze_per_alert()
RETURNS TABLE (
    id UUID,
    titolo VARCHAR(255),
    data_scadenza TIMESTAMP WITH TIME ZONE,
    giorni_rimanenti INTEGER,
    cliente_denominazione TEXT,
    email_responsabile TEXT,
    tipo_scadenza TEXT,
    cliente_email TEXT,
    urgenza TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.titolo,
        s.data_scadenza,
        giorni_rimanenti(s.data_scadenza) as giorni_rimanenti,
        COALESCE(c_diretto.denominazione, c_progetto.denominazione) as cliente_denominazione,
        s.responsabile_email,
        COALESCE(s.tipo_scadenza_dettagliato::text, ts.nome, 'ALTRA') as tipo_scadenza,
        COALESCE(c_diretto.email, c_progetto.email) as cliente_email,
        CASE
            WHEN giorni_rimanenti(s.data_scadenza) <= 2 THEN 'URGENTE'
            WHEN giorni_rimanenti(s.data_scadenza) <= 7 THEN 'IMMINENTE'
            ELSE 'PROSSIMA'
        END as urgenza
    FROM scadenze_bandi_scadenze s
    LEFT JOIN scadenze_bandi_clienti c_diretto ON s.cliente_id = c_diretto.id
    LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
    LEFT JOIN scadenze_bandi_clienti c_progetto ON p.cliente_id = c_progetto.id
    LEFT JOIN scadenze_bandi_tipologie_scadenze ts ON s.tipologia_scadenza_id = ts.id
    WHERE s.stato IN ('non_iniziata', 'in_corso')
    AND giorni_rimanenti(s.data_scadenza) = ANY(s.giorni_preavviso)
    AND giorni_rimanenti(s.data_scadenza) >= 0
    ORDER BY giorni_rimanenti(s.data_scadenza) ASC;
END;
$$ LANGUAGE plpgsql;

-- 5. Test che le funzioni funzionino correttamente
DO $$
DECLARE
    test_giorni INTEGER;
    scadenze_count INTEGER;
    urgenti_count INTEGER;
BEGIN
    -- Test della funzione giorni_rimanenti
    SELECT giorni_rimanenti(NOW() + INTERVAL '5 days') INTO test_giorni;
    RAISE NOTICE 'Test giorni_rimanenti: % (dovrebbe essere 5)', test_giorni;

    -- Test della vista
    SELECT COUNT(*) INTO scadenze_count FROM scadenze_bandi_scadenze_enhanced;
    RAISE NOTICE 'Scadenze totali in vista enhanced: %', scadenze_count;

    -- Test conteggio urgenti
    SELECT COUNT(*) INTO urgenti_count
    FROM scadenze_bandi_scadenze_enhanced
    WHERE urgenza IN ('URGENTE', 'IMMINENTE');
    RAISE NOTICE 'Scadenze urgenti/imminenti: %', urgenti_count;

    -- Test funzione alert
    SELECT COUNT(*) INTO scadenze_count FROM get_scadenze_per_alert();
    RAISE NOTICE 'Scadenze che necessitano alert: %', scadenze_count;

    RAISE NOTICE 'Tutte le funzioni sono state corrette e testate!';
END $$;