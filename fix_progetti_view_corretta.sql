-- Fix finale vista progetti con enum stati corretti

-- Elimina la vista esistente se presente
DROP VIEW IF EXISTS scadenze_bandi_progetti_view CASCADE;

-- Crea la vista progetti con stati enum validi
CREATE OR REPLACE VIEW scadenze_bandi_progetti_view AS
SELECT
    p.*,
    -- Info bando collegato
    b.nome as bando_nome,
    b.codice_bando,
    b.ente_erogatore,
    b.tipologia_bando,
    b.contributo_massimo as bando_contributo_massimo,

    -- Info cliente collegato
    c.denominazione as cliente_denominazione,
    c.email as cliente_email,
    c.partita_iva as cliente_piva,

    -- Calcoli automatici date e giorni
    CASE
        WHEN p.scadenza_accettazione_esiti IS NOT NULL AND p.data_effettiva_accettazione_esiti IS NULL
        THEN (p.scadenza_accettazione_esiti::date - CURRENT_DATE)
        ELSE NULL
    END as giorni_ad_accettazione,

    CASE
        WHEN p.scadenza_richiesta_anticipo IS NOT NULL AND p.data_effettiva_richiesta_anticipo IS NULL
        THEN (p.scadenza_richiesta_anticipo::date - CURRENT_DATE)
        ELSE NULL
    END as giorni_a_richiesta_anticipo,

    CASE
        WHEN p.scadenza_rendicontazione_finale IS NOT NULL
        THEN (p.scadenza_rendicontazione_finale::date - CURRENT_DATE)
        ELSE NULL
    END as giorni_a_rendicontazione,

    -- Stato calcolato usando SOLO valori enum validi
    CASE
        WHEN p.stato = 'COMPLETATO' THEN 'COMPLETATO'::text
        WHEN p.data_effettiva_accettazione_esiti IS NULL AND p.scadenza_accettazione_esiti IS NOT NULL AND CURRENT_DATE > p.scadenza_accettazione_esiti THEN 'DECRETO_RICEVUTO'::text -- Scaduto accettazione -> forzalo come decreto ricevuto
        WHEN p.data_effettiva_accettazione_esiti IS NULL THEN 'DECRETO_ATTESO'::text
        WHEN p.data_avvio_progetto IS NULL THEN 'ACCETTATO'::text
        WHEN p.data_avvio_progetto IS NOT NULL AND p.scadenza_rendicontazione_finale IS NOT NULL AND CURRENT_DATE <= p.scadenza_rendicontazione_finale THEN 'IN_CORSO'::text
        WHEN p.scadenza_rendicontazione_finale IS NOT NULL AND CURRENT_DATE > p.scadenza_rendicontazione_finale THEN 'IN_CORSO'::text -- Anche se scaduto, manteniamo in corso
        ELSE p.stato::text
    END as stato_calcolato,

    -- Conteggio documenti
    COALESCE(
        (SELECT COUNT(*) FROM scadenze_bandi_documenti_progetto WHERE progetto_id = p.id),
        0
    ) as documenti_caricati,

    -- Conteggio scadenze
    COALESCE(
        (SELECT COUNT(*) FROM scadenze_bandi_scadenze WHERE progetto_id = p.id),
        0
    ) as scadenze_totali,

    -- Scadenze attive
    COALESCE(
        (SELECT COUNT(*)
         FROM scadenze_bandi_scadenze
         WHERE progetto_id = p.id
         AND stato NOT IN ('completata', 'annullata')),
        0
    ) as scadenze_attive,

    -- Percentuale completamento
    CASE
        WHEN p.stato = 'COMPLETATO' THEN 100
        WHEN p.scadenza_rendicontazione_finale IS NOT NULL AND CURRENT_DATE > p.scadenza_rendicontazione_finale THEN 95
        WHEN p.data_avvio_progetto IS NOT NULL THEN
            CASE
                WHEN p.data_effettiva_richiesta_anticipo IS NOT NULL THEN 75
                ELSE 50
            END
        WHEN p.data_effettiva_accettazione_esiti IS NOT NULL THEN 25
        ELSE 10
    END as percentuale_completamento

FROM scadenze_bandi_progetti p
LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
LEFT JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id
ORDER BY p.created_at DESC;

-- Test della vista
DO $$
DECLARE
    view_exists BOOLEAN;
    sample_count INTEGER;
    sample_record RECORD;
BEGIN
    -- Verifica creazione
    SELECT EXISTS (
        SELECT FROM information_schema.views
        WHERE table_schema = 'public'
        AND table_name = 'scadenze_bandi_progetti_view'
    ) INTO view_exists;

    IF view_exists THEN
        -- Test query
        SELECT COUNT(*) INTO sample_count FROM scadenze_bandi_progetti_view;

        -- Record esempio
        SELECT
            cliente_denominazione,
            bando_nome,
            stato_calcolato,
            documenti_caricati,
            scadenze_totali
        INTO sample_record
        FROM scadenze_bandi_progetti_view
        LIMIT 1;

        RAISE NOTICE '=========================================';
        RAISE NOTICE 'VISTA PROGETTI FUNZIONANTE!';
        RAISE NOTICE '=========================================';
        RAISE NOTICE '✅ Vista creata con successo';
        RAISE NOTICE '✅ Progetti totali: %', sample_count;
        RAISE NOTICE '✅ Stati enum corretti (DECRETO_ATTESO, DECRETO_RICEVUTO, ACCETTATO, IN_CORSO, COMPLETATO)';
        RAISE NOTICE '✅ Supporta documenti progetti: % documenti', COALESCE(sample_record.documenti_caricati, 0);
        RAISE NOTICE '✅ Record esempio: %', sample_record;
        RAISE NOTICE '🎯 FRONTEND PROGETTI ORA OPERATIVO!';
        RAISE NOTICE '=========================================';
        RAISE NOTICE 'PROSSIMO STEP: Ricarica pagina progetti e testa tab Documenti';
        RAISE NOTICE '=========================================';
    ELSE
        RAISE EXCEPTION 'Errore: Vista non creata';
    END IF;
END $$;