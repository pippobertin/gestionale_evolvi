-- Aggiunge supporto per scadenze collegate a Cliente, Bando o Progetto

-- 1. Aggiunge colonna bando_id se non esiste
ALTER TABLE scadenze_bandi_scadenze
ADD COLUMN IF NOT EXISTS bando_id UUID REFERENCES scadenze_bandi_bandi(id) ON DELETE CASCADE;

-- 2. Aggiorna la vista enhanced per includere anche i bandi
CREATE OR REPLACE VIEW scadenze_enhanced_simple AS
SELECT
    s.*,
    -- Calcola giorni rimanenti
    (s.data_scadenza::date - CURRENT_DATE) as giorni_rimanenti,

    -- Calcola urgenza
    CASE
        WHEN (s.data_scadenza::date - CURRENT_DATE) <= 2 THEN 'URGENTE'
        WHEN (s.data_scadenza::date - CURRENT_DATE) <= 7 THEN 'IMMINENTE'
        ELSE 'NORMALE'
    END as urgenza,

    -- Info progetto collegato
    p.titolo_progetto,
    p.codice_progetto,

    -- Info cliente collegato (diretto o tramite progetto)
    COALESCE(c_diretto.denominazione, c_progetto.denominazione) as cliente_denominazione,

    -- Info bando collegato (diretto o tramite progetto)
    COALESCE(b_diretto.nome, b_progetto.nome) as bando_nome,
    COALESCE(b_diretto.codice_bando, b_progetto.codice_bando) as bando_codice,

    -- Info tipologia
    t.nome as tipologia_nome,

    -- Tipo di collegamento per identificare la fonte
    CASE
        WHEN s.progetto_id IS NOT NULL THEN 'PROGETTO'
        WHEN s.bando_id IS NOT NULL THEN 'BANDO'
        WHEN s.cliente_id IS NOT NULL THEN 'CLIENTE'
        ELSE 'GENERALE'
    END as entita_collegata

FROM scadenze_bandi_scadenze s
LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
LEFT JOIN scadenze_bandi_clienti c_diretto ON s.cliente_id = c_diretto.id
LEFT JOIN scadenze_bandi_clienti c_progetto ON p.cliente_id = c_progetto.id
LEFT JOIN scadenze_bandi_bandi b_diretto ON s.bando_id = b_diretto.id
LEFT JOIN scadenze_bandi_bandi b_progetto ON p.bando_id = b_progetto.id
LEFT JOIN scadenze_bandi_tipologie_scadenze t ON s.tipologia_scadenza_id = t.id;

-- 3. Crea tipologie di scadenza specifiche per ogni entità se non esistono
DO $$
BEGIN
    -- Tipologie per Cliente
    INSERT INTO scadenze_bandi_tipologie_scadenze (nome, descrizione) VALUES
    ('Rinnovo Contratto Cliente', 'Scadenza per il rinnovo del contratto con il cliente'),
    ('Certificazione Cliente', 'Scadenza per rinnovo certificazioni del cliente'),
    ('Pagamento Cliente', 'Scadenza per pagamenti del cliente')
    ON CONFLICT (nome) DO NOTHING;

    -- Tipologie per Bando
    INSERT INTO scadenze_bandi_tipologie_scadenze (nome, descrizione) VALUES
    ('Apertura Bando', 'Data di apertura del bando'),
    ('Chiusura Bando', 'Data di chiusura del bando'),
    ('Pubblicazione Graduatoria', 'Data di pubblicazione della graduatoria')
    ON CONFLICT (nome) DO NOTHING;

    -- Tipologie per Progetto (già esistenti ma aggiungiamo altre)
    INSERT INTO scadenze_bandi_tipologie_scadenze (nome, descrizione) VALUES
    ('Richiesta Proroga', 'Scadenza per richiedere proroga progetto'),
    ('Primo SAL', 'Primo Stato Avanzamento Lavori'),
    ('Secondo SAL', 'Secondo Stato Avanzamento Lavori'),
    ('Comunicazione Avvio', 'Comunicazione di avvio progetto')
    ON CONFLICT (nome) DO NOTHING;

    RAISE NOTICE 'Tipologie scadenze create per Cliente, Bando e Progetto';
END $$;

-- 4. Aggiunge alcuni esempi di scadenze per ogni tipo
DO $$
DECLARE
    cliente_id UUID;
    bando_id UUID;
    progetto_id UUID;
    tipo_rinnovo_id UUID;
    tipo_chiusura_id UUID;
    tipo_proroga_id UUID;
BEGIN
    -- Prendi il primo cliente, bando e progetto disponibili
    SELECT id INTO cliente_id FROM scadenze_bandi_clienti LIMIT 1;
    SELECT id INTO bando_id FROM scadenze_bandi_bandi LIMIT 1;
    SELECT id INTO progetto_id FROM scadenze_bandi_progetti LIMIT 1;

    -- Prendi le tipologie
    SELECT id INTO tipo_rinnovo_id FROM scadenze_bandi_tipologie_scadenze WHERE nome = 'Rinnovo Contratto Cliente';
    SELECT id INTO tipo_chiusura_id FROM scadenze_bandi_tipologie_scadenze WHERE nome = 'Chiusura Bando';
    SELECT id INTO tipo_proroga_id FROM scadenze_bandi_tipologie_scadenze WHERE nome = 'Richiesta Proroga';

    -- Scadenza collegata a Cliente
    IF cliente_id IS NOT NULL AND tipo_rinnovo_id IS NOT NULL THEN
        INSERT INTO scadenze_bandi_scadenze (
            cliente_id, tipologia_scadenza_id, titolo, data_scadenza, stato, priorita,
            responsabile_email, note
        ) VALUES (
            cliente_id, tipo_rinnovo_id, 'Rinnovo Contratto Cliente',
            CURRENT_DATE + INTERVAL '90 days', 'non_iniziata', 'media',
            'contratti@blmproject.it', 'Scadenza per rinnovo contratto annuale'
        );
    END IF;

    -- Scadenza collegata a Bando
    IF bando_id IS NOT NULL AND tipo_chiusura_id IS NOT NULL THEN
        INSERT INTO scadenze_bandi_scadenze (
            bando_id, tipologia_scadenza_id, titolo, data_scadenza, stato, priorita,
            responsabile_email, note
        ) VALUES (
            bando_id, tipo_chiusura_id, 'Chiusura Bando Innovazione',
            CURRENT_DATE + INTERVAL '45 days', 'non_iniziata', 'alta',
            'bandi@blmproject.it', 'Scadenza per chiusura presentazione domande'
        );
    END IF;

    -- Scadenza collegata a Progetto
    IF progetto_id IS NOT NULL AND tipo_proroga_id IS NOT NULL THEN
        INSERT INTO scadenze_bandi_scadenze (
            progetto_id, tipologia_scadenza_id, titolo, data_scadenza, stato, priorita,
            responsabile_email, note
        ) VALUES (
            progetto_id, tipo_proroga_id, 'Richiesta Proroga Progetto',
            CURRENT_DATE + INTERVAL '30 days', 'non_iniziata', 'critica',
            'progetti@blmproject.it', 'Ultima data per richiedere proroga'
        );
    END IF;

    RAISE NOTICE 'Scadenze di esempio create per Cliente, Bando e Progetto';
END $$;

-- 5. Indici per performance
CREATE INDEX IF NOT EXISTS idx_scadenze_bando ON scadenze_bandi_scadenze(bando_id);
CREATE INDEX IF NOT EXISTS idx_scadenze_entita ON scadenze_bandi_scadenze(cliente_id, bando_id, progetto_id);

DO $$
BEGIN
    RAISE NOTICE '===================================';
    RAISE NOTICE 'SCADENZE MULTI-ENTITÀ CONFIGURATE!';
    RAISE NOTICE '===================================';
    RAISE NOTICE 'Ora le scadenze possono essere collegate a:';
    RAISE NOTICE '- Cliente: per contratti, certificazioni, pagamenti';
    RAISE NOTICE '- Bando: per aperture, chiusure, graduatorie';
    RAISE NOTICE '- Progetto: per SAL, proroghe, rendicontazioni';
    RAISE NOTICE 'Vista enhanced aggiornata con info complete';
    RAISE NOTICE '===================================';
END $$;