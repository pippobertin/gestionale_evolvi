-- Email System Schema per Gestionale Evolvi
-- Schema per sistema email integrato con supporto multi-provider (Aruba, Gmail, Outlook, ecc.)

-- ===== TABELLA ACCOUNT EMAIL =====
CREATE TABLE scadenze_bandi_email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES scadenze_bandi_utenti(id) ON DELETE CASCADE,

    -- Informazioni account
    name TEXT NOT NULL, -- Nome visualizzato (es. "Email Aziendale")
    email_address TEXT NOT NULL,

    -- Provider e configurazione
    provider_type TEXT NOT NULL DEFAULT 'generic', -- 'aruba', 'gmail', 'outlook', 'generic'

    -- Server IMAP
    imap_server TEXT NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_secure BOOLEAN NOT NULL DEFAULT true, -- SSL/TLS

    -- Server SMTP
    smtp_server TEXT NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_secure BOOLEAN NOT NULL DEFAULT true,

    -- Credenziali (password criptata)
    username TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,

    -- Configurazione OAuth (per Gmail/Outlook)
    oauth_refresh_token TEXT,
    oauth_access_token TEXT,
    oauth_expires_at TIMESTAMPTZ,

    -- Stato e metadati
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sync TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'success', 'error'
    sync_error TEXT,

    -- Configurazione sincronizzazione
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    sync_folders TEXT[] DEFAULT ARRAY['INBOX'], -- Cartelle da sincronizzare
    max_messages_per_folder INTEGER DEFAULT 100,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(user_id, email_address),
    CHECK (provider_type IN ('aruba', 'gmail', 'outlook', 'generic')),
    CHECK (sync_status IN ('pending', 'syncing', 'success', 'error'))
);

-- ===== TABELLA CARTELLE EMAIL =====
CREATE TABLE scadenze_bandi_email_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES scadenze_bandi_email_accounts(id) ON DELETE CASCADE,

    -- Informazioni cartella
    name TEXT NOT NULL,
    full_path TEXT NOT NULL, -- Percorso completo IMAP (es. "INBOX.Sent")
    folder_type TEXT DEFAULT 'custom', -- 'inbox', 'sent', 'drafts', 'trash', 'custom'

    -- Statistiche
    total_messages INTEGER DEFAULT 0,
    unread_messages INTEGER DEFAULT 0,

    -- Sincronizzazione
    last_sync TIMESTAMPTZ,
    uid_validity BIGINT, -- Per tracking IMAP UID
    highest_uid BIGINT DEFAULT 0,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(account_id, full_path),
    CHECK (folder_type IN ('inbox', 'sent', 'drafts', 'trash', 'custom'))
);

-- ===== TABELLA MESSAGGI EMAIL =====
CREATE TABLE scadenze_bandi_email_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES scadenze_bandi_email_accounts(id) ON DELETE CASCADE,
    folder_id UUID NOT NULL REFERENCES scadenze_bandi_email_folders(id) ON DELETE CASCADE,

    -- Identificatori IMAP
    message_id TEXT NOT NULL, -- Message-ID header
    uid BIGINT NOT NULL, -- IMAP UID
    thread_id TEXT, -- Per raggruppare conversazioni

    -- Headers principali
    subject TEXT,
    from_address TEXT NOT NULL,
    from_name TEXT,
    to_addresses TEXT[], -- Array di email destinatari
    cc_addresses TEXT[],
    bcc_addresses TEXT[],
    reply_to_address TEXT,

    -- Corpo messaggio
    body_text TEXT, -- Versione plain text
    body_html TEXT, -- Versione HTML
    body_preview TEXT, -- Anteprima (primi 200 caratteri)

    -- Metadati messaggio
    date_sent TIMESTAMPTZ NOT NULL,
    date_received TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    size_bytes INTEGER,

    -- Stati e flags
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_flagged BOOLEAN NOT NULL DEFAULT false,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    is_draft BOOLEAN NOT NULL DEFAULT false,
    is_answered BOOLEAN NOT NULL DEFAULT false,

    -- Allegati
    has_attachments BOOLEAN NOT NULL DEFAULT false,
    attachments_count INTEGER DEFAULT 0,

    -- Classificazione automatica
    importance TEXT DEFAULT 'normal', -- 'low', 'normal', 'high'
    spam_score NUMERIC(3,2), -- 0.00-1.00

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(account_id, folder_id, uid),
    UNIQUE(account_id, message_id),
    CHECK (importance IN ('low', 'normal', 'high'))
);

-- ===== TABELLA ALLEGATI =====
CREATE TABLE scadenze_bandi_email_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES scadenze_bandi_email_messages(id) ON DELETE CASCADE,

    -- Informazioni file
    filename TEXT NOT NULL,
    content_type TEXT,
    size_bytes INTEGER,

    -- Contenuto (per piccoli allegati) o riferimento storage
    content BYTEA, -- Per file piccoli (<1MB)
    storage_path TEXT, -- Path su filesystem/cloud storage per file grandi

    -- Metadati
    is_inline BOOLEAN NOT NULL DEFAULT false,
    content_id TEXT, -- Per immagini inline

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== TABELLA COLLEGAMENTI EMAIL → ENTITÀ BUSINESS =====
CREATE TABLE scadenze_bandi_email_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES scadenze_bandi_email_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Entità collegata
    entity_type TEXT NOT NULL, -- 'cliente', 'bando', 'progetto', 'scadenza'
    entity_id UUID NOT NULL,

    -- Tipo collegamento
    link_type TEXT DEFAULT 'manual', -- 'manual', 'auto_domain', 'auto_content', 'auto_sender'
    confidence_score NUMERIC(3,2), -- Per collegamenti automatici (0.00-1.00)

    -- Note utente
    notes TEXT,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Constraints
    UNIQUE(message_id, entity_type, entity_id),
    CHECK (entity_type IN ('cliente', 'bando', 'progetto', 'scadenza')),
    CHECK (link_type IN ('manual', 'auto_domain', 'auto_content', 'auto_sender'))
);

-- ===== TABELLA LOG SINCRONIZZAZIONE =====
CREATE TABLE scadenze_bandi_email_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES scadenze_bandi_email_accounts(id) ON DELETE CASCADE,

    -- Informazioni sync
    sync_type TEXT NOT NULL, -- 'full', 'incremental', 'folder'
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'error', 'cancelled'

    -- Risultati
    folders_synced INTEGER DEFAULT 0,
    messages_new INTEGER DEFAULT 0,
    messages_updated INTEGER DEFAULT 0,
    messages_deleted INTEGER DEFAULT 0,

    -- Errori
    error_message TEXT,
    error_details JSONB,

    CHECK (sync_type IN ('full', 'incremental', 'folder')),
    CHECK (status IN ('running', 'success', 'error', 'cancelled'))
);

-- ===== INDICI PER PERFORMANCE =====

-- Account email
CREATE INDEX idx_scadenze_bandi_email_accounts_user_id ON scadenze_bandi_email_accounts(user_id);
CREATE INDEX idx_scadenze_bandi_email_accounts_provider ON scadenze_bandi_email_accounts(provider_type);
CREATE INDEX idx_scadenze_bandi_email_accounts_active ON scadenze_bandi_email_accounts(is_active);

-- Cartelle
CREATE INDEX idx_scadenze_bandi_email_folders_account ON scadenze_bandi_email_folders(account_id);
CREATE INDEX idx_scadenze_bandi_email_folders_type ON scadenze_bandi_email_folders(folder_type);

-- Messaggi
CREATE INDEX idx_scadenze_bandi_email_messages_account ON scadenze_bandi_email_messages(account_id);
CREATE INDEX idx_scadenze_bandi_email_messages_folder ON scadenze_bandi_email_messages(folder_id);
CREATE INDEX idx_scadenze_bandi_email_messages_date ON scadenze_bandi_email_messages(date_received DESC);
CREATE INDEX idx_scadenze_bandi_email_messages_from ON scadenze_bandi_email_messages(from_address);
CREATE INDEX idx_scadenze_bandi_email_messages_subject ON scadenze_bandi_email_messages USING gin(to_tsvector('italian', subject));
CREATE INDEX idx_scadenze_bandi_email_messages_read ON scadenze_bandi_email_messages(is_read);
CREATE INDEX idx_scadenze_bandi_email_messages_uid ON scadenze_bandi_email_messages(account_id, folder_id, uid);
CREATE INDEX idx_scadenze_bandi_email_messages_thread ON scadenze_bandi_email_messages(thread_id) WHERE thread_id IS NOT NULL;

-- Collegamenti
CREATE INDEX idx_scadenze_bandi_email_links_message ON scadenze_bandi_email_links(message_id);
CREATE INDEX idx_scadenze_bandi_email_links_entity ON scadenze_bandi_email_links(entity_type, entity_id);
CREATE INDEX idx_scadenze_bandi_email_links_user ON scadenze_bandi_email_links(user_id);

-- Allegati
CREATE INDEX idx_scadenze_bandi_email_attachments_message ON scadenze_bandi_email_attachments(message_id);

-- Log sync
CREATE INDEX idx_scadenze_bandi_email_sync_logs_account ON scadenze_bandi_email_sync_logs(account_id);
CREATE INDEX idx_scadenze_bandi_email_sync_logs_date ON scadenze_bandi_email_sync_logs(started_at DESC);

-- ===== TRIGGER PER TIMESTAMP AUTOMATICI =====

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger per tabelle con updated_at
CREATE TRIGGER update_scadenze_bandi_email_accounts_updated_at
    BEFORE UPDATE ON scadenze_bandi_email_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scadenze_bandi_email_folders_updated_at
    BEFORE UPDATE ON scadenze_bandi_email_folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scadenze_bandi_email_messages_updated_at
    BEFORE UPDATE ON scadenze_bandi_email_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== RLS (Row Level Security) =====

-- Abilita RLS su tutte le tabelle
ALTER TABLE scadenze_bandi_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_email_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_email_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_email_sync_logs ENABLE ROW LEVEL SECURITY;

-- Policy per email_accounts (solo i propri account)
CREATE POLICY "Users can manage their own email accounts" ON scadenze_bandi_email_accounts
    FOR ALL USING (auth.uid() = user_id);

-- Policy per email_folders (solo cartelle dei propri account)
CREATE POLICY "Users can access folders of their accounts" ON scadenze_bandi_email_folders
    FOR ALL USING (
        account_id IN (
            SELECT id FROM scadenze_bandi_email_accounts WHERE user_id = auth.uid()
        )
    );

-- Policy per email_messages (solo messaggi dei propri account)
CREATE POLICY "Users can access messages of their accounts" ON scadenze_bandi_email_messages
    FOR ALL USING (
        account_id IN (
            SELECT id FROM scadenze_bandi_email_accounts WHERE user_id = auth.uid()
        )
    );

-- Policy per email_attachments (solo allegati dei propri messaggi)
CREATE POLICY "Users can access attachments of their messages" ON scadenze_bandi_email_attachments
    FOR ALL USING (
        message_id IN (
            SELECT em.id FROM scadenze_bandi_email_messages em
            JOIN scadenze_bandi_email_accounts ea ON em.account_id = ea.id
            WHERE ea.user_id = auth.uid()
        )
    );

-- Policy per email_links (solo i propri collegamenti)
CREATE POLICY "Users can manage their own email links" ON scadenze_bandi_email_links
    FOR ALL USING (auth.uid() = user_id);

-- Policy per email_sync_logs (solo log dei propri account)
CREATE POLICY "Users can view sync logs of their accounts" ON scadenze_bandi_email_sync_logs
    FOR SELECT USING (
        account_id IN (
            SELECT id FROM scadenze_bandi_email_accounts WHERE user_id = auth.uid()
        )
    );

-- ===== PRESET CONFIGURAZIONI PROVIDER =====

-- Preset per provider comuni (da usare nell'UI)
COMMENT ON TABLE scadenze_bandi_email_accounts IS 'Preset configurazioni comuni:

ARUBA:
- IMAP: imaps.aruba.it:993 (SSL)
- SMTP: smtps.aruba.it:465 (SSL) o smtp.aruba.it:587 (TLS)

GMAIL:
- IMAP: imap.gmail.com:993 (SSL)
- SMTP: smtp.gmail.com:587 (TLS)
- Richiede OAuth2 o App Password

OUTLOOK/HOTMAIL:
- IMAP: outlook.office365.com:993 (SSL)
- SMTP: smtp-mail.outlook.com:587 (TLS)

LIBERO/TIM:
- IMAP: imapmail.libero.it:993 (SSL)
- SMTP: smtp.libero.it:465 (SSL)

YAHOO:
- IMAP: imap.mail.yahoo.com:993 (SSL)
- SMTP: smtp.mail.yahoo.com:587 (TLS)
';