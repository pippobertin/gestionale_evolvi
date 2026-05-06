-- Verifica il constraint sulla categoria di documenti_progetto
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'scadenze_bandi_documenti_progetto'
  AND con.conname LIKE '%categoria%';

-- Mostra anche esempi di categorie già esistenti
SELECT DISTINCT categoria
FROM scadenze_bandi_documenti_progetto
ORDER BY categoria;
