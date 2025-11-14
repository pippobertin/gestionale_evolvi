-- Analisi sicura tabelle clienti (senza campi che potrebbero non esistere)

-- 1. Lista tabelle clienti
SELECT 'TABELLE CLIENTI:' as info;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'scadenze_bandi_%client%';

-- 2. Struttura tabella clienti principale
SELECT 'STRUTTURA scadenze_bandi_clienti:' as info;
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'scadenze_bandi_clienti'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Record di esempio per vedere i dati disponibili
SELECT 'DATI CLIENTE BLM:' as info;
SELECT *
FROM scadenze_bandi_clienti
WHERE denominazione ILIKE '%blm%'
LIMIT 1;

-- 4. Conta record in tabella principale
SELECT 'CONTEGGIO RECORD:' as info;
SELECT COUNT(*) as total_clienti
FROM scadenze_bandi_clienti;

-- 5. Verifica foreign key progetti->clienti
SELECT 'COLLEGAMENTO PROGETTI:' as info;
SELECT
    tc.table_name as tabella_progetti,
    kcu.column_name as colonna_progetto,
    ccu.table_name as tabella_clienti_riferita
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name = 'scadenze_bandi_progetti'
AND kcu.column_name = 'cliente_id';