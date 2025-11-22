-- Aggiunge supporto per notifiche 15 giorni prima della scadenza

-- Aggiunge la colonna email_scadenze_15_giorni alla tabella esistente
ALTER TABLE scadenze_bandi_notification_settings
ADD COLUMN IF NOT EXISTS email_scadenze_15_giorni BOOLEAN DEFAULT true;

-- Aggiorna eventuali record esistenti per abilitare le notifiche a 15 giorni
UPDATE scadenze_bandi_notification_settings
SET email_scadenze_15_giorni = true
WHERE email_scadenze_15_giorni IS NULL;