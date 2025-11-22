-- Database initialization for notification system

-- Tabella per le impostazioni notifiche utente
CREATE TABLE IF NOT EXISTS scadenze_bandi_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT UNIQUE NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  email_scadenze_1_giorno BOOLEAN DEFAULT true,
  email_scadenze_3_giorni BOOLEAN DEFAULT true,
  email_scadenze_7_giorni BOOLEAN DEFAULT true,
  email_scadenze_15_giorni BOOLEAN DEFAULT true,
  email_digest_settimanale BOOLEAN DEFAULT true,
  email_progetti_assegnati BOOLEAN DEFAULT true,
  calendar_enabled BOOLEAN DEFAULT false,
  calendar_id TEXT,
  calendar_sync_scadenze BOOLEAN DEFAULT true,
  calendar_sync_milestones BOOLEAN DEFAULT true,
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabella coda email
CREATE TABLE IF NOT EXISTS scadenze_bandi_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabella eventi calendar
CREATE TABLE IF NOT EXISTS scadenze_bandi_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT NOT NULL,
  calendar_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('scadenza', 'progetto_milestone', 'meeting')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabella log notifiche inviate
CREATE TABLE IF NOT EXISTS scadenze_bandi_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'calendar', 'push')),
  sent_date DATE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_scadenze_bandi_email_queue_status ON scadenze_bandi_email_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scadenze_bandi_email_queue_priority ON scadenze_bandi_email_queue(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_scadenze_bandi_calendar_events_entity ON scadenze_bandi_calendar_events(entity_id, event_type);
CREATE INDEX IF NOT EXISTS idx_scadenze_bandi_notification_log_entity_type ON scadenze_bandi_notification_log(entity_id, notification_type, sent_date);
CREATE INDEX IF NOT EXISTS idx_scadenze_bandi_notification_settings_email ON scadenze_bandi_notification_settings(user_email);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scadenze_bandi_notification_settings_updated_at
    BEFORE UPDATE ON scadenze_bandi_notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Inserisci impostazioni default per utenti esistenti
INSERT INTO scadenze_bandi_notification_settings (user_email)
SELECT DISTINCT email
FROM scadenze_bandi_clienti
WHERE email IS NOT NULL
ON CONFLICT (user_email) DO NOTHING;

-- Pulizia automatica vecchi log (mantieni solo ultimi 90 giorni)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM scadenze_bandi_notification_log
    WHERE sent_date < CURRENT_DATE - INTERVAL '90 days';

    DELETE FROM scadenze_bandi_email_queue
    WHERE status = 'sent'
    AND sent_at < NOW() - INTERVAL '30 days';
END;
$$ language 'plpgsql';

-- Commenti per documentazione
COMMENT ON TABLE scadenze_bandi_notification_settings IS 'Impostazioni notifiche per ogni utente';
COMMENT ON TABLE scadenze_bandi_email_queue IS 'Coda email per processamento asincrono';
COMMENT ON TABLE scadenze_bandi_calendar_events IS 'Mapping eventi tra sistema e Google Calendar';
COMMENT ON TABLE scadenze_bandi_notification_log IS 'Log notifiche inviate per evitare duplicati';

COMMENT ON COLUMN scadenze_bandi_notification_settings.quiet_hours_start IS 'Inizio orario non disturbare (formato HH:mm)';
COMMENT ON COLUMN scadenze_bandi_notification_settings.quiet_hours_end IS 'Fine orario non disturbare (formato HH:mm)';
COMMENT ON COLUMN scadenze_bandi_email_queue.metadata IS 'Dati aggiuntivi specifici per tipo notifica';
COMMENT ON COLUMN scadenze_bandi_calendar_events.entity_id IS 'ID entità di riferimento (scadenza_id, progetto_id, etc.)';
COMMENT ON COLUMN scadenze_bandi_notification_log.sent_date IS 'Data invio per controllo duplicati giornalieri';