-- Crea tabella per tracciare eventi calendario
CREATE TABLE IF NOT EXISTS scadenze_bandi_calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_id UUID NOT NULL, -- ID della scadenza/progetto
    calendar_event_id TEXT NOT NULL, -- ID evento Google Calendar
    event_type TEXT NOT NULL CHECK (event_type IN ('scadenza', 'progetto_milestone')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_entity ON scadenze_bandi_calendar_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON scadenze_bandi_calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar_id ON scadenze_bandi_calendar_events(calendar_event_id);

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
    RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON scadenze_bandi_calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
    BEFORE UPDATE ON scadenze_bandi_calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_events_updated_at();

-- Verifica struttura creata
SELECT 'Tabella scadenze_bandi_calendar_events creata con successo' as result;