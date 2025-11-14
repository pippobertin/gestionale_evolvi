-- Verifica dati cliente per progetto con ID visibile nello screenshot

-- 1. Trova il progetto dal nome del documento
SELECT 'PROGETTI TROVATI:' as info;
SELECT
    p.id,
    p.titolo_progetto,
    p.cliente_id,
    c.denominazione as nome_cliente
FROM scadenze_bandi_progetti p
JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id
WHERE p.titolo_progetto ILIKE '%digitale%' OR c.denominazione ILIKE '%blm%'
ORDER BY p.created_at DESC;

-- 2. Dati completi del cliente
SELECT 'DATI CLIENTE COMPLETI:' as info;
SELECT
    c.id,
    c.denominazione,
    c.partita_iva,
    c.codice_fiscale,
    c.email,
    c.telefono,
    c.pec,
    c.legale_rappresentante_nome,
    c.legale_rappresentante_cognome,
    c.legale_rappresentante_codice_fiscale,
    c.legale_rappresentante_email,
    c.legale_rappresentante_telefono
FROM scadenze_bandi_clienti c
JOIN scadenze_bandi_progetti p ON p.cliente_id = c.id
WHERE c.denominazione ILIKE '%blm%'
OR p.titolo_progetto ILIKE '%digitale%'
LIMIT 1;