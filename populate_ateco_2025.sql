-- Popola la tabella scadenze_bandi_ateco_2025 con i dati ATECO 2025 puliti
-- Prima svuota la tabella esistente per evitare duplicati
DELETE FROM scadenze_bandi_ateco_2025;

-- Reset della sequenza per iniziare da 1
ALTER SEQUENCE scadenze_bandi_ateco_2025_id_seq RESTART WITH 1;

-- Popola con i dati dal CSV pulito
-- Nota: Questo script deve essere eseguito dopo aver caricato manualmente
-- i dati del CSV o tramite un processo di import

-- Script per generare gli insert dal CSV Python