-- Schema completo per sistema documenti PROGETTI con eredità selettiva da BANDI
-- Solo gli ALLEGATI vengono ereditati dai bandi, non la NORMATIVA

-- 1. Fix tabella documenti bandi - aggiungi colonna categoria se mancante
ALTER TABLE scadenze_bandi_documenti
ADD COLUMN IF NOT EXISTS categoria TEXT CHECK (categoria IN ('normativa', 'allegato')) DEFAULT 'allegato';

-- Aggiorna documenti esistenti senza categoria
UPDATE scadenze_bandi_documenti
SET categoria = CASE
    WHEN tipo_documento IN ('bando', 'decreto', 'normativa') THEN 'normativa'
    ELSE 'allegato'
END
WHERE categoria IS NULL;

-- 2. Crea/migliora tabella documenti progetti con eredità
DROP TABLE IF EXISTS scadenze_bandi_documenti_progetto CASCADE;

CREATE TABLE scadenze_bandi_documenti_progetto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    progetto_id UUID NOT NULL REFERENCES scadenze_bandi_progetti(id) ON DELETE CASCADE,

    -- Informazioni file
    nome_file TEXT NOT NULL,
    nome_originale TEXT NOT NULL,
    tipo_documento TEXT NOT NULL, -- 'allegato', 'decreto_concessione', 'sal', 'rendicontazione', etc.
    formato_file TEXT, -- 'pdf', 'doc', 'xls', etc.
    dimensione_bytes BIGINT,
    url_file TEXT NOT NULL, -- Path o URL del file in storage

    -- Metadati progettuali
    categoria TEXT CHECK (categoria IN ('ereditato', 'proprio', 'compilato')) DEFAULT 'proprio',
    sal_riferimento INTEGER, -- se è documento di SAL, quale SAL (1, 2, finale)
    stato_compilazione TEXT CHECK (stato_compilazione IN ('da_compilare', 'in_compilazione', 'compilato', 'approvato')) DEFAULT 'da_compilare',

    -- Eredità da bando (se applicabile)
    bando_documento_origine_id UUID REFERENCES scadenze_bandi_documenti(id) ON DELETE SET NULL,
    ereditato_da_bando BOOLEAN DEFAULT false,
    auto_compilazione_completata BOOLEAN DEFAULT false,

    -- Metadati compilazione automatica
    campi_auto_compilati JSONB, -- store dei campi compilati automaticamente
    data_ultima_auto_compilazione TIMESTAMP WITH TIME ZONE,

    -- Descrizione e note
    descrizione TEXT,
    note_compilazione TEXT,

    -- Tracking
    caricato_da TEXT,
    compilato_da TEXT,
    approvato_da TEXT,
    data_approvazione TIMESTAMP WITH TIME ZONE,
    versione INTEGER DEFAULT 1,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Indici per performance
CREATE INDEX idx_documenti_progetto_progetto_id ON scadenze_bandi_documenti_progetto(progetto_id);
CREATE INDEX idx_documenti_progetto_categoria ON scadenze_bandi_documenti_progetto(categoria);
CREATE INDEX idx_documenti_progetto_stato ON scadenze_bandi_documenti_progetto(stato_compilazione);
CREATE INDEX idx_documenti_progetto_ereditato ON scadenze_bandi_documenti_progetto(ereditato_da_bando);
CREATE INDEX idx_documenti_progetto_origine ON scadenze_bandi_documenti_progetto(bando_documento_origine_id);

-- 4. Trigger per eredità automatica allegati quando si crea progetto
CREATE OR REPLACE FUNCTION eredita_allegati_da_bando()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo se il progetto ha un bando_id
    IF NEW.bando_id IS NOT NULL THEN
        -- Copia tutti gli ALLEGATI (non la normativa) dal bando al progetto
        INSERT INTO scadenze_bandi_documenti_progetto (
            progetto_id,
            nome_file,
            nome_originale,
            tipo_documento,
            formato_file,
            dimensione_bytes,
            url_file,
            categoria,
            bando_documento_origine_id,
            ereditato_da_bando,
            descrizione,
            caricato_da
        )
        SELECT
            NEW.id as progetto_id,
            'TEMPLATE_' || bd.nome_file as nome_file, -- Prefisso per distinguere template
            bd.nome_originale,
            bd.tipo_documento,
            bd.formato_file,
            bd.dimensione_bytes,
            bd.url_file, -- Stesso file del bando (sarà copiato poi)
            'ereditato' as categoria,
            bd.id as bando_documento_origine_id,
            true as ereditato_da_bando,
            'Template ereditato automaticamente dal bando: ' || bd.descrizione as descrizione,
            'SISTEMA_AUTO_EREDITÀ' as caricato_da
        FROM scadenze_bandi_documenti bd
        WHERE bd.bando_id = NEW.bando_id
        AND bd.categoria = 'allegato'  -- Solo allegati, no normativa
        AND bd.tipo_documento IN ('allegato', 'modulistica'); -- Solo allegati compilabili

        RAISE NOTICE 'Ereditati % allegati dal bando % al progetto %',
            (SELECT COUNT(*) FROM scadenze_bandi_documenti WHERE bando_id = NEW.bando_id AND categoria = 'allegato'),
            NEW.bando_id,
            NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea trigger per progetti
DROP TRIGGER IF EXISTS trigger_eredita_allegati ON scadenze_bandi_progetti;
CREATE TRIGGER trigger_eredita_allegati
    AFTER INSERT ON scadenze_bandi_progetti
    FOR EACH ROW
    EXECUTE FUNCTION eredita_allegati_da_bando();

-- 5. Trigger per update timestamp automatico
CREATE OR REPLACE FUNCTION update_documenti_progetto_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_documenti_progetto_timestamp
    BEFORE UPDATE ON scadenze_bandi_documenti_progetto
    FOR EACH ROW
    EXECUTE FUNCTION update_documenti_progetto_timestamp();

-- 6. Vista integrata documenti progetto con info bando origine
CREATE OR REPLACE VIEW scadenze_bandi_documenti_progetto_view AS
SELECT
    dp.*,
    -- Info progetto
    p.nome as progetto_nome,
    p.codice_progetto,
    p.cliente_id,
    p.bando_id,

    -- Info bando origine (se ereditato)
    CASE
        WHEN dp.ereditato_da_bando THEN b.nome
        ELSE NULL
    END as bando_origine_nome,

    -- Info documento bando origine (se ereditato)
    CASE
        WHEN dp.bando_documento_origine_id IS NOT NULL THEN bd.nome_file
        ELSE NULL
    END as file_origine_bando,

    -- Statistiche compilazione
    CASE dp.stato_compilazione
        WHEN 'compilato' THEN '✅ Compilato'
        WHEN 'in_compilazione' THEN '🔄 In corso'
        WHEN 'approvato' THEN '🎯 Approvato'
        ELSE '📝 Da compilare'
    END as stato_display,

    -- Info auto-compilazione
    CASE
        WHEN dp.auto_compilazione_completata THEN '🤖 Auto-compilato'
        WHEN dp.categoria = 'ereditato' AND NOT dp.auto_compilazione_completata THEN '⏳ Pronto per auto-compilazione'
        ELSE NULL
    END as auto_compilazione_status

FROM scadenze_bandi_documenti_progetto dp
LEFT JOIN scadenze_bandi_progetti p ON dp.progetto_id = p.id
LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
LEFT JOIN scadenze_bandi_documenti bd ON dp.bando_documento_origine_id = bd.id
ORDER BY dp.created_at DESC;

-- 7. Funzione per auto-compilazione intelligente
CREATE OR REPLACE FUNCTION auto_compila_allegato_progetto(
    documento_id UUID,
    progetto_id UUID
) RETURNS JSONB AS $$
DECLARE
    cliente_info RECORD;
    progetto_info RECORD;
    bando_info RECORD;
    legale_info RECORD;
    campi_compilati JSONB;
BEGIN
    -- Recupera info complete per auto-compilazione
    SELECT c.*, lr.* INTO cliente_info
    FROM scadenze_bandi_progetti p
    JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id
    LEFT JOIN scadenze_bandi_legale_rappresentante lr ON c.id = lr.cliente_id
    WHERE p.id = progetto_id;

    SELECT p.*, b.* INTO progetto_info, bando_info
    FROM scadenze_bandi_progetti p
    LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
    WHERE p.id = progetto_id;

    -- Crea struttura dati per auto-compilazione
    campi_compilati := jsonb_build_object(
        'azienda', jsonb_build_object(
            'ragione_sociale', cliente_info.ragione_sociale,
            'partita_iva', cliente_info.partita_iva,
            'codice_fiscale', cliente_info.codice_fiscale,
            'indirizzo_sede_legale', cliente_info.indirizzo_sede_legale,
            'citta_sede_legale', cliente_info.citta_sede_legale,
            'provincia_sede_legale', cliente_info.provincia_sede_legale,
            'cap_sede_legale', cliente_info.cap_sede_legale,
            'telefono', cliente_info.telefono,
            'email', cliente_info.email,
            'pec', cliente_info.pec,
            'dimensione_aziendale', cliente_info.dimensione_aziendale,
            'settore_attivita', cliente_info.settore_attivita
        ),
        'legale_rappresentante', jsonb_build_object(
            'nome', cliente_info.lr_nome,
            'cognome', cliente_info.lr_cognome,
            'codice_fiscale', cliente_info.lr_codice_fiscale,
            'data_nascita', cliente_info.lr_data_nascita,
            'comune_nascita', cliente_info.lr_comune_nascita,
            'provincia_nascita', cliente_info.lr_provincia_nascita,
            'indirizzo_residenza', cliente_info.lr_indirizzo_residenza,
            'citta_residenza', cliente_info.lr_citta_residenza,
            'provincia_residenza', cliente_info.lr_provincia_residenza,
            'cap_residenza', cliente_info.lr_cap_residenza,
            'telefono', cliente_info.lr_telefono,
            'email', cliente_info.lr_email,
            'qualifica', cliente_info.lr_qualifica
        ),
        'progetto', jsonb_build_object(
            'nome', progetto_info.nome,
            'codice', progetto_info.codice_progetto,
            'importo_finanziamento', progetto_info.importo_finanziamento,
            'data_decreto_concessione', progetto_info.data_decreto_concessione,
            'data_scadenza_naturale', progetto_info.data_scadenza_naturale
        ),
        'bando', jsonb_build_object(
            'nome', bando_info.nome,
            'codice', bando_info.codice_bando,
            'ente_erogatore', bando_info.ente_erogatore,
            'contributo_massimo', bando_info.contributo_massimo,
            'percentuale_contributo', bando_info.percentuale_contributo
        ),
        'meta', jsonb_build_object(
            'data_compilazione', NOW(),
            'versione_template', '1.0',
            'compilato_automaticamente', true
        )
    );

    -- Aggiorna documento con dati compilati
    UPDATE scadenze_bandi_documenti_progetto
    SET
        campi_auto_compilati = campi_compilati,
        auto_compilazione_completata = true,
        data_ultima_auto_compilazione = NOW(),
        stato_compilazione = 'compilato',
        compilato_da = 'SISTEMA_AUTO_COMPILAZIONE'
    WHERE id = documento_id;

    RETURN campi_compilati;
END;
$$ LANGUAGE plpgsql;

-- 8. Storage bucket per documenti progetti (se non esiste)
-- NOTA: Questo comando va eseguito nel dashboard Supabase o tramite RPC
-- INSERT INTO storage.buckets (id, name, public) VALUES ('progetti-documenti', 'progetti-documenti', false);

DO $$
BEGIN
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'SISTEMA DOCUMENTI PROGETTI IMPLEMENTATO!';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '✅ Tabella scadenze_bandi_documenti_progetto creata';
    RAISE NOTICE '✅ Sistema eredità automatica ALLEGATI da bandi';
    RAISE NOTICE '✅ Colonna categoria aggiunta a documenti bandi';
    RAISE NOTICE '✅ Vista integrata con info bando origine';
    RAISE NOTICE '✅ Funzione auto-compilazione intelligente';
    RAISE NOTICE '✅ Trigger per eredità automatica all''inserimento progetto';
    RAISE NOTICE '🎯 Solo ALLEGATI vengono ereditati (no normativa)';
    RAISE NOTICE '🤖 Auto-compilazione con dati azienda + legale rappresentante';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'PROSSIMO: Creare bucket storage "progetti-documenti" in Supabase';
    RAISE NOTICE 'PROSSIMO: Implementare UI gestione documenti progetti';
    RAISE NOTICE '=========================================';
END $$;