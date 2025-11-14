-- Fix per la vista documenti progetto - corregge nomi colonne
-- Da eseguire dopo add_documenti_progetti_sistema.sql

-- Ricrea la vista con i nomi corretti delle colonne
DROP VIEW IF EXISTS scadenze_bandi_documenti_progetto_view CASCADE;

CREATE OR REPLACE VIEW scadenze_bandi_documenti_progetto_view AS
SELECT
    dp.*,
    -- Info progetto (correzione: titolo_progetto, non nome)
    p.titolo_progetto as progetto_nome,
    p.codice_progetto,
    p.cliente_id,
    p.bando_id,

    -- Info bando origine (se ereditato)
    CASE
        WHEN dp.ereditato_da_bando THEN b.nome
        ELSE NULL
    END as bando_origine_nome,

    -- Info documento bando origine (se ereditato)
    CASE
        WHEN dp.bando_documento_origine_id IS NOT NULL THEN bd.nome_file
        ELSE NULL
    END as file_origine_bando,

    -- Statistiche compilazione
    CASE dp.stato_compilazione
        WHEN 'compilato' THEN '✅ Compilato'
        WHEN 'in_compilazione' THEN '🔄 In corso'
        WHEN 'approvato' THEN '🎯 Approvato'
        ELSE '📝 Da compilare'
    END as stato_display,

    -- Info auto-compilazione
    CASE
        WHEN dp.auto_compilazione_completata THEN '🤖 Auto-compilato'
        WHEN dp.categoria = 'ereditato' AND NOT dp.auto_compilazione_completata THEN '⏳ Pronto per auto-compilazione'
        ELSE NULL
    END as auto_compilazione_status

FROM scadenze_bandi_documenti_progetto dp
LEFT JOIN scadenze_bandi_progetti p ON dp.progetto_id = p.id
LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
LEFT JOIN scadenze_bandi_documenti bd ON dp.bando_documento_origine_id = bd.id
ORDER BY dp.created_at DESC;

DO $$
BEGIN
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'VISTA DOCUMENTI PROGETTO CORRETTA!';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '✅ Corretto: p.titolo_progetto (non p.nome)';
    RAISE NOTICE '✅ Vista scadenze_bandi_documenti_progetto_view ricreata';
    RAISE NOTICE '🎯 Sistema documenti progetti ora operativo!';
    RAISE NOTICE '=========================================';
END $$;