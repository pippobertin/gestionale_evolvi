-- Script per aggiornare email e password dell'utente admin
--
-- ISTRUZIONI:
-- 1. Sostituisci 'nuova-email@evolvi.it' con la tua email desiderata
-- 2. Sostituisci 'nuova-password-sicura' con la tua password desiderata
-- 3. Esegui questo script nel tuo database
--
-- La password viene hashata automaticamente con bcrypt

-- Aggiorna email e password dell'admin
UPDATE scadenze_bandi_utenti
SET
    email = 'admin@evolvi.it',  -- ⬅️ CAMBIA QUESTA EMAIL
    password_hash = crypt('admin123', gen_salt('bf', 10)),  -- ⬅️ CAMBIA QUESTA PASSWORD
    updated_at = NOW()
WHERE livello_permessi = 'admin'
AND email = 'admin@evolvi.it';  -- Email attuale dell'admin

-- Verifica che l'aggiornamento sia andato a buon fine
SELECT
    id,
    email,
    nome,
    cognome,
    livello_permessi,
    attivo,
    created_at,
    updated_at
FROM scadenze_bandi_utenti
WHERE livello_permessi = 'admin';

-- Note:
-- - La funzione crypt() utilizza bcrypt per hashare la password in modo sicuro
-- - gen_salt('bf', 10) genera un salt bcrypt con 10 rounds (sicuro ma veloce)
-- - Se preferisci usare un hash già generato, sostituisci con:
--   password_hash = '$2b$10$TUO_HASH_BCRYPT_QUI'