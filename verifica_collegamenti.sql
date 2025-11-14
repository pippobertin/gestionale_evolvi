-- Verifica completa collegamenti e consistenza dati
-- Test per assicurarsi che tutte le relazioni siano corrette

-- 1. Verifica clienti
SELECT 'CLIENTI' as tabella, COUNT(*) as totale FROM scadenze_bandi_clienti;

-- 2. Verifica bandi
SELECT 'BANDI' as tabella, COUNT(*) as totale FROM scadenze_bandi_bandi;

-- 3. Verifica progetti
SELECT 'PROGETTI' as tabella, COUNT(*) as totale FROM scadenze_bandi_progetti;

-- 4. Verifica scadenze
SELECT 'SCADENZE' as tabella, COUNT(*) as totale FROM scadenze_bandi_scadenze;

-- 5. Test collegamento Bando -> Progetto
SELECT
    'BANDO->PROGETTO' as relazione,
    b.nome as bando_nome,
    p.titolo_progetto as progetto_titolo,
    p.stato as progetto_stato
FROM scadenze_bandi_bandi b
JOIN scadenze_bandi_progetti p ON b.id = p.bando_id;

-- 6. Test collegamento Progetto -> Scadenze
SELECT
    'PROGETTO->SCADENZE' as relazione,
    p.titolo_progetto,
    s.titolo as scadenza_titolo,
    s.data_scadenza,
    s.priorita,
    s.stato as scadenza_stato
FROM scadenze_bandi_progetti p
LEFT JOIN scadenze_bandi_scadenze s ON p.id = s.progetto_id
ORDER BY s.data_scadenza;

-- 7. Test vista progetti completa
SELECT
    'VISTA_PROGETTI' as test,
    codice_progetto,
    titolo_progetto,
    bando_nome,
    cliente_denominazione,
    stato_calcolato,
    percentuale_completamento,
    scadenze_totali
FROM scadenze_bandi_progetti_view;

-- 8. Test vista scadenze enhanced
SELECT
    'VISTA_SCADENZE' as test,
    titolo,
    data_scadenza,
    giorni_rimanenti,
    urgenza,
    titolo_progetto,
    cliente_denominazione
FROM scadenze_enhanced_simple
ORDER BY giorni_rimanenti ASC;

-- 9. Verifica foreign key integrity
SELECT
    'FK_INTEGRITY' as test,
    'Progetti senza bando' as problema,
    COUNT(*) as count
FROM scadenze_bandi_progetti p
LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
WHERE b.id IS NULL

UNION ALL

SELECT
    'FK_INTEGRITY' as test,
    'Progetti senza cliente' as problema,
    COUNT(*) as count
FROM scadenze_bandi_progetti p
LEFT JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id
WHERE c.id IS NULL

UNION ALL

SELECT
    'FK_INTEGRITY' as test,
    'Scadenze senza progetto' as problema,
    COUNT(*) as count
FROM scadenze_bandi_scadenze s
LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
WHERE s.progetto_id IS NOT NULL AND p.id IS NULL;

-- 10. Statistiche generali per dashboard
SELECT
    'DASHBOARD_STATS' as tipo,
    'Progetti attivi' as metrica,
    COUNT(*) as valore
FROM scadenze_bandi_progetti
WHERE stato IN ('IN_CORSO', 'ACCETTATO', 'DECRETO_RICEVUTO')

UNION ALL

SELECT
    'DASHBOARD_STATS' as tipo,
    'Scadenze urgenti' as metrica,
    COUNT(*) as valore
FROM scadenze_enhanced_simple
WHERE urgenza = 'URGENTE'

UNION ALL

SELECT
    'DASHBOARD_STATS' as tipo,
    'Bandi aperti' as metrica,
    COUNT(*) as valore
FROM scadenze_bandi_bandi
WHERE stato_bando = 'APERTO';

-- 11. Test funzione creazione scadenze
SELECT
    'FUNZIONE_TEST' as tipo,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_name = 'crea_scadenze_progetto';

-- MESSAGGIO FINALE
DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'VERIFICA COMPLETA SISTEMA ESEGUITA';
    RAISE NOTICE 'Controllare i risultati sopra per:';
    RAISE NOTICE '- Conteggi tabelle principali';
    RAISE NOTICE '- Integrità foreign key (deve essere 0)';
    RAISE NOTICE '- Collegamenti bandi->progetti->scadenze';
    RAISE NOTICE '- Funzionamento viste ottimizzate';
    RAISE NOTICE '====================================';
END $$;