-- Verifica struttura tabella clienti per fix vista progetti

-- Mostra le colonne esistenti nella tabella clienti
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'scadenze_bandi_clienti'
    AND table_schema = 'public'
ORDER BY ordinal_position;