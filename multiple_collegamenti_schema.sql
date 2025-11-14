-- Schema per supportare multipli collegamenti aziendali
-- Eseguire in ordine su Supabase

-- 1. Creare ENUM per i tipi di collegamento se non esiste già
DO $$ BEGIN
    CREATE TYPE scadenze_bandi_tipo_collegamento AS ENUM ('AUTONOMA', 'COLLEGATA', 'ASSOCIATA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Creare tabella per i collegamenti aziendali multipli
CREATE TABLE scadenze_bandi_collegamenti_aziendali (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    azienda_madre_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
    azienda_collegata_id UUID NOT NULL REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE,
    tipo_collegamento scadenze_bandi_tipo_collegamento NOT NULL DEFAULT 'COLLEGATA',
    percentuale_partecipazione DECIMAL(5,2) CHECK (percentuale_partecipazione >= 0 AND percentuale_partecipazione <= 100),
    diritti_voto DECIMAL(5,2) CHECK (diritti_voto >= 0 AND diritti_voto <= 100),
    influenza_dominante BOOLEAN DEFAULT false,
    note_collegamento TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Vincoli
    CONSTRAINT unique_collegamento_per_azienda UNIQUE (azienda_madre_id, azienda_collegata_id),
    CONSTRAINT no_auto_collegamento CHECK (azienda_madre_id != azienda_collegata_id)
);

-- 3. Creare indici per performance
CREATE INDEX idx_collegamenti_madre ON scadenze_bandi_collegamenti_aziendali(azienda_madre_id);
CREATE INDEX idx_collegamenti_collegata ON scadenze_bandi_collegamenti_aziendali(azienda_collegata_id);

-- 4. Trigger per updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_collegamenti_updated_at
    BEFORE UPDATE ON scadenze_bandi_collegamenti_aziendali
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Funzione per calcolare la dimensione aggregata con collegamenti multipli
CREATE OR REPLACE FUNCTION calcola_dimensione_aggregata(cliente_id UUID)
RETURNS TEXT AS $$
DECLARE
    cliente_record RECORD;
    collegamento_record RECORD;
    ula_total DECIMAL := 0;
    fatturato_total DECIMAL := 0;
    attivo_total DECIMAL := 0;
    azienda_collegata RECORD;
    percentuale DECIMAL;
BEGIN
    -- Ottieni i dati dell'azienda principale
    SELECT ula, ultimo_fatturato, attivo_bilancio
    INTO cliente_record
    FROM scadenze_bandi_clienti
    WHERE id = cliente_id;

    IF NOT FOUND THEN
        RETURN 'NON_TROVATO';
    END IF;

    -- Inizializza con i valori dell'azienda principale
    ula_total := COALESCE(cliente_record.ula, 0);
    fatturato_total := COALESCE(cliente_record.ultimo_fatturato, 0);
    attivo_total := COALESCE(cliente_record.attivo_bilancio, 0);

    -- Aggiungi i valori di tutte le aziende collegate/associate
    FOR collegamento_record IN
        SELECT azienda_collegata_id, tipo_collegamento, percentuale_partecipazione
        FROM scadenze_bandi_collegamenti_aziendali
        WHERE azienda_madre_id = cliente_id
    LOOP
        -- Ottieni i dati dell'azienda collegata
        SELECT ula, ultimo_fatturato, attivo_bilancio
        INTO azienda_collegata
        FROM scadenze_bandi_clienti
        WHERE id = collegamento_record.azienda_collegata_id;

        IF FOUND THEN
            IF collegamento_record.tipo_collegamento = 'COLLEGATA' THEN
                -- Per aziende collegate (25-49.99%): somma proporzionale
                percentuale := COALESCE(collegamento_record.percentuale_partecipazione, 0) / 100.0;
                ula_total := ula_total + (COALESCE(azienda_collegata.ula, 0) * percentuale);
                fatturato_total := fatturato_total + (COALESCE(azienda_collegata.ultimo_fatturato, 0) * percentuale);
                attivo_total := attivo_total + (COALESCE(azienda_collegata.attivo_bilancio, 0) * percentuale);
            ELSIF collegamento_record.tipo_collegamento = 'ASSOCIATA' THEN
                -- Per aziende associate (≥50%): somma il 100%
                ula_total := ula_total + COALESCE(azienda_collegata.ula, 0);
                fatturato_total := fatturato_total + COALESCE(azienda_collegata.ultimo_fatturato, 0);
                attivo_total := attivo_total + COALESCE(azienda_collegata.attivo_bilancio, 0);
            END IF;
        END IF;
    END LOOP;

    -- Applica i criteri UE 2003/361/CE
    IF ula_total < 10 AND (fatturato_total <= 2000000 OR attivo_total <= 2000000) THEN
        RETURN 'MICRO';
    ELSIF ula_total < 50 AND (fatturato_total <= 10000000 OR attivo_total <= 10000000) THEN
        RETURN 'PICCOLA';
    ELSIF ula_total < 250 AND (fatturato_total <= 50000000 OR attivo_total <= 43000000) THEN
        RETURN 'MEDIA';
    ELSE
        RETURN 'GRANDE';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Vista per avere i clienti con dimensione aggregata calcolata
CREATE OR REPLACE VIEW scadenze_bandi_clienti_con_dimensione_aggregata AS
SELECT
    c.*,
    calcola_dimensione_aggregata(c.id) as dimensione_aggregata,
    (
        SELECT COUNT(*)
        FROM scadenze_bandi_collegamenti_aziendali
        WHERE azienda_madre_id = c.id
    ) as numero_collegamenti
FROM scadenze_bandi_clienti c;

-- 7. Migrazione dati esistenti (se ci sono collegamenti nel vecchio formato)
-- Questo script migra i collegamenti esistenti dal formato single alla nuova tabella
INSERT INTO scadenze_bandi_collegamenti_aziendali
    (azienda_madre_id, azienda_collegata_id, tipo_collegamento, percentuale_partecipazione, diritti_voto, influenza_dominante, note_collegamento)
SELECT
    id as azienda_madre_id,
    impresa_collegata_id as azienda_collegata_id,
    COALESCE(tipo_collegamento::scadenze_bandi_tipo_collegamento, 'COLLEGATA') as tipo_collegamento,
    percentuale_partecipazione,
    diritti_voto,
    influenza_dominante,
    note_collegamento
FROM scadenze_bandi_clienti
WHERE impresa_collegata_id IS NOT NULL
ON CONFLICT (azienda_madre_id, azienda_collegata_id) DO NOTHING;

-- 8. Commenti per documentazione
COMMENT ON TABLE scadenze_bandi_collegamenti_aziendali IS
'Tabella per gestire i collegamenti multipli tra aziende secondo la normativa UE 2003/361/CE. Supporta relazioni 1:N tra azienda madre e aziende collegate/associate.';

COMMENT ON COLUMN scadenze_bandi_collegamenti_aziendali.tipo_collegamento IS
'Tipo di collegamento: COLLEGATA (25-49.99%, calcolo proporzionale), ASSOCIATA (≥50%, calcolo 100%), AUTONOMA (non utilizzato in questa tabella)';

COMMENT ON COLUMN scadenze_bandi_collegamenti_aziendali.percentuale_partecipazione IS
'Percentuale di partecipazione nellazienda collegata (0-100%). Utilizzata per il calcolo della dimensione aggregata.';

COMMENT ON FUNCTION calcola_dimensione_aggregata(UUID) IS
'Calcola la dimensione aziendale aggregata considerando tutti i collegamenti secondo UE 2003/361/CE. Restituisce: MICRO, PICCOLA, MEDIA, GRANDE';