-- Verifica l'esistenza e struttura della vista progetti

-- 1. Verifica se la vista esiste
SELECT EXISTS (
   SELECT FROM information_schema.views
   WHERE  table_schema = 'public'
   AND    table_name   = 'scadenze_bandi_progetti_view'
);

-- 2. Se la vista esiste, mostra le sue colonne
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'scadenze_bandi_progetti_view'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Se la vista non esiste o è rotta, prova una query diretta sulla tabella
SELECT
    COUNT(*) as total_progetti,
    array_agg(DISTINCT stato) as stati_presenti
FROM scadenze_bandi_progetti
LIMIT 1;