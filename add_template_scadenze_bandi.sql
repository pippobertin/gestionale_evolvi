-- Aggiunge sistema di template scadenze per i bandi

-- 1. Tabella per template scadenze nei bandi
CREATE TABLE IF NOT EXISTS scadenze_bandi_template_scadenze (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bando_id UUID REFERENCES scadenze_bandi_bandi(id) ON DELETE CASCADE,
    nome TEXT NOT NULL, -- "Accettazione Esiti", "Avvio Progetto", "1° SAL", etc.
    descrizione TEXT,

    -- Logica temporale
    giorni_da_evento INTEGER NOT NULL, -- es. 30 giorni, 90 giorni
    evento_riferimento TEXT NOT NULL, -- "pubblicazione_decreto", "accettazione_esiti", "avvio_progetto", "data_presentazione"

    -- Classificazione
    tipo_scadenza TEXT NOT NULL, -- "accettazione", "avvio", "sal", "rendicontazione", "comunicazione"
    priorita TEXT DEFAULT 'media' CHECK (priorita IN ('bassa', 'media', 'alta', 'critica')),
    obbligatoria BOOLEAN DEFAULT true,

    -- Sequenza e dipendenze
    ordine_sequenza INTEGER DEFAULT 1, -- Per ordinare le scadenze
    dipende_da_template_id UUID REFERENCES scadenze_bandi_template_scadenze(id), -- Scadenza dipendente da un'altra

    -- Metadati
    responsabile_suggerito TEXT,
    note_template TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Indici per performance
CREATE INDEX IF NOT EXISTS idx_template_scadenze_bando ON scadenze_bandi_template_scadenze(bando_id);
CREATE INDEX IF NOT EXISTS idx_template_scadenze_tipo ON scadenze_bandi_template_scadenze(tipo_scadenza);
CREATE INDEX IF NOT EXISTS idx_template_scadenze_evento ON scadenze_bandi_template_scadenze(evento_riferimento);

-- 3. Trigger per updated_at
CREATE OR REPLACE FUNCTION update_template_scadenze_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_scadenze_updated_at
    BEFORE UPDATE ON scadenze_bandi_template_scadenze
    FOR EACH ROW
    EXECUTE FUNCTION update_template_scadenze_updated_at();

-- 4. Vista per template scadenze con info bando
CREATE OR REPLACE VIEW scadenze_bandi_template_view AS
SELECT
    ts.*,
    b.nome as bando_nome,
    b.codice_bando,
    b.tipologia_bando,
    -- Informazioni dipendenza
    dep.nome as dipende_da_nome,
    dep.tipo_scadenza as dipende_da_tipo
FROM scadenze_bandi_template_scadenze ts
LEFT JOIN scadenze_bandi_bandi b ON ts.bando_id = b.id
LEFT JOIN scadenze_bandi_template_scadenze dep ON ts.dipende_da_template_id = dep.id
ORDER BY ts.ordine_sequenza, ts.giorni_da_evento;

-- 5. Crea alcuni template di esempio per diversi tipi di bando
DO $$
DECLARE
    bando_innovazione_id UUID;
    template_accettazione_id UUID;
    template_avvio_id UUID;
    template_sal1_id UUID;
BEGIN
    -- Trova un bando di esempio (o crea se non esiste)
    SELECT id INTO bando_innovazione_id
    FROM scadenze_bandi_bandi
    WHERE tipologia_bando = 'Innovazione' OR nome LIKE '%Innovazione%'
    LIMIT 1;

    -- Se non c'è un bando, usa il primo disponibile
    IF bando_innovazione_id IS NULL THEN
        SELECT id INTO bando_innovazione_id
        FROM scadenze_bandi_bandi
        LIMIT 1;
    END IF;

    -- Solo se abbiamo un bando disponibile
    IF bando_innovazione_id IS NOT NULL THEN

        -- Template Accettazione Esiti (primo nella catena)
        INSERT INTO scadenze_bandi_template_scadenze (
            bando_id, nome, descrizione, giorni_da_evento, evento_riferimento,
            tipo_scadenza, priorita, obbligatoria, ordine_sequenza,
            responsabile_suggerito, note_template
        ) VALUES (
            bando_innovazione_id,
            'Accettazione Esiti',
            'Accettazione formale degli esiti del bando e firma del decreto',
            30, -- 30 giorni
            'pubblicazione_graduatoria',
            'accettazione',
            'critica',
            true,
            1,
            'amministrazione@blmproject.it',
            'Scadenza critica per non perdere il finanziamento'
        ) RETURNING id INTO template_accettazione_id;

        -- Template Avvio Progetto (dipende da accettazione)
        INSERT INTO scadenze_bandi_template_scadenze (
            bando_id, nome, descrizione, giorni_da_evento, evento_riferimento,
            tipo_scadenza, priorita, obbligatoria, ordine_sequenza,
            dipende_da_template_id, responsabile_suggerito, note_template
        ) VALUES (
            bando_innovazione_id,
            'Avvio Progetto',
            'Comunicazione ufficiale di avvio del progetto',
            60, -- 60 giorni
            'accettazione_esiti',
            'avvio',
            'alta',
            true,
            2,
            template_accettazione_id,
            'progetti@blmproject.it',
            'Invio della comunicazione di avvio attività'
        ) RETURNING id INTO template_avvio_id;

        -- Template Primo SAL (dipende da avvio)
        INSERT INTO scadenze_bandi_template_scadenze (
            bando_id, nome, descrizione, giorni_da_evento, evento_riferimento,
            tipo_scadenza, priorita, obbligatoria, ordine_sequenza,
            dipende_da_template_id, responsabile_suggerito, note_template
        ) VALUES (
            bando_innovazione_id,
            'Primo SAL',
            'Rendicontazione del primo Stato Avanzamento Lavori',
            180, -- 6 mesi
            'avvio_progetto',
            'sal',
            'alta',
            true,
            3,
            template_avvio_id,
            'rendicontazione@blmproject.it',
            'Prima rendicontazione del 50% del progetto'
        ) RETURNING id INTO template_sal1_id;

        -- Template Secondo SAL / Saldo
        INSERT INTO scadenze_bandi_template_scadenze (
            bando_id, nome, descrizione, giorni_da_evento, evento_riferimento,
            tipo_scadenza, priorita, obbligatoria, ordine_sequenza,
            dipende_da_template_id, responsabile_suggerito, note_template
        ) VALUES (
            bando_innovazione_id,
            'Saldo Finale',
            'Rendicontazione finale e richiesta saldo',
            365, -- 12 mesi
            'avvio_progetto',
            'saldo',
            'critica',
            true,
            4,
            template_sal1_id,
            'rendicontazione@blmproject.it',
            'Rendicontazione finale del 100% del progetto'
        );

        -- Template Rendicontazione Post-Progetto
        INSERT INTO scadenze_bandi_template_scadenze (
            bando_id, nome, descrizione, giorni_da_evento, evento_riferimento,
            tipo_scadenza, priorita, obbligatoria, ordine_sequenza,
            responsabile_suggerito, note_template
        ) VALUES (
            bando_innovazione_id,
            'Rendicontazione Post-Conclusione',
            'Documentazione finale e chiusura amministrativa',
            30, -- 30 giorni
            'conclusione_progetto',
            'rendicontazione',
            'media',
            false,
            5,
            'amministrazione@blmproject.it',
            'Chiusura amministrativa e archiviazione documenti'
        );

        RAISE NOTICE 'Template scadenze creati per bando ID: %', bando_innovazione_id;
    ELSE
        RAISE NOTICE 'Nessun bando disponibile per creare template di esempio';
    END IF;
END $$;

-- 6. Tabella per documenti allegati ai bandi
CREATE TABLE IF NOT EXISTS scadenze_bandi_documenti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bando_id UUID REFERENCES scadenze_bandi_bandi(id) ON DELETE CASCADE,
    nome_file TEXT NOT NULL,
    nome_originale TEXT, -- Nome del file originale
    tipo_documento TEXT, -- "bando", "modulistica", "decreto", "allegato"
    formato_file TEXT, -- "pdf", "doc", "xls", etc.
    dimensione_bytes BIGINT,
    url_file TEXT, -- Path o URL del file
    descrizione TEXT,

    -- Metadati
    caricato_da TEXT,
    versione INTEGER DEFAULT 1,
    pubblico BOOLEAN DEFAULT false, -- Se visibile ai clienti

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Indici per documenti
CREATE INDEX IF NOT EXISTS idx_documenti_bando ON scadenze_bandi_documenti(bando_id);
CREATE INDEX IF NOT EXISTS idx_documenti_tipo ON scadenze_bandi_documenti(tipo_documento);

-- 8. Trigger per documenti updated_at
CREATE TRIGGER trigger_update_documenti_updated_at
    BEFORE UPDATE ON scadenze_bandi_documenti
    FOR EACH ROW
    EXECUTE FUNCTION update_template_scadenze_updated_at();

DO $$
BEGIN
    RAISE NOTICE '=====================================';
    RAISE NOTICE 'SISTEMA TEMPLATE SCADENZE INSTALLATO!';
    RAISE NOTICE '=====================================';
    RAISE NOTICE 'Tabelle create:';
    RAISE NOTICE '- scadenze_bandi_template_scadenze';
    RAISE NOTICE '- scadenze_bandi_documenti';
    RAISE NOTICE 'Vista: scadenze_bandi_template_view';
    RAISE NOTICE 'Template di esempio creati per bando Innovazione';
    RAISE NOTICE 'Ora puoi creare BandoForm con gestione template!';
    RAISE NOTICE '=====================================';
END $$;