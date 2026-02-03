-- Aggiungi campo per tracciare utenti che devono cambiare password al primo accesso
ALTER TABLE scadenze_bandi_utenti
ADD COLUMN IF NOT EXISTS first_login_password_change BOOLEAN DEFAULT false;

-- Commento per documentazione
COMMENT ON COLUMN scadenze_bandi_utenti.first_login_password_change IS 'True se l''utente deve cambiare la password al primo accesso (password temporanea)';

-- Verifica struttura aggiornata
SELECT 'Campo first_login_password_change aggiunto con successo alla tabella scadenze_bandi_utenti' as result;