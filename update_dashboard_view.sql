-- Aggiorna la vista dashboard per usare la nuova colonna denominazione
DROP VIEW IF EXISTS scadenze_bandi_dashboard;

CREATE VIEW scadenze_bandi_dashboard AS
SELECT
    s.id,
    s.data_scadenza,
    s.stato,
    s.priorita,
    s.responsabile_email,
    s.note as nota_scadenza,
    ts.nome as tipo_scadenza,
    ts.colore_hex,
    p.nome_progetto,
    b.nome as nome_bando,
    c.denominazione as nome_cliente,
    c.email as email_cliente,
    EXTRACT(DAYS FROM (s.data_scadenza - NOW())) as giorni_rimanenti
FROM scadenze_bandi_scadenze s
JOIN scadenze_bandi_tipologie_scadenze ts ON s.tipologia_scadenza_id = ts.id
JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id
WHERE s.stato != 'completata'
ORDER BY s.data_scadenza ASC;

-- Aggiorna anche la funzione get_scadenze_prossime
CREATE OR REPLACE FUNCTION get_scadenze_prossime(giorni_limite INTEGER DEFAULT 30)
RETURNS TABLE (
    id UUID,
    data_scadenza TIMESTAMP WITH TIME ZONE,
    giorni_rimanenti NUMERIC,
    tipo_scadenza TEXT,
    progetto TEXT,
    bando TEXT,
    cliente TEXT,
    priorita scadenze_bandi_priorita,
    responsabile_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.data_scadenza,
        EXTRACT(DAYS FROM (s.data_scadenza - NOW())) as giorni_rimanenti,
        ts.nome as tipo_scadenza,
        p.nome_progetto as progetto,
        b.nome as bando,
        c.denominazione as cliente,
        s.priorita,
        s.responsabile_email
    FROM scadenze_bandi_scadenze s
    JOIN scadenze_bandi_tipologie_scadenze ts ON s.tipologia_scadenza_id = ts.id
    JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
    JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
    JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id
    WHERE s.stato != 'completata'
    AND s.data_scadenza <= NOW() + INTERVAL '1 day' * giorni_limite
    ORDER BY s.data_scadenza ASC;
END;
$$ LANGUAGE plpgsql;