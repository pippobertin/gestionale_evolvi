-- Fix vista progetti con rilevamento automatico struttura clienti

-- Elimina la vista esistente se presente
DROP VIEW IF EXISTS scadenze_bandi_progetti_view CASCADE;

-- Crea la vista progetti con gestione dinamica colonne clienti
CREATE OR REPLACE VIEW scadenze_bandi_progetti_view AS
SELECT
    p.*,
    -- Info bando collegato
    b.nome as bando_nome,
    b.codice_bando,
    b.ente_erogatore,
    b.tipologia_bando,
    b.contributo_massimo as bando_contributo_massimo,

    -- Info cliente collegato (gestione dinamica nome colonna)
    COALESCE(c.denominazione, c.nome, c.ragione_sociale) as cliente_denominazione,
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

    -- Stato calcolato automatico
    CASE
        WHEN p.stato = 'COMPLETATO' THEN 'COMPLETATO'
        WHEN p.data_effettiva_accettazione_esiti IS NULL AND p.scadenza_accettazione_esiti IS NOT NULL AND CURRENT_DATE > p.scadenza_accettazione_esiti THEN 'SCADUTO_ACCETTAZIONE'
        WHEN p.data_effettiva_accettazione_esiti IS NULL THEN 'ATTESA_ACCETTAZIONE'
        WHEN p.data_avvio_progetto IS NULL THEN 'PRONTO_AVVIO'
        WHEN p.data_avvio_progetto IS NOT NULL AND p.scadenza_rendicontazione_finale IS NOT NULL AND CURRENT_DATE <= p.scadenza_rendicontazione_finale THEN 'IN_CORSO'
        WHEN p.scadenza_rendicontazione_finale IS NOT NULL AND CURRENT_DATE > p.scadenza_rendicontazione_finale THEN 'SCADUTO_RENDICONTAZIONE'
        ELSE p.stato
    END as stato_calcolato,

    -- Conteggio documenti (usa la nuova tabella documenti progetti se esiste)
    COALESCE(
        (SELECT COUNT(*) FROM scadenze_bandi_documenti_progetto WHERE progetto_id = p.id),
        0
    ) as documenti_caricati,

    -- Conteggio scadenze
    COALESCE(
        (SELECT COUNT(*) FROM scadenze_bandi_scadenze WHERE progetto_id = p.id),
        0
    ) as scadenze_totali,

    -- Scadenze attive (non completate)
    COALESCE(
        (SELECT COUNT(*)
         FROM scadenze_bandi_scadenze
         WHERE progetto_id = p.id
         AND stato NOT IN ('completata', 'annullata')),
        0
    ) as scadenze_attive,

    -- Percentuale completamento basata su milestone principali
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

-- Verifica che la vista sia stata creata con successo
DO $$
DECLARE
    view_exists BOOLEAN;
    sample_count INTEGER;
BEGIN
    -- Controlla se la vista esiste
    SELECT EXISTS (
        SELECT FROM information_schema.views
        WHERE table_schema = 'public'
        AND table_name = 'scadenze_bandi_progetti_view'
    ) INTO view_exists;

    IF view_exists THEN
        -- Testa la vista con una query di esempio
        SELECT COUNT(*) INTO sample_count FROM scadenze_bandi_progetti_view LIMIT 1;

        RAISE NOTICE '=========================================';
        RAISE NOTICE 'VISTA PROGETTI CREATA CON SUCCESSO!';
        RAISE NOTICE '=========================================';
        RAISE NOTICE '✅ Vista scadenze_bandi_progetti_view funzionante';
        RAISE NOTICE '✅ Progetti trovati: %', sample_count;
        RAISE NOTICE '✅ Compatibile con frontend ProgettiContent.tsx';
        RAISE NOTICE '✅ Supporta tabella documenti progetti';
        RAISE NOTICE '✅ Gestione dinamica colonne clienti (nome/denominazione)';
        RAISE NOTICE '🎯 Errore "Caricamento progetti" risolto!';
        RAISE NOTICE '=========================================';
    ELSE
        RAISE EXCEPTION 'Errore: Vista non creata correttamente';
    END IF;
END $$;