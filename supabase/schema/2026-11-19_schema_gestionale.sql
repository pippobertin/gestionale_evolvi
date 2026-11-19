-- ############################################################################
-- Gestionale Evolvi - schema reale del database
-- Data estrazione: 19/11/2026
-- Progetto Supabase: "TEST" (project_id xvjgziihekwjyzihjihx), PostgreSQL 15.8
--
-- Estratto dai cataloghi, solo struttura, a scopo di documentazione e audit;
-- non è uno script da eseguire così com'è.
--
-- Fonte: query SELECT su pg_catalog / information_schema (pg_get_constraintdef,
-- pg_get_indexdef, pg_get_triggerdef, pg_get_viewdef, pg_get_functiondef,
-- format_type, pg_policies, has_table_privilege, has_function_privilege).
-- Nessun dato delle tabelle è stato letto o esportato.
--
-- Perimetro: schema public, oggetti con prefisso scadenze_bandi_ o vista_,
-- la vista scadenze_enhanced_simple, le funzioni match_clienti, match_bandi,
-- match_progetti, find_note_candidate_for_bando, find_note_candidate_for_progetto,
-- match_bandi_esterni_per_cliente, generate_numero_prospect, gestionale_utente_id,
-- gestionale_is_admin e le funzioni usate dai trigger delle tabelle del perimetro.
-- Escluse le tabelle di altre applicazioni (fin_, csp_, gre_, edih_, ...).
--
-- Contenuto: 70 tabelle, 16 viste, 17 funzioni, 14 tipi enum.
-- Ordine delle sezioni: 1) tabelle  2) viste  3) funzioni  4) tipi enum.
-- Nota: i tipi enum sono riportati in fondo come richiesto; in uno script
-- eseguibile andrebbero creati prima delle tabelle.
-- I privilegi riportati sono quelli effettivi (has_table_privilege), quindi
-- includono anche quelli ereditati da PUBLIC.
-- ############################################################################


-- ############################################################################
-- SEZIONE 1 - TABELLE (ordine alfabetico)
-- ############################################################################

-- ======================================================================
-- TABELLA: public.scadenze_bandi_additional_recipients
-- ======================================================================
CREATE TABLE public.scadenze_bandi_additional_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_additional_recipients ADD CONSTRAINT scadenze_bandi_additional_recipients_pkey PRIMARY KEY (id);
-- Indici (non legati a vincoli)
CREATE INDEX idx_additional_recipients_active ON public.scadenze_bandi_additional_recipients USING btree (active);
CREATE INDEX idx_additional_recipients_email ON public.scadenze_bandi_additional_recipients USING btree (email);
CREATE UNIQUE INDEX unique_active_email_idx ON public.scadenze_bandi_additional_recipients USING btree (email) WHERE (active = true);
-- Trigger
CREATE TRIGGER update_additional_recipients_updated_at BEFORE UPDATE ON public.scadenze_bandi_additional_recipients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_ateco_2025
-- ======================================================================
CREATE TABLE public.scadenze_bandi_ateco_2025 (
    codice text NOT NULL,
    descrizione text NOT NULL,
    livello integer NOT NULL,
    codice_padre text,
    attivo boolean DEFAULT true,
    note text,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_ateco_2025 ADD CONSTRAINT scadenze_bandi_ateco_2025_pkey PRIMARY KEY (codice);
ALTER TABLE ONLY public.scadenze_bandi_ateco_2025 ADD CONSTRAINT scadenze_bandi_ateco_2025_codice_padre_fkey FOREIGN KEY (codice_padre) REFERENCES scadenze_bandi_ateco_2025(codice);
ALTER TABLE ONLY public.scadenze_bandi_ateco_2025 ADD CONSTRAINT scadenze_bandi_ateco_2025_livello_check CHECK (((livello >= 1) AND (livello <= 6)));
-- Indici (non legati a vincoli)
CREATE INDEX idx_ateco_descrizione ON public.scadenze_bandi_ateco_2025 USING btree (descrizione);
CREATE INDEX idx_ateco_livello ON public.scadenze_bandi_ateco_2025 USING btree (livello);
CREATE INDEX idx_ateco_padre ON public.scadenze_bandi_ateco_2025 USING btree (codice_padre);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_bandi
-- ======================================================================
CREATE TABLE public.scadenze_bandi_bandi (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    nome text NOT NULL,
    descrizione text,
    tipo_bando text,
    stato scadenze_bandi_stato_bando DEFAULT 'attivo'::scadenze_bandi_stato_bando,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    codice_bando character varying(50),
    ente_erogatore text,
    tipologia_bando text,
    contributo_massimo numeric(15,2),
    budget_totale numeric(15,2),
    percentuale_contributo numeric(5,2),
    data_pubblicazione date,
    data_apertura_presentazione date,
    data_chiusura_presentazione date,
    tempo_valutazione_giorni integer DEFAULT 90,
    data_base_calcolo date,
    link_bando_ufficiale text,
    documenti_paths text[],
    settori_ammessi text[],
    dimensioni_aziendali_ammesse text[],
    localizzazione_geografica text,
    note_interne text,
    referente_bando text,
    email_referente text,
    stato_bando bando_stato DEFAULT 'PROSSIMA_APERTURA'::bando_stato,
    tipo_valutazione bando_tipo_valutazione DEFAULT 'A_PUNTEGGIO'::bando_tipo_valutazione,
    spesa_minima_ammessa numeric(12,2) DEFAULT 0,
    regime_aiuto text DEFAULT 'DE_MINIMIS'::text,
    created_by uuid,
    updated_by uuid,
    evento_base_id uuid,
    responsabili_scadenze_json jsonb DEFAULT '[]'::jsonb
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_bandi ADD CONSTRAINT scadenze_bandi_bandi_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_bandi ADD CONSTRAINT unique_codice_bando UNIQUE (codice_bando);
ALTER TABLE ONLY public.scadenze_bandi_bandi ADD CONSTRAINT scadenze_bandi_bandi_created_by_fkey FOREIGN KEY (created_by) REFERENCES scadenze_bandi_utenti(id);
ALTER TABLE ONLY public.scadenze_bandi_bandi ADD CONSTRAINT scadenze_bandi_bandi_evento_base_id_fkey FOREIGN KEY (evento_base_id) REFERENCES scadenze_bandi_eventi_catalogo(id);
ALTER TABLE ONLY public.scadenze_bandi_bandi ADD CONSTRAINT scadenze_bandi_bandi_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES scadenze_bandi_utenti(id);
ALTER TABLE ONLY public.scadenze_bandi_bandi ADD CONSTRAINT scadenze_bandi_bandi_regime_aiuto_check CHECK ((regime_aiuto = ANY (ARRAY['DE_MINIMIS'::text, 'ESENZIONE'::text, 'NO_AIUTO_STATO'::text, 'ALTRO'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_bandi_apertura ON public.scadenze_bandi_bandi USING btree (data_apertura_presentazione);
CREATE INDEX idx_bandi_chiusura ON public.scadenze_bandi_bandi USING btree (data_chiusura_presentazione);
CREATE INDEX idx_bandi_nome_trgm ON public.scadenze_bandi_bandi USING gin (nome gin_trgm_ops);
CREATE INDEX idx_bandi_responsabili ON public.scadenze_bandi_bandi USING gin (responsabili_scadenze_json);
CREATE INDEX idx_bandi_tipologia ON public.scadenze_bandi_bandi USING btree (tipologia_bando);
CREATE INDEX idx_scadenze_bandi_bandi_created_by ON public.scadenze_bandi_bandi USING btree (created_by);
CREATE INDEX idx_scadenze_bandi_bandi_evento_base ON public.scadenze_bandi_bandi USING btree (evento_base_id);
-- Trigger
CREATE TRIGGER trigger_update_bando_stato BEFORE INSERT OR UPDATE ON public.scadenze_bandi_bandi FOR EACH ROW EXECUTE FUNCTION update_bando_stato_automatico();
CREATE TRIGGER update_bandi_updated_at BEFORE UPDATE ON public.scadenze_bandi_bandi FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   POLICY "Utenti autenticati possono aggiornare bandi" | PERMISSIVE | ruoli: authenticated | comando: UPDATE | USING: true | WITH CHECK: true
--   POLICY "Utenti autenticati possono eliminare bandi" | PERMISSIVE | ruoli: authenticated | comando: DELETE | USING: true | WITH CHECK: -
--   POLICY "Utenti autenticati possono inserire bandi" | PERMISSIVE | ruoli: authenticated | comando: INSERT | USING: - | WITH CHECK: true
--   POLICY "Utenti autenticati possono vedere tutti i bandi" | PERMISSIVE | ruoli: authenticated | comando: SELECT | USING: true | WITH CHECK: -
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_bandi_esterni
-- ======================================================================
CREATE TABLE public.scadenze_bandi_bandi_esterni (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fonte text DEFAULT 'agevolando'::text NOT NULL,
    titolo text NOT NULL,
    investimenti_spesati text[] DEFAULT '{}'::text[] NOT NULL,
    tipologia_aiuto text,
    stato text DEFAULT 'attivo'::text NOT NULL,
    data_apertura text,
    data_scadenza date,
    url_dettagli text,
    territorio text,
    destinatari text,
    settori text,
    email_msg_id text,
    raw_payload jsonb DEFAULT '{}'::jsonb,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_bandi_esterni ADD CONSTRAINT scadenze_bandi_bandi_esterni_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_bandi_esterni ADD CONSTRAINT scadenze_bandi_bandi_esterni_stato_check CHECK ((stato = ANY (ARRAY['attivo'::text, 'in_apertura'::text, 'scaduto'::text, 'archiviato'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_bandi_esterni_email_msg_id ON public.scadenze_bandi_bandi_esterni USING btree (email_msg_id);
CREATE INDEX idx_bandi_esterni_invest_gin ON public.scadenze_bandi_bandi_esterni USING gin (investimenti_spesati);
CREATE INDEX idx_bandi_esterni_stato ON public.scadenze_bandi_bandi_esterni USING btree (stato);
-- Trigger
CREATE TRIGGER update_bandi_esterni_updated_at BEFORE UPDATE ON public.scadenze_bandi_bandi_esterni FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: ABILITATA
--   POLICY "Allow all operations for authenticated users" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: true
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_calendar_events
-- ======================================================================
CREATE TABLE public.scadenze_bandi_calendar_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_id text NOT NULL,
    calendar_event_id text NOT NULL,
    event_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_calendar_events ADD CONSTRAINT scadenze_bandi_calendar_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_calendar_events ADD CONSTRAINT scadenze_bandi_calendar_events_event_type_check CHECK ((event_type = ANY (ARRAY['scadenza'::text, 'progetto_milestone'::text, 'meeting'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_calendar_events_calendar_id ON public.scadenze_bandi_calendar_events USING btree (calendar_event_id);
CREATE INDEX idx_calendar_events_entity ON public.scadenze_bandi_calendar_events USING btree (entity_id);
CREATE INDEX idx_calendar_events_type ON public.scadenze_bandi_calendar_events USING btree (event_type);
CREATE INDEX idx_scadenze_bandi_calendar_events_entity ON public.scadenze_bandi_calendar_events USING btree (entity_id, event_type);
-- Trigger
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON public.scadenze_bandi_calendar_events FOR EACH ROW EXECUTE FUNCTION update_calendar_events_updated_at();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_ccnl
-- ======================================================================
CREATE TABLE public.scadenze_bandi_ccnl (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codice character varying(300) NOT NULL,
    denominazione character varying(500) NOT NULL,
    settore character varying(100) NOT NULL,
    attivo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_ccnl ADD CONSTRAINT scadenze_bandi_ccnl_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_ccnl ADD CONSTRAINT scadenze_bandi_ccnl_codice_key UNIQUE (codice);
-- Indici (non legati a vincoli)
CREATE INDEX idx_ccnl_denominazione ON public.scadenze_bandi_ccnl USING btree (denominazione);
CREATE INDEX idx_ccnl_settore ON public.scadenze_bandi_ccnl USING btree (settore);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_ccnl_sigle
-- ======================================================================
CREATE TABLE public.scadenze_bandi_ccnl_sigle (
    ccnl_id uuid NOT NULL,
    sigla_id uuid NOT NULL
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_ccnl_sigle ADD CONSTRAINT scadenze_bandi_ccnl_sigle_pkey PRIMARY KEY (ccnl_id, sigla_id);
ALTER TABLE ONLY public.scadenze_bandi_ccnl_sigle ADD CONSTRAINT scadenze_bandi_ccnl_sigle_ccnl_id_fkey FOREIGN KEY (ccnl_id) REFERENCES scadenze_bandi_ccnl(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_ccnl_sigle ADD CONSTRAINT scadenze_bandi_ccnl_sigle_sigla_id_fkey FOREIGN KEY (sigla_id) REFERENCES scadenze_bandi_sigle_sindacali(id) ON DELETE CASCADE;
-- Indici (non legati a vincoli)
CREATE INDEX idx_ccnl_sigle_ccnl ON public.scadenze_bandi_ccnl_sigle USING btree (ccnl_id);
CREATE INDEX idx_ccnl_sigle_sigla ON public.scadenze_bandi_ccnl_sigle USING btree (sigla_id);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_certificazioni_obbligatorie
-- ======================================================================
CREATE TABLE public.scadenze_bandi_certificazioni_obbligatorie (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    tipo_obbligo character varying(100) NOT NULL,
    normativa_riferimento character varying(300),
    persona_nome character varying(200),
    persona_codice_fiscale character varying(16),
    data_conseguimento date,
    data_scadenza date,
    validita_mesi integer,
    stato character varying(30) DEFAULT 'VALIDA'::character varying,
    corso_collegato_id uuid,
    file_attestato_storage_path character varying(500),
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_certificazioni_obbligatorie ADD CONSTRAINT scadenze_bandi_certificazioni_obbligatorie_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_certificazioni_obbligatorie ADD CONSTRAINT scadenze_bandi_certificazioni_obbligato_corso_collegato_id_fkey FOREIGN KEY (corso_collegato_id) REFERENCES scadenze_bandi_corsi_formativi(id);
ALTER TABLE ONLY public.scadenze_bandi_certificazioni_obbligatorie ADD CONSTRAINT scadenze_bandi_certificazioni_obbligatorie_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_certificazioni_obbligatorie ADD CONSTRAINT scadenze_bandi_certificazioni_obbligatorie_stato_check CHECK (((stato)::text = ANY ((ARRAY['VALIDA'::character varying, 'IN_SCADENZA'::character varying, 'SCADUTA'::character varying, 'DA_RINNOVARE'::character varying])::text[])));
ALTER TABLE ONLY public.scadenze_bandi_certificazioni_obbligatorie ADD CONSTRAINT scadenze_bandi_certificazioni_obbligatorie_tipo_obbligo_check CHECK (((tipo_obbligo)::text = ANY ((ARRAY['FORMAZIONE_LAVORATORI_RISCHIO_BASSO'::character varying, 'FORMAZIONE_LAVORATORI_RISCHIO_MEDIO'::character varying, 'FORMAZIONE_LAVORATORI_RISCHIO_ALTO'::character varying, 'RSPP'::character varying, 'DIRIGENTI_SSL'::character varying, 'PREPOSTI'::character varying, 'RLS'::character varying, 'ANTINCENDIO_BASSO'::character varying, 'ANTINCENDIO_MEDIO'::character varying, 'ANTINCENDIO_ALTO'::character varying, 'PRIMO_SOCCORSO'::character varying, 'HACCP'::character varying, 'PRIVACY_GDPR'::character varying, 'ANTIRICICLAGGIO'::character varying, 'RESPONSABILITA_AMMINISTRATIVA_231'::character varying, 'USO_ATTREZZATURE'::character varying, 'ALTRO'::character varying])::text[])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_certificazioni_cliente_scadenza ON public.scadenze_bandi_certificazioni_obbligatorie USING btree (cliente_id, data_scadenza);
CREATE INDEX idx_certificazioni_stato ON public.scadenze_bandi_certificazioni_obbligatorie USING btree (stato);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_clienti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_clienti (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    denominazione text NOT NULL,
    numero_azienda text DEFAULT (('AZ'::text || EXTRACT(year FROM now())) || lpad((nextval('seq_numero_azienda'::regclass))::text, 6, '0'::text)),
    partita_iva text,
    rea text,
    codice_fiscale text,
    ateco_2025 text,
    ateco_descrizione text,
    data_costituzione date,
    email text,
    pec text,
    telefono text,
    sito_web text,
    coordinate_bancarie text,
    sdi text,
    indirizzo_fatturazione text,
    cap_fatturazione text,
    citta_fatturazione text,
    provincia_fatturazione text,
    stato_fatturazione text DEFAULT 'Italia'::text,
    ula numeric(10,2),
    ultimo_fatturato numeric(15,2),
    attivo_bilancio numeric(15,2),
    dimensione scadenze_bandi_dimensione_azienda GENERATED ALWAYS AS (
CASE
    WHEN ((ula < (10)::numeric) AND ((ultimo_fatturato <= (2000000)::numeric) OR (attivo_bilancio <= (2000000)::numeric))) THEN 'MICRO'::scadenze_bandi_dimensione_azienda
    WHEN ((ula < (50)::numeric) AND ((ultimo_fatturato <= (10000000)::numeric) OR (attivo_bilancio <= (10000000)::numeric))) THEN 'PICCOLA'::scadenze_bandi_dimensione_azienda
    WHEN ((ula < (250)::numeric) AND ((ultimo_fatturato <= (50000000)::numeric) OR (attivo_bilancio <= (43000000)::numeric))) THEN 'MEDIA'::scadenze_bandi_dimensione_azienda
    ELSE 'GRANDE'::scadenze_bandi_dimensione_azienda
END) STORED,
    matricola_inps text,
    pat_inail text,
    numero_dipendenti integer DEFAULT 0,
    numero_volontari integer DEFAULT 0,
    numero_collaboratori integer DEFAULT 0,
    tipo_collegamento scadenze_bandi_tipo_collegamento DEFAULT 'AUTONOMA'::scadenze_bandi_tipo_collegamento,
    impresa_collegata_id uuid,
    percentuale_partecipazione numeric(5,2),
    diritti_voto numeric(5,2),
    influenza_dominante boolean DEFAULT false,
    note_collegamento text,
    categoria_evolvi scadenze_bandi_categoria_evolvi,
    durata_evolvi text,
    scadenza_evolvi date,
    assegnato_a text,
    target text,
    membro_di text,
    proprietario text,
    rating integer,
    descrizione text,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creato_da text,
    legale_rappresentante text,
    data_bilancio_consolidato date,
    legale_rappresentante_nome text,
    legale_rappresentante_cognome text,
    legale_rappresentante_codice_fiscale text,
    legale_rappresentante_data_nascita date,
    legale_rappresentante_luogo_nascita text,
    legale_rappresentante_provincia_nascita text,
    legale_rappresentante_nazionalita text DEFAULT 'Italia'::text,
    legale_rappresentante_indirizzo text,
    legale_rappresentante_cap text,
    legale_rappresentante_citta text,
    legale_rappresentante_provincia text,
    legale_rappresentante_email text,
    legale_rappresentante_telefono text,
    legale_rappresentante_note text,
    created_by uuid,
    updated_by uuid,
    estremi_iscrizione_runts text,
    banca_filiale text
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_clienti ADD CONSTRAINT scadenze_bandi_clienti_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_clienti ADD CONSTRAINT scadenze_bandi_clienti_numero_azienda_key UNIQUE (numero_azienda);
ALTER TABLE ONLY public.scadenze_bandi_clienti ADD CONSTRAINT fk_clienti_ateco FOREIGN KEY (ateco_2025) REFERENCES scadenze_bandi_ateco_2025(codice);
ALTER TABLE ONLY public.scadenze_bandi_clienti ADD CONSTRAINT scadenze_bandi_clienti_created_by_fkey FOREIGN KEY (created_by) REFERENCES scadenze_bandi_utenti(id);
ALTER TABLE ONLY public.scadenze_bandi_clienti ADD CONSTRAINT scadenze_bandi_clienti_impresa_collegata_id_fkey FOREIGN KEY (impresa_collegata_id) REFERENCES scadenze_bandi_clienti(id);
ALTER TABLE ONLY public.scadenze_bandi_clienti ADD CONSTRAINT scadenze_bandi_clienti_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES scadenze_bandi_utenti(id);
ALTER TABLE ONLY public.scadenze_bandi_clienti ADD CONSTRAINT scadenze_bandi_clienti_diritti_voto_check CHECK (((diritti_voto >= (0)::numeric) AND (diritti_voto <= (100)::numeric)));
ALTER TABLE ONLY public.scadenze_bandi_clienti ADD CONSTRAINT scadenze_bandi_clienti_percentuale_partecipazione_check CHECK (((percentuale_partecipazione >= (0)::numeric) AND (percentuale_partecipazione <= (100)::numeric)));
ALTER TABLE ONLY public.scadenze_bandi_clienti ADD CONSTRAINT scadenze_bandi_clienti_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
-- Indici (non legati a vincoli)
CREATE INDEX idx_clienti_ateco ON public.scadenze_bandi_clienti USING btree (ateco_2025);
CREATE INDEX idx_clienti_categoria ON public.scadenze_bandi_clienti USING btree (categoria_evolvi);
CREATE INDEX idx_clienti_denominazione ON public.scadenze_bandi_clienti USING btree (denominazione);
CREATE INDEX idx_clienti_denominazione_trgm ON public.scadenze_bandi_clienti USING gin (denominazione gin_trgm_ops);
CREATE INDEX idx_clienti_dimensione ON public.scadenze_bandi_clienti USING btree (dimensione);
CREATE INDEX idx_clienti_partita_iva ON public.scadenze_bandi_clienti USING btree (partita_iva);
CREATE INDEX idx_clienti_provincia ON public.scadenze_bandi_clienti USING btree (provincia_fatturazione);
CREATE INDEX idx_legali_rappresentanti_cf ON public.scadenze_bandi_clienti USING btree (legale_rappresentante_codice_fiscale);
CREATE INDEX idx_scadenze_bandi_clienti_created_by ON public.scadenze_bandi_clienti USING btree (created_by);
-- Trigger
CREATE TRIGGER update_clienti_updated_at BEFORE UPDATE ON public.scadenze_bandi_clienti FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_clienti_adesioni_fpi
-- ======================================================================
CREATE TABLE public.scadenze_bandi_clienti_adesioni_fpi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    fondo_id uuid NOT NULL,
    codice_adesione character varying(100),
    data_adesione date,
    data_cessazione date,
    ccnl_applicato character varying(200),
    matricole_inps_associate text[],
    dipendenti_aderenti integer,
    stato character varying(30) DEFAULT 'ATTIVA'::character varying,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    ccnl_id uuid,
    sigle_sindacali_ids uuid[] DEFAULT '{}'::uuid[]
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_clienti_adesioni_fpi ADD CONSTRAINT scadenze_bandi_clienti_adesioni_fpi_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_clienti_adesioni_fpi ADD CONSTRAINT scadenze_bandi_clienti_adesioni_fpi_ccnl_id_fkey FOREIGN KEY (ccnl_id) REFERENCES scadenze_bandi_ccnl(id);
ALTER TABLE ONLY public.scadenze_bandi_clienti_adesioni_fpi ADD CONSTRAINT scadenze_bandi_clienti_adesioni_fpi_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_clienti_adesioni_fpi ADD CONSTRAINT scadenze_bandi_clienti_adesioni_fpi_created_by_fkey FOREIGN KEY (created_by) REFERENCES scadenze_bandi_utenti(id);
ALTER TABLE ONLY public.scadenze_bandi_clienti_adesioni_fpi ADD CONSTRAINT scadenze_bandi_clienti_adesioni_fpi_fondo_id_fkey FOREIGN KEY (fondo_id) REFERENCES scadenze_bandi_fondi_interprofessionali(id);
ALTER TABLE ONLY public.scadenze_bandi_clienti_adesioni_fpi ADD CONSTRAINT chk_adesione_attiva CHECK ((((stato)::text <> 'ATTIVA'::text) OR (data_cessazione IS NULL)));
ALTER TABLE ONLY public.scadenze_bandi_clienti_adesioni_fpi ADD CONSTRAINT chk_date_adesione CHECK (((data_cessazione IS NULL) OR (data_adesione IS NULL) OR (data_cessazione >= data_adesione)));
ALTER TABLE ONLY public.scadenze_bandi_clienti_adesioni_fpi ADD CONSTRAINT scadenze_bandi_clienti_adesioni_fpi_stato_check CHECK (((stato)::text = ANY ((ARRAY['ATTIVA'::character varying, 'CESSATA'::character varying, 'SOSPESA'::character varying])::text[])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_adesioni_fpi_ccnl ON public.scadenze_bandi_clienti_adesioni_fpi USING btree (ccnl_id);
CREATE INDEX idx_adesioni_fpi_cliente_stato ON public.scadenze_bandi_clienti_adesioni_fpi USING btree (cliente_id, stato);
CREATE INDEX idx_adesioni_fpi_fondo ON public.scadenze_bandi_clienti_adesioni_fpi USING btree (fondo_id);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_clienti_bandi_esterni
-- ======================================================================
CREATE TABLE public.scadenze_bandi_clienti_bandi_esterni (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    bando_esterno_id uuid NOT NULL,
    stato text NOT NULL,
    progetto_id uuid,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_clienti_bandi_esterni ADD CONSTRAINT scadenze_bandi_clienti_bandi_esterni_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_clienti_bandi_esterni ADD CONSTRAINT scadenze_bandi_clienti_bandi_es_cliente_id_bando_esterno_id_key UNIQUE (cliente_id, bando_esterno_id);
ALTER TABLE ONLY public.scadenze_bandi_clienti_bandi_esterni ADD CONSTRAINT scadenze_bandi_clienti_bandi_esterni_bando_esterno_id_fkey FOREIGN KEY (bando_esterno_id) REFERENCES scadenze_bandi_bandi_esterni(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_clienti_bandi_esterni ADD CONSTRAINT scadenze_bandi_clienti_bandi_esterni_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_clienti_bandi_esterni ADD CONSTRAINT scadenze_bandi_clienti_bandi_esterni_progetto_id_fkey FOREIGN KEY (progetto_id) REFERENCES scadenze_bandi_progetti(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.scadenze_bandi_clienti_bandi_esterni ADD CONSTRAINT scadenze_bandi_clienti_bandi_esterni_stato_check CHECK ((stato = ANY (ARRAY['scartato'::text, 'convertito'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_cli_bandi_est_bando ON public.scadenze_bandi_clienti_bandi_esterni USING btree (bando_esterno_id);
CREATE INDEX idx_cli_bandi_est_cliente ON public.scadenze_bandi_clienti_bandi_esterni USING btree (cliente_id);
-- Trigger
CREATE TRIGGER update_cli_bandi_est_updated_at BEFORE UPDATE ON public.scadenze_bandi_clienti_bandi_esterni FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: ABILITATA
--   POLICY "Allow all operations for authenticated users" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: true
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_clienti_documenti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_clienti_documenti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    nome_file character varying(255) NOT NULL,
    nome_originale character varying(255) NOT NULL,
    categoria character varying(50) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer,
    mime_type character varying(100),
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_clienti_documenti ADD CONSTRAINT scadenze_bandi_clienti_documenti_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_clienti_documenti ADD CONSTRAINT scadenze_bandi_clienti_documenti_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_clienti_documenti ADD CONSTRAINT scadenze_bandi_clienti_documenti_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES scadenze_bandi_utenti(id);
ALTER TABLE ONLY public.scadenze_bandi_clienti_documenti ADD CONSTRAINT scadenze_bandi_clienti_documenti_categoria_check CHECK (((categoria)::text = ANY ((ARRAY['VISURA'::character varying, 'BILANCI'::character varying, 'ULA'::character varying, 'CONTRATTI'::character varying, 'DSAN'::character varying, 'ALTRO'::character varying])::text[])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_clienti_documenti_categoria ON public.scadenze_bandi_clienti_documenti USING btree (categoria);
CREATE INDEX idx_clienti_documenti_cliente_id ON public.scadenze_bandi_clienti_documenti USING btree (cliente_id);
-- Trigger
CREATE TRIGGER update_clienti_documenti_updated_at BEFORE UPDATE ON public.scadenze_bandi_clienti_documenti FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_clienti_esigenze
-- ======================================================================
CREATE TABLE public.scadenze_bandi_clienti_esigenze (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    categorie text[] DEFAULT '{}'::text[] NOT NULL,
    descrizione text,
    origine text DEFAULT 'manuale'::text NOT NULL,
    nota_id uuid,
    stato text DEFAULT 'attiva'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_clienti_esigenze ADD CONSTRAINT scadenze_bandi_clienti_esigenze_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_clienti_esigenze ADD CONSTRAINT scadenze_bandi_clienti_esigenze_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_clienti_esigenze ADD CONSTRAINT scadenze_bandi_clienti_esigenze_nota_id_fkey FOREIGN KEY (nota_id) REFERENCES scadenze_bandi_clienti_note(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.scadenze_bandi_clienti_esigenze ADD CONSTRAINT scadenze_bandi_clienti_esigenze_origine_check CHECK ((origine = ANY (ARRAY['manuale'::text, 'da_nota'::text])));
ALTER TABLE ONLY public.scadenze_bandi_clienti_esigenze ADD CONSTRAINT scadenze_bandi_clienti_esigenze_stato_check CHECK ((stato = ANY (ARRAY['attiva'::text, 'soddisfatta'::text, 'archiviata'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_esigenze_categorie_gin ON public.scadenze_bandi_clienti_esigenze USING gin (categorie);
CREATE INDEX idx_esigenze_cliente_id ON public.scadenze_bandi_clienti_esigenze USING btree (cliente_id);
CREATE INDEX idx_esigenze_stato ON public.scadenze_bandi_clienti_esigenze USING btree (stato);
-- Trigger
CREATE TRIGGER update_esigenze_updated_at BEFORE UPDATE ON public.scadenze_bandi_clienti_esigenze FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: ABILITATA
--   POLICY "Allow all operations for authenticated users" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: true
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_clienti_note
-- ======================================================================
CREATE TABLE public.scadenze_bandi_clienti_note (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid,
    data_riunione date,
    data_caricamento date,
    durata_minuti_stimata integer,
    tipo text,
    titolo text NOT NULL,
    sintesi_one_liner text,
    contenuto_markdown text NOT NULL,
    entita jsonb DEFAULT '{}'::jsonb,
    verifiche_suggerite jsonb DEFAULT '[]'::jsonb,
    sorgente text DEFAULT 'plaud'::text NOT NULL,
    drive_file_id text,
    drive_file_url text,
    filename_originale text,
    match_confidence numeric(3,2),
    match_method text,
    stato text DEFAULT 'pubblicata'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_clienti_note ADD CONSTRAINT scadenze_bandi_clienti_note_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_clienti_note ADD CONSTRAINT scadenze_bandi_clienti_note_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.scadenze_bandi_clienti_note ADD CONSTRAINT scadenze_bandi_clienti_note_match_method_check CHECK ((match_method = ANY (ARRAY['filename'::text, 'gemini'::text, 'pg_trgm'::text, 'manuale'::text, 'inbox'::text])));
ALTER TABLE ONLY public.scadenze_bandi_clienti_note ADD CONSTRAINT scadenze_bandi_clienti_note_sorgente_check CHECK ((sorgente = ANY (ARRAY['plaud'::text, 'manuale'::text, 'altro'::text])));
ALTER TABLE ONLY public.scadenze_bandi_clienti_note ADD CONSTRAINT scadenze_bandi_clienti_note_stato_check CHECK ((stato = ANY (ARRAY['pubblicata'::text, 'in_inbox'::text, 'archiviata'::text, 'scartata'::text])));
ALTER TABLE ONLY public.scadenze_bandi_clienti_note ADD CONSTRAINT scadenze_bandi_clienti_note_tipo_check CHECK ((tipo = ANY (ARRAY['riunione_cliente'::text, 'riunione_interna'::text, 'rassegna_multi_cliente'::text, 'altro'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_note_cliente_id ON public.scadenze_bandi_clienti_note USING btree (cliente_id);
CREATE INDEX idx_note_data_riunione ON public.scadenze_bandi_clienti_note USING btree (data_riunione DESC);
CREATE INDEX idx_note_drive_file_id ON public.scadenze_bandi_clienti_note USING btree (drive_file_id);
CREATE INDEX idx_note_entita ON public.scadenze_bandi_clienti_note USING gin (entita);
CREATE INDEX idx_note_stato ON public.scadenze_bandi_clienti_note USING btree (stato);
-- Trigger
CREATE TRIGGER update_clienti_note_updated_at BEFORE UPDATE ON public.scadenze_bandi_clienti_note FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: ABILITATA
--   POLICY "Allow all operations for authenticated users" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: true
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_clienti_referenti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_clienti_referenti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    cognome character varying(100) NOT NULL,
    nome character varying(100) NOT NULL,
    email character varying(255),
    telefono character varying(50),
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ufficio_id uuid,
    ruolo character varying(150) DEFAULT ''::character varying
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_clienti_referenti ADD CONSTRAINT scadenze_bandi_clienti_referenti_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_clienti_referenti ADD CONSTRAINT scadenze_bandi_clienti_referenti_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_clienti_referenti ADD CONSTRAINT scadenze_bandi_clienti_referenti_ufficio_id_fkey FOREIGN KEY (ufficio_id) REFERENCES scadenze_bandi_uffici_dipartimenti(id);
-- Indici (non legati a vincoli)
CREATE INDEX idx_clienti_referenti_cliente_id ON public.scadenze_bandi_clienti_referenti USING btree (cliente_id);
CREATE INDEX idx_referenti_ufficio ON public.scadenze_bandi_clienti_referenti USING btree (ufficio_id);
-- Trigger
CREATE TRIGGER update_clienti_referenti_updated_at BEFORE UPDATE ON public.scadenze_bandi_clienti_referenti FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: ABILITATA
--   POLICY "Accesso completo referenti" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: -
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_collegamenti_aziendali
-- ======================================================================
CREATE TABLE public.scadenze_bandi_collegamenti_aziendali (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    azienda_madre_id uuid NOT NULL,
    azienda_collegata_id uuid NOT NULL,
    tipo_collegamento scadenze_bandi_tipo_collegamento DEFAULT 'COLLEGATA'::scadenze_bandi_tipo_collegamento NOT NULL,
    percentuale_partecipazione numeric(5,2),
    diritti_voto numeric(5,2),
    influenza_dominante boolean DEFAULT false,
    note_collegamento text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_collegamenti_aziendali ADD CONSTRAINT scadenze_bandi_collegamenti_aziendali_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_collegamenti_aziendali ADD CONSTRAINT unique_collegamento_per_azienda UNIQUE (azienda_madre_id, azienda_collegata_id);
ALTER TABLE ONLY public.scadenze_bandi_collegamenti_aziendali ADD CONSTRAINT scadenze_bandi_collegamenti_aziendali_azienda_collegata_id_fkey FOREIGN KEY (azienda_collegata_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_collegamenti_aziendali ADD CONSTRAINT scadenze_bandi_collegamenti_aziendali_azienda_madre_id_fkey FOREIGN KEY (azienda_madre_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_collegamenti_aziendali ADD CONSTRAINT no_auto_collegamento CHECK ((azienda_madre_id <> azienda_collegata_id));
ALTER TABLE ONLY public.scadenze_bandi_collegamenti_aziendali ADD CONSTRAINT scadenze_bandi_collegamenti_az_percentuale_partecipazione_check CHECK (((percentuale_partecipazione >= (0)::numeric) AND (percentuale_partecipazione <= (100)::numeric)));
ALTER TABLE ONLY public.scadenze_bandi_collegamenti_aziendali ADD CONSTRAINT scadenze_bandi_collegamenti_aziendali_diritti_voto_check CHECK (((diritti_voto >= (0)::numeric) AND (diritti_voto <= (100)::numeric)));
-- Indici (non legati a vincoli)
CREATE INDEX idx_collegamenti_collegata ON public.scadenze_bandi_collegamenti_aziendali USING btree (azienda_collegata_id);
CREATE INDEX idx_collegamenti_madre ON public.scadenze_bandi_collegamenti_aziendali USING btree (azienda_madre_id);
-- Trigger
CREATE TRIGGER update_collegamenti_updated_at BEFORE UPDATE ON public.scadenze_bandi_collegamenti_aziendali FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_consulenti_clienti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_consulenti_clienti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consulente_id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    tipo_segnalazione text NOT NULL,
    data_segnalazione date DEFAULT CURRENT_DATE,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_consulenti_clienti ADD CONSTRAINT scadenze_bandi_consulenti_clienti_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_consulenti_clienti ADD CONSTRAINT scadenze_bandi_consulenti_cli_consulente_id_cliente_id_tipo_key UNIQUE (consulente_id, cliente_id, tipo_segnalazione);
ALTER TABLE ONLY public.scadenze_bandi_consulenti_clienti ADD CONSTRAINT scadenze_bandi_consulenti_clienti_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_consulenti_clienti ADD CONSTRAINT scadenze_bandi_consulenti_clienti_consulente_id_fkey FOREIGN KEY (consulente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_consulenti_clienti ADD CONSTRAINT scadenze_bandi_consulenti_clienti_tipo_segnalazione_check CHECK ((tipo_segnalazione = ANY (ARRAY['bandi'::text, 'spot'::text, 'formazione'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_consulenti_clienti_cliente ON public.scadenze_bandi_consulenti_clienti USING btree (cliente_id);
CREATE INDEX idx_consulenti_clienti_consulente ON public.scadenze_bandi_consulenti_clienti USING btree (consulente_id);
-- RLS: ABILITATA
--   POLICY "Accesso completo consulenti_clienti" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: -
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_contatti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_contatti (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    cliente_id uuid,
    nome text NOT NULL,
    cognome text NOT NULL,
    email text,
    telefono text,
    ruolo text,
    dipartimento text,
    note text,
    principale boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_contatti ADD CONSTRAINT scadenze_bandi_contatti_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_contatti ADD CONSTRAINT scadenze_bandi_contatti_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
-- Indici (non legati a vincoli)
CREATE INDEX idx_contatti_cliente ON public.scadenze_bandi_contatti USING btree (cliente_id);
-- Trigger
CREATE TRIGGER update_contatti_updated_at BEFORE UPDATE ON public.scadenze_bandi_contatti FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_contract_tracking
-- ======================================================================
CREATE TABLE public.scadenze_bandi_contract_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    contract_document_url text,
    email_sent boolean DEFAULT false,
    email_sent_at timestamp with time zone,
    email_sent_to text,
    email_message_id text,
    email_delivery_status text DEFAULT 'PENDING'::text,
    email_delivery_error text,
    signed_contract_received boolean DEFAULT false,
    signed_contract_received_at timestamp with time zone,
    signed_contract_storage_path text,
    signed_contract_notes text,
    reminder_sent_count integer DEFAULT 0,
    last_reminder_sent_at timestamp with time zone,
    reminder_interval_days integer DEFAULT 7,
    overall_status text DEFAULT 'DRAFT'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_contract_tracking ADD CONSTRAINT scadenze_bandi_contract_tracking_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_contract_tracking ADD CONSTRAINT scadenze_bandi_contract_tracking_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id);
ALTER TABLE ONLY public.scadenze_bandi_contract_tracking ADD CONSTRAINT scadenze_bandi_contract_tracking_email_delivery_status_check CHECK ((email_delivery_status = ANY (ARRAY['PENDING'::text, 'SENT'::text, 'DELIVERED'::text, 'BOUNCED'::text, 'FAILED'::text])));
ALTER TABLE ONLY public.scadenze_bandi_contract_tracking ADD CONSTRAINT scadenze_bandi_contract_tracking_entity_type_check CHECK ((entity_type = ANY (ARRAY['PROGETTO'::text, 'CONTRATTO_EVOLVI'::text])));
ALTER TABLE ONLY public.scadenze_bandi_contract_tracking ADD CONSTRAINT scadenze_bandi_contract_tracking_overall_status_check CHECK ((overall_status = ANY (ARRAY['DRAFT'::text, 'SENT'::text, 'DELIVERED'::text, 'REMINDED'::text, 'SIGNED_RECEIVED'::text, 'COMPLETED'::text, 'FAILED'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_tracking_cliente ON public.scadenze_bandi_contract_tracking USING btree (cliente_id);
CREATE INDEX idx_tracking_entity ON public.scadenze_bandi_contract_tracking USING btree (entity_type, entity_id);
CREATE INDEX idx_tracking_status ON public.scadenze_bandi_contract_tracking USING btree (overall_status);
-- Trigger
CREATE TRIGGER trigger_updated_at_scadenze_bandi_contract_tracking BEFORE UPDATE ON public.scadenze_bandi_contract_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_contratti_evolvi
-- ======================================================================
CREATE TABLE public.scadenze_bandi_contratti_evolvi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    numero_contratto text,
    tipo_contratto text DEFAULT 'EVOLVI'::text,
    data_contratto date,
    data_inizio date,
    data_fine date,
    importo_annuale numeric,
    importo_totale numeric,
    modalita_pagamento text,
    template_name text DEFAULT 'MODELLO CONTRATTO EVOLVI'::text,
    contract_word_id text,
    contract_word_url text,
    contract_pdf_id text,
    contract_pdf_url text,
    stato text DEFAULT 'bozza'::text NOT NULL,
    approvato_da text,
    approvato_il timestamp with time zone,
    inviato_a_email text,
    inviato_il timestamp with time zone,
    firmato_il timestamp with time zone,
    rinnovo_automatico boolean DEFAULT false,
    contratto_rinnovato_id uuid,
    note text,
    creato_da text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_contratti_evolvi ADD CONSTRAINT scadenze_bandi_contratti_evolvi_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_contratti_evolvi ADD CONSTRAINT scadenze_bandi_contratti_evolvi_numero_contratto_key UNIQUE (numero_contratto);
ALTER TABLE ONLY public.scadenze_bandi_contratti_evolvi ADD CONSTRAINT scadenze_bandi_contratti_evolvi_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id);
ALTER TABLE ONLY public.scadenze_bandi_contratti_evolvi ADD CONSTRAINT scadenze_bandi_contratti_evolvi_contratto_rinnovato_id_fkey FOREIGN KEY (contratto_rinnovato_id) REFERENCES scadenze_bandi_contratti_evolvi(id);
ALTER TABLE ONLY public.scadenze_bandi_contratti_evolvi ADD CONSTRAINT scadenze_bandi_contratti_evolvi_modalita_pagamento_check CHECK ((modalita_pagamento = ANY (ARRAY['mensile'::text, 'trimestrale'::text, 'semestrale'::text, 'annuale'::text])));
ALTER TABLE ONLY public.scadenze_bandi_contratti_evolvi ADD CONSTRAINT scadenze_bandi_contratti_evolvi_stato_check CHECK ((stato = ANY (ARRAY['bozza'::text, 'in_revisione'::text, 'approvato'::text, 'inviato'::text, 'firmato'::text, 'attivo'::text, 'scaduto'::text, 'annullato'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_contratti_evolvi_cliente ON public.scadenze_bandi_contratti_evolvi USING btree (cliente_id);
CREATE INDEX idx_contratti_evolvi_stato ON public.scadenze_bandi_contratti_evolvi USING btree (stato);
-- Trigger
CREATE TRIGGER trigger_generate_numero_contratto_evolvi BEFORE INSERT ON public.scadenze_bandi_contratti_evolvi FOR EACH ROW WHEN ((new.numero_contratto IS NULL)) EXECUTE FUNCTION generate_numero_contratto_evolvi();
CREATE TRIGGER trigger_updated_at_scadenze_bandi_contratti_evolvi BEFORE UPDATE ON public.scadenze_bandi_contratti_evolvi FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_contributi_ottenuti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_contributi_ottenuti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    progetto_id uuid,
    anno_competenza integer NOT NULL,
    bando_id uuid,
    bando_denominazione_manuale text,
    ente_erogatore text,
    forma_contributo contributo_forma DEFAULT 'FONDO_PERDUTO'::contributo_forma NOT NULL,
    importo_progetto numeric(15,2),
    importo_contributo numeric(15,2),
    esl numeric(15,2),
    intensita_aiuto_pct numeric(5,2),
    regime_aiuto text,
    rna_codice_concessione text,
    rna_url text,
    data_concessione date,
    data_erogazione date,
    stato contributo_stato DEFAULT 'AMMESSO'::contributo_stato NOT NULL,
    note text,
    origine contributo_origine DEFAULT 'MANUALE'::contributo_origine NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_contributi_ottenuti ADD CONSTRAINT scadenze_bandi_contributi_ottenuti_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_contributi_ottenuti ADD CONSTRAINT scadenze_bandi_contributi_ottenuti_bando_id_fkey FOREIGN KEY (bando_id) REFERENCES scadenze_bandi_bandi(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.scadenze_bandi_contributi_ottenuti ADD CONSTRAINT scadenze_bandi_contributi_ottenuti_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_contributi_ottenuti ADD CONSTRAINT scadenze_bandi_contributi_ottenuti_progetto_id_fkey FOREIGN KEY (progetto_id) REFERENCES scadenze_bandi_progetti(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.scadenze_bandi_contributi_ottenuti ADD CONSTRAINT chk_contributi_anno_competenza CHECK (((anno_competenza >= 1990) AND (anno_competenza <= 2100)));
ALTER TABLE ONLY public.scadenze_bandi_contributi_ottenuti ADD CONSTRAINT chk_contributi_bando_presente CHECK (((bando_id IS NOT NULL) OR (bando_denominazione_manuale IS NOT NULL)));
-- Indici (non legati a vincoli)
CREATE INDEX idx_contributi_bando ON public.scadenze_bandi_contributi_ottenuti USING btree (bando_id);
CREATE INDEX idx_contributi_cliente ON public.scadenze_bandi_contributi_ottenuti USING btree (cliente_id);
CREATE INDEX idx_contributi_cliente_anno ON public.scadenze_bandi_contributi_ottenuti USING btree (cliente_id, anno_competenza DESC);
CREATE INDEX idx_contributi_forma ON public.scadenze_bandi_contributi_ottenuti USING btree (forma_contributo);
CREATE INDEX idx_contributi_stato ON public.scadenze_bandi_contributi_ottenuti USING btree (stato);
CREATE UNIQUE INDEX uq_contributi_progetto_id ON public.scadenze_bandi_contributi_ottenuti USING btree (progetto_id) WHERE (progetto_id IS NOT NULL);
-- Trigger
CREATE TRIGGER trg_contributi_updated_at BEFORE UPDATE ON public.scadenze_bandi_contributi_ottenuti FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_corsi_formativi
-- ======================================================================
CREATE TABLE public.scadenze_bandi_corsi_formativi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    piano_formativo_id uuid,
    titolo character varying(500) NOT NULL,
    area_tematica character varying(200),
    modalita character varying(50),
    ore_durata numeric(5,1),
    data_inizio date,
    data_fine date,
    sede character varying(500),
    ente_erogatore character varying(300),
    docente character varying(300),
    numero_partecipanti integer,
    stato character varying(30) DEFAULT 'PIANIFICATO'::character varying,
    attestato_rilasciato boolean DEFAULT false,
    costo_totale numeric(10,2),
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_corsi_formativi ADD CONSTRAINT scadenze_bandi_corsi_formativi_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_corsi_formativi ADD CONSTRAINT scadenze_bandi_corsi_formativi_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_corsi_formativi ADD CONSTRAINT scadenze_bandi_corsi_formativi_piano_formativo_id_fkey FOREIGN KEY (piano_formativo_id) REFERENCES scadenze_bandi_piani_formativi(id);
ALTER TABLE ONLY public.scadenze_bandi_corsi_formativi ADD CONSTRAINT scadenze_bandi_corsi_formativi_modalita_check CHECK (((modalita)::text = ANY ((ARRAY['AULA'::character varying, 'ONLINE_SINCRONA'::character varying, 'ONLINE_ASINCRONA'::character varying, 'BLENDED'::character varying, 'AFFIANCAMENTO'::character varying])::text[])));
ALTER TABLE ONLY public.scadenze_bandi_corsi_formativi ADD CONSTRAINT scadenze_bandi_corsi_formativi_stato_check CHECK (((stato)::text = ANY ((ARRAY['PIANIFICATO'::character varying, 'IN_CORSO'::character varying, 'CONCLUSO'::character varying, 'ANNULLATO'::character varying])::text[])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_corsi_formativi_cliente_data ON public.scadenze_bandi_corsi_formativi USING btree (cliente_id, data_inizio DESC);
CREATE INDEX idx_corsi_formativi_piano ON public.scadenze_bandi_corsi_formativi USING btree (piano_formativo_id);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_documenti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_documenti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bando_id uuid,
    nome_file text NOT NULL,
    nome_originale text,
    tipo_documento text,
    formato_file text,
    dimensione_bytes bigint,
    url_file text,
    descrizione text,
    caricato_da text,
    versione integer DEFAULT 1,
    pubblico boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    categoria text DEFAULT 'allegato'::text
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_documenti ADD CONSTRAINT scadenze_bandi_documenti_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_documenti ADD CONSTRAINT scadenze_bandi_documenti_bando_id_fkey FOREIGN KEY (bando_id) REFERENCES scadenze_bandi_bandi(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_documenti ADD CONSTRAINT scadenze_bandi_documenti_categoria_check CHECK ((categoria = ANY (ARRAY['normativa'::text, 'allegato'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_documenti_categoria ON public.scadenze_bandi_documenti USING btree (categoria);
CREATE INDEX idx_documenti_tipo ON public.scadenze_bandi_documenti USING btree (tipo_documento);
-- Trigger
CREATE TRIGGER trigger_update_documenti_updated_at BEFORE UPDATE ON public.scadenze_bandi_documenti FOR EACH ROW EXECUTE FUNCTION update_template_scadenze_updated_at();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_documenti_amministrativi
-- ======================================================================
CREATE TABLE public.scadenze_bandi_documenti_amministrativi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    tipo_documento text NOT NULL,
    categoria text NOT NULL,
    nome_file text NOT NULL,
    nome_originale text NOT NULL,
    dimensione_bytes integer,
    mime_type text,
    storage_path text NOT NULL,
    descrizione text,
    data_documento date,
    data_scadenza date,
    verificato boolean DEFAULT false,
    verificato_da text,
    verificato_il timestamp with time zone,
    tags text[] DEFAULT '{}'::text[],
    uploaded_at timestamp with time zone DEFAULT now(),
    uploaded_by text,
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_documenti_amministrativi ADD CONSTRAINT scadenze_bandi_documenti_amministrativi_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_documenti_amministrativi ADD CONSTRAINT scadenze_bandi_documenti_amministrativi_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_documenti_amministrativi ADD CONSTRAINT scadenze_bandi_documenti_amministrativi_categoria_check CHECK ((categoria = ANY (ARRAY['SOCIETARI'::text, 'FISCALI'::text, 'IDENTITA'::text, 'CERTIFICAZIONI'::text, 'BILANCI'::text, 'ALTRO'::text])));
ALTER TABLE ONLY public.scadenze_bandi_documenti_amministrativi ADD CONSTRAINT scadenze_bandi_documenti_amministrativi_tipo_documento_check CHECK ((tipo_documento = ANY (ARRAY['VISURA_CAMERALE'::text, 'ATTO_COSTITUTIVO'::text, 'STATUTO'::text, 'BILANCIO'::text, 'DOCUMENTO_IDENTITA'::text, 'CODICE_FISCALE'::text, 'CERT_PARTITA_IVA'::text, 'CERT_ANTIMAFIA'::text, 'DURC'::text, 'ISCRIZIONE_RUNTS'::text, 'ALTRO'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_doc_amm_cliente ON public.scadenze_bandi_documenti_amministrativi USING btree (cliente_id);
CREATE INDEX idx_doc_amm_tipo ON public.scadenze_bandi_documenti_amministrativi USING btree (tipo_documento);
-- Trigger
CREATE TRIGGER trigger_updated_at_scadenze_bandi_documenti_amministrativi BEFORE UPDATE ON public.scadenze_bandi_documenti_amministrativi FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_documenti_bando
-- ======================================================================
CREATE TABLE public.scadenze_bandi_documenti_bando (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    bando_id uuid NOT NULL,
    nome_documento text NOT NULL,
    path_storage text NOT NULL,
    dimensione_bytes integer,
    tipo_mime text,
    tipo_documento text,
    uploaded_by text,
    uploaded_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_documenti_bando ADD CONSTRAINT scadenze_bandi_documenti_bando_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_documenti_bando ADD CONSTRAINT scadenze_bandi_documenti_bando_bando_id_fkey FOREIGN KEY (bando_id) REFERENCES scadenze_bandi_bandi(id) ON DELETE CASCADE;
-- Indici (non legati a vincoli)
CREATE INDEX idx_documenti_bando ON public.scadenze_bandi_documenti_bando USING btree (bando_id);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_documenti_cliente
-- ======================================================================
CREATE TABLE public.scadenze_bandi_documenti_cliente (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    cliente_id uuid,
    tipo_documento text NOT NULL,
    nome_file text,
    path_file text,
    scadenza_validita date,
    certificato boolean DEFAULT false,
    anno_riferimento integer,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_documenti_cliente ADD CONSTRAINT scadenze_bandi_documenti_cliente_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_documenti_cliente ADD CONSTRAINT scadenze_bandi_documenti_cliente_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
-- Indici (non legati a vincoli)
CREATE INDEX idx_documenti_cliente ON public.scadenze_bandi_documenti_cliente USING btree (cliente_id);
-- Trigger
CREATE TRIGGER update_documenti_updated_at BEFORE UPDATE ON public.scadenze_bandi_documenti_cliente FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_documenti_formazione
-- ======================================================================
CREATE TABLE public.scadenze_bandi_documenti_formazione (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    categoria text DEFAULT 'ALTRO'::text NOT NULL,
    nome_file text NOT NULL,
    descrizione text,
    storage_path text NOT NULL,
    file_size bigint,
    mime_type text,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    uploaded_by uuid,
    piano_id uuid,
    corso_id uuid
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_documenti_formazione ADD CONSTRAINT scadenze_bandi_documenti_formazione_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_documenti_formazione ADD CONSTRAINT scadenze_bandi_documenti_formazione_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_documenti_formazione ADD CONSTRAINT scadenze_bandi_documenti_formazione_corso_id_fkey FOREIGN KEY (corso_id) REFERENCES scadenze_bandi_corsi_formativi(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.scadenze_bandi_documenti_formazione ADD CONSTRAINT scadenze_bandi_documenti_formazione_piano_id_fkey FOREIGN KEY (piano_id) REFERENCES scadenze_bandi_piani_formativi(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.scadenze_bandi_documenti_formazione ADD CONSTRAINT scadenze_bandi_documenti_formazione_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.scadenze_bandi_documenti_formazione ADD CONSTRAINT scadenze_bandi_documenti_formazione_categoria_check CHECK ((categoria = ANY (ARRAY['REGISTRO_PRESENZE'::text, 'ATTESTATO'::text, 'VERBALE'::text, 'PROGRAMMA'::text, 'RENDICONTAZIONE'::text, 'PROGETTO_FORMATIVO'::text, 'MATERIALE_DIDATTICO'::text, 'COMUNICAZIONI_FONDO'::text, 'ALTRO'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_documenti_formazione_cliente ON public.scadenze_bandi_documenti_formazione USING btree (cliente_id);
CREATE INDEX idx_documenti_formazione_corso ON public.scadenze_bandi_documenti_formazione USING btree (corso_id);
CREATE INDEX idx_documenti_formazione_piano ON public.scadenze_bandi_documenti_formazione USING btree (piano_id);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_documenti_progetto
-- ======================================================================
CREATE TABLE public.scadenze_bandi_documenti_progetto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    progetto_id uuid NOT NULL,
    nome_file text NOT NULL,
    nome_originale text NOT NULL,
    tipo_documento text NOT NULL,
    formato_file text,
    dimensione_bytes bigint,
    url_file text NOT NULL,
    categoria text DEFAULT 'proprio'::text,
    sal_riferimento integer,
    stato_compilazione text DEFAULT 'da_compilare'::text,
    bando_documento_origine_id uuid,
    ereditato_da_bando boolean DEFAULT false,
    auto_compilazione_completata boolean DEFAULT false,
    campi_auto_compilati jsonb,
    data_ultima_auto_compilazione timestamp with time zone,
    descrizione text,
    note_compilazione text,
    caricato_da text,
    compilato_da text,
    approvato_da text,
    data_approvazione timestamp with time zone,
    versione integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    nome_file_compilato text,
    auto_compilazione_status text,
    file_path text,
    placeholders_compilati jsonb,
    google_drive_id text,
    google_drive_url text,
    google_drive_modified timestamp with time zone,
    last_checked timestamp with time zone,
    has_changes boolean DEFAULT false
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_documenti_progetto ADD CONSTRAINT scadenze_bandi_documenti_progetto_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_documenti_progetto ADD CONSTRAINT scadenze_bandi_documenti_proget_bando_documento_origine_id_fkey FOREIGN KEY (bando_documento_origine_id) REFERENCES scadenze_bandi_documenti(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.scadenze_bandi_documenti_progetto ADD CONSTRAINT scadenze_bandi_documenti_progetto_progetto_id_fkey FOREIGN KEY (progetto_id) REFERENCES scadenze_bandi_progetti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_documenti_progetto ADD CONSTRAINT scadenze_bandi_documenti_progetto_categoria_check CHECK ((categoria = ANY (ARRAY['ereditato'::text, 'proprio'::text, 'compilato'::text])));
ALTER TABLE ONLY public.scadenze_bandi_documenti_progetto ADD CONSTRAINT scadenze_bandi_documenti_progetto_stato_compilazione_check CHECK ((stato_compilazione = ANY (ARRAY['da_compilare'::text, 'in_compilazione'::text, 'compilato'::text, 'approvato'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_documenti_progetto_categoria ON public.scadenze_bandi_documenti_progetto USING btree (categoria);
CREATE INDEX idx_documenti_progetto_ereditato ON public.scadenze_bandi_documenti_progetto USING btree (ereditato_da_bando);
CREATE INDEX idx_documenti_progetto_google_drive_id ON public.scadenze_bandi_documenti_progetto USING btree (google_drive_id);
CREATE INDEX idx_documenti_progetto_origine ON public.scadenze_bandi_documenti_progetto USING btree (bando_documento_origine_id);
CREATE INDEX idx_documenti_progetto_progetto_id ON public.scadenze_bandi_documenti_progetto USING btree (progetto_id);
CREATE INDEX idx_documenti_progetto_stato ON public.scadenze_bandi_documenti_progetto USING btree (stato_compilazione);
-- Trigger
CREATE TRIGGER trigger_update_documenti_progetto_timestamp BEFORE UPDATE ON public.scadenze_bandi_documenti_progetto FOR EACH ROW EXECUTE FUNCTION update_documenti_progetto_timestamp();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_email_accounts
-- ======================================================================
CREATE TABLE public.scadenze_bandi_email_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    email_address text NOT NULL,
    provider_type text DEFAULT 'generic'::text NOT NULL,
    imap_server text NOT NULL,
    imap_port integer DEFAULT 993 NOT NULL,
    imap_secure boolean DEFAULT true NOT NULL,
    smtp_server text NOT NULL,
    smtp_port integer DEFAULT 587 NOT NULL,
    smtp_secure boolean DEFAULT true NOT NULL,
    username text NOT NULL,
    encrypted_password text NOT NULL,
    oauth_refresh_token text,
    oauth_access_token text,
    oauth_expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    last_sync timestamp with time zone,
    sync_status text DEFAULT 'pending'::text,
    sync_error text,
    sync_enabled boolean DEFAULT true NOT NULL,
    sync_folders text[] DEFAULT ARRAY['INBOX'::text],
    max_messages_per_folder integer DEFAULT 100,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_email_accounts ADD CONSTRAINT scadenze_bandi_email_accounts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_email_accounts ADD CONSTRAINT scadenze_bandi_email_accounts_user_id_email_address_key UNIQUE (user_id, email_address);
ALTER TABLE ONLY public.scadenze_bandi_email_accounts ADD CONSTRAINT scadenze_bandi_email_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES scadenze_bandi_utenti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_email_accounts ADD CONSTRAINT scadenze_bandi_email_accounts_provider_type_check CHECK ((provider_type = ANY (ARRAY['aruba'::text, 'gmail'::text, 'outlook'::text, 'generic'::text])));
ALTER TABLE ONLY public.scadenze_bandi_email_accounts ADD CONSTRAINT scadenze_bandi_email_accounts_sync_status_check CHECK ((sync_status = ANY (ARRAY['pending'::text, 'syncing'::text, 'success'::text, 'error'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_email_accounts_active ON public.scadenze_bandi_email_accounts USING btree (is_active);
CREATE INDEX idx_scadenze_bandi_email_accounts_provider ON public.scadenze_bandi_email_accounts USING btree (provider_type);
CREATE INDEX idx_scadenze_bandi_email_accounts_user_id ON public.scadenze_bandi_email_accounts USING btree (user_id);
-- Trigger
CREATE TRIGGER update_scadenze_bandi_email_accounts_updated_at BEFORE UPDATE ON public.scadenze_bandi_email_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: ABILITATA
--   POLICY "Service role can manage all email accounts" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: -
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_email_attachments
-- ======================================================================
CREATE TABLE public.scadenze_bandi_email_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    filename text NOT NULL,
    content_type text,
    size_bytes integer,
    content bytea,
    storage_path text,
    is_inline boolean DEFAULT false NOT NULL,
    content_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_email_attachments ADD CONSTRAINT scadenze_bandi_email_attachments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_email_attachments ADD CONSTRAINT scadenze_bandi_email_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES scadenze_bandi_email_messages(id) ON DELETE CASCADE;
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_email_attachments_message ON public.scadenze_bandi_email_attachments USING btree (message_id);
-- RLS: ABILITATA
--   POLICY "Service role can access all email attachments" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: -
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_email_folders
-- ======================================================================
CREATE TABLE public.scadenze_bandi_email_folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    name text NOT NULL,
    full_path text NOT NULL,
    folder_type text DEFAULT 'custom'::text,
    total_messages integer DEFAULT 0,
    unread_messages integer DEFAULT 0,
    last_sync timestamp with time zone,
    uid_validity bigint,
    highest_uid bigint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_email_folders ADD CONSTRAINT scadenze_bandi_email_folders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_email_folders ADD CONSTRAINT scadenze_bandi_email_folders_account_id_full_path_key UNIQUE (account_id, full_path);
ALTER TABLE ONLY public.scadenze_bandi_email_folders ADD CONSTRAINT scadenze_bandi_email_folders_account_id_fkey FOREIGN KEY (account_id) REFERENCES scadenze_bandi_email_accounts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_email_folders ADD CONSTRAINT scadenze_bandi_email_folders_folder_type_check CHECK ((folder_type = ANY (ARRAY['inbox'::text, 'sent'::text, 'drafts'::text, 'trash'::text, 'custom'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_email_folders_account ON public.scadenze_bandi_email_folders USING btree (account_id);
CREATE INDEX idx_scadenze_bandi_email_folders_type ON public.scadenze_bandi_email_folders USING btree (folder_type);
-- Trigger
CREATE TRIGGER update_scadenze_bandi_email_folders_updated_at BEFORE UPDATE ON public.scadenze_bandi_email_folders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: ABILITATA
--   POLICY "Service role can access all email folders" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: -
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_email_links
-- ======================================================================
CREATE TABLE public.scadenze_bandi_email_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    link_type text DEFAULT 'manual'::text,
    confidence_score numeric(3,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_email_links ADD CONSTRAINT scadenze_bandi_email_links_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_email_links ADD CONSTRAINT scadenze_bandi_email_links_message_id_entity_type_entity_id_key UNIQUE (message_id, entity_type, entity_id);
ALTER TABLE ONLY public.scadenze_bandi_email_links ADD CONSTRAINT scadenze_bandi_email_links_message_id_fkey FOREIGN KEY (message_id) REFERENCES scadenze_bandi_email_messages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_email_links ADD CONSTRAINT scadenze_bandi_email_links_entity_type_check CHECK ((entity_type = ANY (ARRAY['cliente'::text, 'bando'::text, 'progetto'::text, 'scadenza'::text])));
ALTER TABLE ONLY public.scadenze_bandi_email_links ADD CONSTRAINT scadenze_bandi_email_links_link_type_check CHECK ((link_type = ANY (ARRAY['manual'::text, 'auto_domain'::text, 'auto_content'::text, 'auto_sender'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_email_links_entity ON public.scadenze_bandi_email_links USING btree (entity_type, entity_id);
CREATE INDEX idx_scadenze_bandi_email_links_message ON public.scadenze_bandi_email_links USING btree (message_id);
CREATE INDEX idx_scadenze_bandi_email_links_user ON public.scadenze_bandi_email_links USING btree (user_id);
-- RLS: ABILITATA
--   POLICY "Service role can manage all email links" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: -
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_email_messages
-- ======================================================================
CREATE TABLE public.scadenze_bandi_email_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    folder_id uuid NOT NULL,
    message_id text NOT NULL,
    uid bigint NOT NULL,
    thread_id text,
    subject text,
    from_address text NOT NULL,
    from_name text,
    to_addresses text[],
    cc_addresses text[],
    bcc_addresses text[],
    reply_to_address text,
    body_text text,
    body_html text,
    body_preview text,
    date_sent timestamp with time zone NOT NULL,
    date_received timestamp with time zone DEFAULT now() NOT NULL,
    size_bytes integer,
    is_read boolean DEFAULT false NOT NULL,
    is_flagged boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    is_draft boolean DEFAULT false NOT NULL,
    is_answered boolean DEFAULT false NOT NULL,
    has_attachments boolean DEFAULT false NOT NULL,
    attachments_count integer DEFAULT 0,
    importance text DEFAULT 'normal'::text,
    spam_score numeric(3,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_email_messages ADD CONSTRAINT scadenze_bandi_email_messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_email_messages ADD CONSTRAINT scadenze_bandi_email_messages_account_id_folder_id_uid_key UNIQUE (account_id, folder_id, uid);
ALTER TABLE ONLY public.scadenze_bandi_email_messages ADD CONSTRAINT scadenze_bandi_email_messages_account_id_message_id_key UNIQUE (account_id, message_id);
ALTER TABLE ONLY public.scadenze_bandi_email_messages ADD CONSTRAINT scadenze_bandi_email_messages_account_id_fkey FOREIGN KEY (account_id) REFERENCES scadenze_bandi_email_accounts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_email_messages ADD CONSTRAINT scadenze_bandi_email_messages_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES scadenze_bandi_email_folders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_email_messages ADD CONSTRAINT scadenze_bandi_email_messages_importance_check CHECK ((importance = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_email_messages_account ON public.scadenze_bandi_email_messages USING btree (account_id);
CREATE INDEX idx_scadenze_bandi_email_messages_date ON public.scadenze_bandi_email_messages USING btree (date_received DESC);
CREATE INDEX idx_scadenze_bandi_email_messages_folder ON public.scadenze_bandi_email_messages USING btree (folder_id);
CREATE INDEX idx_scadenze_bandi_email_messages_from ON public.scadenze_bandi_email_messages USING btree (from_address);
CREATE INDEX idx_scadenze_bandi_email_messages_read ON public.scadenze_bandi_email_messages USING btree (is_read);
CREATE INDEX idx_scadenze_bandi_email_messages_subject ON public.scadenze_bandi_email_messages USING gin (to_tsvector('italian'::regconfig, subject));
CREATE INDEX idx_scadenze_bandi_email_messages_thread ON public.scadenze_bandi_email_messages USING btree (thread_id) WHERE (thread_id IS NOT NULL);
CREATE INDEX idx_scadenze_bandi_email_messages_uid ON public.scadenze_bandi_email_messages USING btree (account_id, folder_id, uid);
-- Trigger
CREATE TRIGGER update_scadenze_bandi_email_messages_updated_at BEFORE UPDATE ON public.scadenze_bandi_email_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: ABILITATA
--   POLICY "Service role can access all email messages" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: -
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_email_queue
-- ======================================================================
CREATE TABLE public.scadenze_bandi_email_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    to_email text NOT NULL,
    subject text NOT NULL,
    html_content text NOT NULL,
    notification_type text NOT NULL,
    priority text DEFAULT 'normal'::text,
    scheduled_for timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'pending'::text,
    error_message text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_email_queue ADD CONSTRAINT scadenze_bandi_email_queue_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_email_queue ADD CONSTRAINT scadenze_bandi_email_queue_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text])));
ALTER TABLE ONLY public.scadenze_bandi_email_queue ADD CONSTRAINT scadenze_bandi_email_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_email_queue_priority ON public.scadenze_bandi_email_queue USING btree (priority, created_at);
CREATE INDEX idx_scadenze_bandi_email_queue_status ON public.scadenze_bandi_email_queue USING btree (status, scheduled_for);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_email_sync_logs
-- ======================================================================
CREATE TABLE public.scadenze_bandi_email_sync_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    sync_type text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    status text DEFAULT 'running'::text NOT NULL,
    folders_synced integer DEFAULT 0,
    messages_new integer DEFAULT 0,
    messages_updated integer DEFAULT 0,
    messages_deleted integer DEFAULT 0,
    error_message text,
    error_details jsonb
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_email_sync_logs ADD CONSTRAINT scadenze_bandi_email_sync_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_email_sync_logs ADD CONSTRAINT scadenze_bandi_email_sync_logs_account_id_fkey FOREIGN KEY (account_id) REFERENCES scadenze_bandi_email_accounts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_email_sync_logs ADD CONSTRAINT scadenze_bandi_email_sync_logs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'error'::text, 'cancelled'::text])));
ALTER TABLE ONLY public.scadenze_bandi_email_sync_logs ADD CONSTRAINT scadenze_bandi_email_sync_logs_sync_type_check CHECK ((sync_type = ANY (ARRAY['full'::text, 'incremental'::text, 'folder'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_email_sync_logs_account ON public.scadenze_bandi_email_sync_logs USING btree (account_id);
CREATE INDEX idx_scadenze_bandi_email_sync_logs_date ON public.scadenze_bandi_email_sync_logs USING btree (started_at DESC);
-- RLS: ABILITATA
--   POLICY "Service role can access all sync logs" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: -
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_eventi_catalogo
-- ======================================================================
CREATE TABLE public.scadenze_bandi_eventi_catalogo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome character varying(100) NOT NULL,
    descrizione text,
    standard boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_eventi_catalogo ADD CONSTRAINT scadenze_bandi_eventi_catalogo_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_eventi_catalogo ADD CONSTRAINT scadenze_bandi_eventi_catalogo_nome_key UNIQUE (nome);
-- Trigger
CREATE TRIGGER update_scadenze_bandi_eventi_catalogo_updated_at BEFORE UPDATE ON public.scadenze_bandi_eventi_catalogo FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: ABILITATA
--   POLICY "Tutti possono leggere eventi catalogo" | PERMISSIVE | ruoli: public | comando: SELECT | USING: true | WITH CHECK: -
--   POLICY "Utenti autenticati possono aggiornare eventi" | PERMISSIVE | ruoli: public | comando: UPDATE | USING: (auth.role() = 'authenticated'::text) | WITH CHECK: -
--   POLICY "Utenti autenticati possono inserire eventi" | PERMISSIVE | ruoli: public | comando: INSERT | USING: - | WITH CHECK: (auth.role() = 'authenticated'::text)
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_evolvi_fatture
-- ======================================================================
CREATE TABLE public.scadenze_bandi_evolvi_fatture (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contratto_id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    numero_fattura text,
    data_fattura date,
    data_scadenza_pagamento date,
    importo_netto numeric NOT NULL,
    importo_iva numeric DEFAULT 0,
    importo_totale numeric NOT NULL,
    periodo_inizio date,
    periodo_fine date,
    stato_pagamento text DEFAULT 'PENDING'::text NOT NULL,
    data_pagamento date,
    metodo_pagamento text,
    riferimento_pagamento text,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_evolvi_fatture ADD CONSTRAINT scadenze_bandi_evolvi_fatture_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_evolvi_fatture ADD CONSTRAINT scadenze_bandi_evolvi_fatture_numero_fattura_key UNIQUE (numero_fattura);
ALTER TABLE ONLY public.scadenze_bandi_evolvi_fatture ADD CONSTRAINT scadenze_bandi_evolvi_fatture_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id);
ALTER TABLE ONLY public.scadenze_bandi_evolvi_fatture ADD CONSTRAINT scadenze_bandi_evolvi_fatture_contratto_id_fkey FOREIGN KEY (contratto_id) REFERENCES scadenze_bandi_contratti_evolvi(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_evolvi_fatture ADD CONSTRAINT scadenze_bandi_evolvi_fatture_stato_pagamento_check CHECK ((stato_pagamento = ANY (ARRAY['PENDING'::text, 'PAID'::text, 'OVERDUE'::text, 'CANCELLED'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_fatture_evolvi_cliente ON public.scadenze_bandi_evolvi_fatture USING btree (cliente_id);
CREATE INDEX idx_fatture_evolvi_contratto ON public.scadenze_bandi_evolvi_fatture USING btree (contratto_id);
CREATE INDEX idx_fatture_evolvi_stato ON public.scadenze_bandi_evolvi_fatture USING btree (stato_pagamento);
-- Trigger
CREATE TRIGGER trigger_generate_numero_fattura_evolvi BEFORE INSERT ON public.scadenze_bandi_evolvi_fatture FOR EACH ROW WHEN ((new.numero_fattura IS NULL)) EXECUTE FUNCTION generate_numero_fattura_evolvi();
CREATE TRIGGER trigger_updated_at_scadenze_bandi_evolvi_fatture BEFORE UPDATE ON public.scadenze_bandi_evolvi_fatture FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_fabbisogno_inserimenti_previsti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_fabbisogno_inserimenti_previsti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rilevazione_id uuid NOT NULL,
    area character varying(200) NOT NULL,
    numero_inserimenti integer,
    periodo character varying(100),
    ordine smallint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_inserimenti_previsti ADD CONSTRAINT scadenze_bandi_fabbisogno_inserimenti_previsti_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_inserimenti_previsti ADD CONSTRAINT scadenze_bandi_fabbisogno_inserimenti_previ_rilevazione_id_fkey FOREIGN KEY (rilevazione_id) REFERENCES scadenze_bandi_fabbisogno_rilevazioni(id) ON DELETE CASCADE;
-- Indici (non legati a vincoli)
CREATE INDEX idx_fabbisogno_ins_rilevazione ON public.scadenze_bandi_fabbisogno_inserimenti_previsti USING btree (rilevazione_id);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_fabbisogno_obblighi_dichiarati
-- ======================================================================
CREATE TABLE public.scadenze_bandi_fabbisogno_obblighi_dichiarati (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rilevazione_id uuid NOT NULL,
    tipo_obbligo character varying(100) NOT NULL,
    stato_dichiarato character varying(30) NOT NULL,
    stato_precompilato character varying(30),
    note text,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_obblighi_dichiarati ADD CONSTRAINT scadenze_bandi_fabbisogno_obblighi_dichiarati_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_obblighi_dichiarati ADD CONSTRAINT scadenze_bandi_fabbisogno_obbli_rilevazione_id_tipo_obbligo_key UNIQUE (rilevazione_id, tipo_obbligo);
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_obblighi_dichiarati ADD CONSTRAINT scadenze_bandi_fabbisogno_obblighi_dichiara_rilevazione_id_fkey FOREIGN KEY (rilevazione_id) REFERENCES scadenze_bandi_fabbisogno_rilevazioni(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_obblighi_dichiarati ADD CONSTRAINT scadenze_bandi_fabbisogno_obblighi_dic_stato_precompilato_check CHECK (((stato_precompilato IS NULL) OR ((stato_precompilato)::text = ANY ((ARRAY['ADEMPIUTO'::character varying, 'DA_RINNOVARE'::character varying, 'NON_SVOLTO'::character varying, 'NON_APPLICABILE'::character varying])::text[]))));
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_obblighi_dichiarati ADD CONSTRAINT scadenze_bandi_fabbisogno_obblighi_dichi_stato_dichiarato_check CHECK (((stato_dichiarato)::text = ANY ((ARRAY['ADEMPIUTO'::character varying, 'DA_RINNOVARE'::character varying, 'NON_SVOLTO'::character varying, 'NON_APPLICABILE'::character varying])::text[])));
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_obblighi_dichiarati ADD CONSTRAINT scadenze_bandi_fabbisogno_obblighi_dichiarat_tipo_obbligo_check CHECK (((tipo_obbligo)::text = ANY ((ARRAY['FORMAZIONE_LAVORATORI_RISCHIO_BASSO'::character varying, 'FORMAZIONE_LAVORATORI_RISCHIO_MEDIO'::character varying, 'FORMAZIONE_LAVORATORI_RISCHIO_ALTO'::character varying, 'RSPP'::character varying, 'DIRIGENTI_SSL'::character varying, 'PREPOSTI'::character varying, 'RLS'::character varying, 'ANTINCENDIO_BASSO'::character varying, 'ANTINCENDIO_MEDIO'::character varying, 'ANTINCENDIO_ALTO'::character varying, 'PRIMO_SOCCORSO'::character varying, 'HACCP'::character varying, 'PRIVACY_GDPR'::character varying, 'ANTIRICICLAGGIO'::character varying, 'RESPONSABILITA_AMMINISTRATIVA_231'::character varying, 'USO_ATTREZZATURE'::character varying, 'ALTRO'::character varying])::text[])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_fabbisogno_obb_rilevazione ON public.scadenze_bandi_fabbisogno_obblighi_dichiarati USING btree (rilevazione_id);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_fabbisogno_popolazione
-- ======================================================================
CREATE TABLE public.scadenze_bandi_fabbisogno_popolazione (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rilevazione_id uuid NOT NULL,
    area character varying(200) NOT NULL,
    numero_dipendenti integer,
    note character varying(500),
    ordine smallint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_popolazione ADD CONSTRAINT scadenze_bandi_fabbisogno_popolazione_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_popolazione ADD CONSTRAINT scadenze_bandi_fabbisogno_popolazione_rilevazione_id_fkey FOREIGN KEY (rilevazione_id) REFERENCES scadenze_bandi_fabbisogno_rilevazioni(id) ON DELETE CASCADE;
-- Indici (non legati a vincoli)
CREATE INDEX idx_fabbisogno_pop_rilevazione ON public.scadenze_bandi_fabbisogno_popolazione USING btree (rilevazione_id);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_fabbisogno_rilevazioni
-- ======================================================================
CREATE TABLE public.scadenze_bandi_fabbisogno_rilevazioni (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    titolo character varying(200) NOT NULL,
    anno_riferimento integer NOT NULL,
    token character varying(128) DEFAULT encode(gen_random_bytes(32), 'hex'::text) NOT NULL,
    token_scadenza timestamp with time zone DEFAULT (now() + '90 days'::interval),
    stato character varying(30) DEFAULT 'BOZZA'::character varying NOT NULL,
    data_invio timestamp with time zone,
    data_prima_apertura timestamp with time zone,
    data_ultima_modifica timestamp with time zone,
    data_completamento timestamp with time zone,
    ultimo_step_visitato smallint DEFAULT 0,
    referente_nome character varying(200),
    referente_ruolo character varying(60),
    ateco_dichiarato character varying(50),
    ateco_descrizione_dichiarata text,
    ccnl_dichiarato character varying(300),
    numero_dipendenti_dichiarato integer,
    popolazione_target text[],
    popolazione_target_specifica text,
    piano_formazione_esistente character varying(40),
    obiettivi_strategici text,
    cambiamenti_previsti text[],
    scadenze_imminenti character varying(20),
    altri_obblighi_settore text,
    aree_gap_competenze text[],
    altri_fabbisogni text,
    livello_competenze_attuali smallint,
    figure_prioritarie text[],
    modalita_erogazione text[],
    budget_annuo character varying(40),
    vincoli_organizzativi text[],
    picchi_operativita integer[],
    orizzonte_temporale character varying(40),
    strategicita_formazione smallint,
    misurazione_efficacia text[],
    note_libere text,
    inviata_da_utente_id uuid,
    ip_compilazione inet,
    user_agent_compilazione text,
    risposte_extra jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_rilevazioni ADD CONSTRAINT scadenze_bandi_fabbisogno_rilevazioni_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_rilevazioni ADD CONSTRAINT scadenze_bandi_fabbisogno_rilevazioni_token_key UNIQUE (token);
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_rilevazioni ADD CONSTRAINT scadenze_bandi_fabbisogno_rilevazioni_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_rilevazioni ADD CONSTRAINT scadenze_bandi_fabbisogno_rilevazioni_inviata_da_utente_id_fkey FOREIGN KEY (inviata_da_utente_id) REFERENCES scadenze_bandi_utenti(id);
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_rilevazioni ADD CONSTRAINT scadenze_bandi_fabbisogno_rile_livello_competenze_attuali_check CHECK (((livello_competenze_attuali IS NULL) OR ((livello_competenze_attuali >= 1) AND (livello_competenze_attuali <= 5))));
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_rilevazioni ADD CONSTRAINT scadenze_bandi_fabbisogno_rile_piano_formazione_esistente_check CHECK (((piano_formazione_esistente IS NULL) OR ((piano_formazione_esistente)::text = ANY ((ARRAY['SI_AGGIORNATO'::character varying, 'SI_NON_AGGIORNATO'::character varying, 'NO_CASO_PER_CASO'::character varying, 'NO_PRIMA_VOLTA'::character varying])::text[]))));
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_rilevazioni ADD CONSTRAINT scadenze_bandi_fabbisogno_rilevaz_strategicita_formazione_check CHECK (((strategicita_formazione IS NULL) OR ((strategicita_formazione >= 1) AND (strategicita_formazione <= 5))));
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_rilevazioni ADD CONSTRAINT scadenze_bandi_fabbisogno_rilevazioni_budget_annuo_check CHECK (((budget_annuo IS NULL) OR ((budget_annuo)::text = ANY ((ARRAY['FINO_3000'::character varying, '3001_10000'::character varying, '10001_30000'::character varying, 'OLTRE_30000'::character varying, 'NON_DEFINITO'::character varying])::text[]))));
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_rilevazioni ADD CONSTRAINT scadenze_bandi_fabbisogno_rilevazioni_orizzonte_temporale_check CHECK (((orizzonte_temporale IS NULL) OR ((orizzonte_temporale)::text = ANY ((ARRAY['ENTRO_3_MESI'::character varying, 'ENTRO_6_MESI'::character varying, 'ENTRO_FINE_ANNO'::character varying, 'PLURIENNALE'::character varying])::text[]))));
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_rilevazioni ADD CONSTRAINT scadenze_bandi_fabbisogno_rilevazioni_picchi_operativita_check CHECK (((picchi_operativita IS NULL) OR (picchi_operativita <@ ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])));
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_rilevazioni ADD CONSTRAINT scadenze_bandi_fabbisogno_rilevazioni_referente_ruolo_check CHECK (((referente_ruolo IS NULL) OR ((referente_ruolo)::text = ANY ((ARRAY['TITOLARE_AMMINISTRATORE'::character varying, 'DIRETTORE_GENERALE'::character varying, 'HR_MANAGER'::character varying, 'RESPONSABILE_FUNZIONE'::character varying, 'RESPONSABILE_STABILIMENTO'::character varying, 'ALTRO'::character varying])::text[]))));
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_rilevazioni ADD CONSTRAINT scadenze_bandi_fabbisogno_rilevazioni_scadenze_imminenti_check CHECK (((scadenze_imminenti IS NULL) OR ((scadenze_imminenti)::text = ANY ((ARRAY['SI'::character varying, 'NO'::character varying, 'DA_VERIFICARE'::character varying])::text[]))));
ALTER TABLE ONLY public.scadenze_bandi_fabbisogno_rilevazioni ADD CONSTRAINT scadenze_bandi_fabbisogno_rilevazioni_stato_check CHECK (((stato)::text = ANY ((ARRAY['BOZZA'::character varying, 'INVIATA'::character varying, 'IN_COMPILAZIONE'::character varying, 'COMPLETATA'::character varying, 'SCADUTA'::character varying, 'ARCHIVIATA'::character varying])::text[])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_fabbisogno_aree_gap ON public.scadenze_bandi_fabbisogno_rilevazioni USING gin (aree_gap_competenze);
CREATE INDEX idx_fabbisogno_cambiamenti ON public.scadenze_bandi_fabbisogno_rilevazioni USING gin (cambiamenti_previsti);
CREATE INDEX idx_fabbisogno_figure_prioritarie ON public.scadenze_bandi_fabbisogno_rilevazioni USING gin (figure_prioritarie);
CREATE INDEX idx_fabbisogno_misurazione ON public.scadenze_bandi_fabbisogno_rilevazioni USING gin (misurazione_efficacia);
CREATE INDEX idx_fabbisogno_modalita ON public.scadenze_bandi_fabbisogno_rilevazioni USING gin (modalita_erogazione);
CREATE INDEX idx_fabbisogno_pop_target ON public.scadenze_bandi_fabbisogno_rilevazioni USING gin (popolazione_target);
CREATE INDEX idx_fabbisogno_riv_anno ON public.scadenze_bandi_fabbisogno_rilevazioni USING btree (cliente_id, anno_riferimento);
CREATE INDEX idx_fabbisogno_riv_cliente_stato ON public.scadenze_bandi_fabbisogno_rilevazioni USING btree (cliente_id, stato);
CREATE INDEX idx_fabbisogno_riv_token ON public.scadenze_bandi_fabbisogno_rilevazioni USING btree (token);
CREATE INDEX idx_fabbisogno_vincoli ON public.scadenze_bandi_fabbisogno_rilevazioni USING gin (vincoli_organizzativi);
-- Trigger
CREATE TRIGGER trg_fabbisogno_riv_updated_at BEFORE UPDATE ON public.scadenze_bandi_fabbisogno_rilevazioni FOR EACH ROW EXECUTE FUNCTION update_fabbisogno_rilevazione_timestamp();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_fondi_interprofessionali
-- ======================================================================
CREATE TABLE public.scadenze_bandi_fondi_interprofessionali (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codice character varying(30) NOT NULL,
    nome character varying(200) NOT NULL,
    sigla character varying(30),
    settori_ccnl text[],
    url_area_riservata character varying(500),
    note text,
    attivo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_fondi_interprofessionali ADD CONSTRAINT scadenze_bandi_fondi_interprofessionali_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_fondi_interprofessionali ADD CONSTRAINT scadenze_bandi_fondi_interprofessionali_codice_key UNIQUE (codice);
-- Indici (non legati a vincoli)
CREATE INDEX idx_fondi_interprofessionali_attivo ON public.scadenze_bandi_fondi_interprofessionali USING btree (attivo);
CREATE INDEX idx_fondi_interprofessionali_codice ON public.scadenze_bandi_fondi_interprofessionali USING btree (codice);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_gruppi_utenti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_gruppi_utenti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome character varying(100) NOT NULL,
    descrizione text,
    colore_hex character varying(7) DEFAULT '#10B981'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    attivo boolean DEFAULT true
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_gruppi_utenti ADD CONSTRAINT scadenze_bandi_gruppi_utenti_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_gruppi_utenti ADD CONSTRAINT scadenze_bandi_gruppi_utenti_nome_key UNIQUE (nome);
-- Indici (non legati a vincoli)
CREATE INDEX idx_gruppi_attivo ON public.scadenze_bandi_gruppi_utenti USING btree (attivo) WHERE (attivo = true);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_legali_rappresentanti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_legali_rappresentanti (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    cliente_id uuid,
    cognome text NOT NULL,
    nome text NOT NULL,
    codice_fiscale text,
    sesso scadenze_bandi_sesso,
    luogo_nascita text,
    data_nascita date,
    email text,
    telefono text,
    citta_residenza text,
    cap_residenza text,
    indirizzo_residenza text,
    numero_civico text,
    in_qualita_di text DEFAULT 'Legale Rappresentante'::text,
    presente boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_legali_rappresentanti ADD CONSTRAINT scadenze_bandi_legali_rappresentanti_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_legali_rappresentanti ADD CONSTRAINT scadenze_bandi_legali_rappresentanti_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
-- Indici (non legati a vincoli)
CREATE INDEX idx_legali_rappresentanti_cliente ON public.scadenze_bandi_legali_rappresentanti USING btree (cliente_id);
-- Trigger
CREATE TRIGGER update_legali_rappresentanti_updated_at BEFORE UPDATE ON public.scadenze_bandi_legali_rappresentanti FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_note_bandi
-- ======================================================================
CREATE TABLE public.scadenze_bandi_note_bandi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nota_id uuid NOT NULL,
    bando_id uuid NOT NULL,
    stato text DEFAULT 'suggerito'::text NOT NULL,
    score numeric(3,2),
    metodo text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_note_bandi ADD CONSTRAINT scadenze_bandi_note_bandi_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_note_bandi ADD CONSTRAINT scadenze_bandi_note_bandi_nota_id_bando_id_key UNIQUE (nota_id, bando_id);
ALTER TABLE ONLY public.scadenze_bandi_note_bandi ADD CONSTRAINT scadenze_bandi_note_bandi_bando_id_fkey FOREIGN KEY (bando_id) REFERENCES scadenze_bandi_bandi(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_note_bandi ADD CONSTRAINT scadenze_bandi_note_bandi_nota_id_fkey FOREIGN KEY (nota_id) REFERENCES scadenze_bandi_clienti_note(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_note_bandi ADD CONSTRAINT scadenze_bandi_note_bandi_stato_check CHECK ((stato = ANY (ARRAY['suggerito'::text, 'confermato'::text, 'rifiutato'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_note_bandi_bando ON public.scadenze_bandi_note_bandi USING btree (bando_id);
CREATE INDEX idx_note_bandi_nota ON public.scadenze_bandi_note_bandi USING btree (nota_id);
CREATE INDEX idx_note_bandi_stato ON public.scadenze_bandi_note_bandi USING btree (stato);
-- Trigger
CREATE TRIGGER update_note_bandi_updated_at BEFORE UPDATE ON public.scadenze_bandi_note_bandi FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: ABILITATA
--   POLICY "Allow all operations for authenticated users" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: true
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_note_progetti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_note_progetti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nota_id uuid NOT NULL,
    progetto_id uuid NOT NULL,
    stato text DEFAULT 'suggerito'::text NOT NULL,
    score numeric(3,2),
    metodo text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_note_progetti ADD CONSTRAINT scadenze_bandi_note_progetti_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_note_progetti ADD CONSTRAINT scadenze_bandi_note_progetti_nota_id_progetto_id_key UNIQUE (nota_id, progetto_id);
ALTER TABLE ONLY public.scadenze_bandi_note_progetti ADD CONSTRAINT scadenze_bandi_note_progetti_nota_id_fkey FOREIGN KEY (nota_id) REFERENCES scadenze_bandi_clienti_note(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_note_progetti ADD CONSTRAINT scadenze_bandi_note_progetti_progetto_id_fkey FOREIGN KEY (progetto_id) REFERENCES scadenze_bandi_progetti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_note_progetti ADD CONSTRAINT scadenze_bandi_note_progetti_stato_check CHECK ((stato = ANY (ARRAY['suggerito'::text, 'confermato'::text, 'rifiutato'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_note_progetti_nota ON public.scadenze_bandi_note_progetti USING btree (nota_id);
CREATE INDEX idx_note_progetti_progetto ON public.scadenze_bandi_note_progetti USING btree (progetto_id);
CREATE INDEX idx_note_progetti_stato ON public.scadenze_bandi_note_progetti USING btree (stato);
-- Trigger
CREATE TRIGGER update_note_progetti_updated_at BEFORE UPDATE ON public.scadenze_bandi_note_progetti FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: ABILITATA
--   POLICY "Allow all operations for authenticated users" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: true
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_notification_log
-- ======================================================================
CREATE TABLE public.scadenze_bandi_notification_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_id text NOT NULL,
    notification_type text NOT NULL,
    channel text NOT NULL,
    sent_date date NOT NULL,
    sent_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_notification_log ADD CONSTRAINT scadenze_bandi_notification_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_notification_log ADD CONSTRAINT scadenze_bandi_notification_log_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'calendar'::text, 'push'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_notification_log_entity_type ON public.scadenze_bandi_notification_log USING btree (entity_id, notification_type, sent_date);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_notification_settings
-- ======================================================================
CREATE TABLE public.scadenze_bandi_notification_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_email text NOT NULL,
    email_enabled boolean DEFAULT true,
    email_scadenze_1_giorno boolean DEFAULT true,
    email_scadenze_3_giorni boolean DEFAULT true,
    email_scadenze_7_giorni boolean DEFAULT true,
    email_digest_settimanale boolean DEFAULT true,
    email_progetti_assegnati boolean DEFAULT true,
    calendar_enabled boolean DEFAULT false,
    calendar_id text,
    calendar_sync_scadenze boolean DEFAULT true,
    calendar_sync_milestones boolean DEFAULT true,
    quiet_hours_enabled boolean DEFAULT false,
    quiet_hours_start time without time zone DEFAULT '22:00:00'::time without time zone,
    quiet_hours_end time without time zone DEFAULT '08:00:00'::time without time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email_scadenze_15_giorni boolean DEFAULT true
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_notification_settings ADD CONSTRAINT scadenze_bandi_notification_settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_notification_settings ADD CONSTRAINT scadenze_bandi_notification_settings_user_email_key UNIQUE (user_email);
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_notification_settings_email ON public.scadenze_bandi_notification_settings USING btree (user_email);
-- Trigger
CREATE TRIGGER update_scadenze_bandi_notification_settings_updated_at BEFORE UPDATE ON public.scadenze_bandi_notification_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_partecipanti_formazione
-- ======================================================================
CREATE TABLE public.scadenze_bandi_partecipanti_formazione (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    corso_id uuid NOT NULL,
    cognome character varying(100) NOT NULL,
    nome character varying(100) NOT NULL,
    codice_fiscale character varying(16),
    qualifica character varying(200),
    ruolo_sicurezza character varying(100),
    presente boolean DEFAULT true,
    ore_frequentate numeric(5,1),
    esito character varying(30) DEFAULT 'NON_APPLICABILE'::character varying,
    note text,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_partecipanti_formazione ADD CONSTRAINT scadenze_bandi_partecipanti_formazione_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_partecipanti_formazione ADD CONSTRAINT scadenze_bandi_partecipanti_formazione_corso_id_fkey FOREIGN KEY (corso_id) REFERENCES scadenze_bandi_corsi_formativi(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_partecipanti_formazione ADD CONSTRAINT scadenze_bandi_partecipanti_formazione_esito_check CHECK (((esito)::text = ANY ((ARRAY['SUPERATO'::character varying, 'NON_SUPERATO'::character varying, 'NON_APPLICABILE'::character varying])::text[])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_partecipanti_formazione_cf ON public.scadenze_bandi_partecipanti_formazione USING btree (codice_fiscale);
CREATE INDEX idx_partecipanti_formazione_corso ON public.scadenze_bandi_partecipanti_formazione USING btree (corso_id);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_piani_formativi
-- ======================================================================
CREATE TABLE public.scadenze_bandi_piani_formativi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    adesione_fpi_id uuid,
    fondo_id uuid,
    codice_piano character varying(100),
    titolo character varying(500) NOT NULL,
    descrizione text,
    tipologia character varying(50),
    canale_finanziamento character varying(50),
    avviso_riferimento character varying(200),
    stato character varying(30) DEFAULT 'BOZZA'::character varying,
    data_presentazione date,
    data_approvazione date,
    data_inizio_attivita date,
    data_fine_attivita date,
    data_scadenza_rendicontazione date,
    data_saldo date,
    importo_richiesto numeric(15,2),
    importo_approvato numeric(15,2),
    importo_erogato numeric(15,2),
    importo_saldato numeric(15,2),
    ore_previste integer,
    ore_erogate integer,
    num_partecipanti_previsti integer,
    num_partecipanti_effettivi integer,
    progetto_collegato_id uuid,
    bando_collegato_id uuid,
    drive_folder_id character varying(200),
    drive_folder_url character varying(500),
    responsabile_piano jsonb,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_piani_formativi ADD CONSTRAINT scadenze_bandi_piani_formativi_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_piani_formativi ADD CONSTRAINT scadenze_bandi_piani_formativi_adesione_fpi_id_fkey FOREIGN KEY (adesione_fpi_id) REFERENCES scadenze_bandi_clienti_adesioni_fpi(id);
ALTER TABLE ONLY public.scadenze_bandi_piani_formativi ADD CONSTRAINT scadenze_bandi_piani_formativi_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_piani_formativi ADD CONSTRAINT scadenze_bandi_piani_formativi_created_by_fkey FOREIGN KEY (created_by) REFERENCES scadenze_bandi_utenti(id);
ALTER TABLE ONLY public.scadenze_bandi_piani_formativi ADD CONSTRAINT scadenze_bandi_piani_formativi_fondo_id_fkey FOREIGN KEY (fondo_id) REFERENCES scadenze_bandi_fondi_interprofessionali(id);
ALTER TABLE ONLY public.scadenze_bandi_piani_formativi ADD CONSTRAINT scadenze_bandi_piani_formativi_canale_finanziamento_check CHECK (((canale_finanziamento)::text = ANY ((ARRAY['CONTO_FORMAZIONE'::character varying, 'CONTO_SISTEMA'::character varying, 'AVVISO'::character varying, 'PRIVATO'::character varying, 'NON_APPLICABILE'::character varying])::text[])));
ALTER TABLE ONLY public.scadenze_bandi_piani_formativi ADD CONSTRAINT scadenze_bandi_piani_formativi_stato_check CHECK (((stato)::text = ANY ((ARRAY['BOZZA'::character varying, 'IN_PRESENTAZIONE'::character varying, 'PRESENTATO'::character varying, 'APPROVATO'::character varying, 'IN_EROGAZIONE'::character varying, 'CONCLUSO'::character varying, 'RENDICONTATO'::character varying, 'SALDATO'::character varying, 'RESPINTO'::character varying, 'ANNULLATO'::character varying])::text[])));
ALTER TABLE ONLY public.scadenze_bandi_piani_formativi ADD CONSTRAINT scadenze_bandi_piani_formativi_tipologia_check CHECK (((tipologia)::text = ANY ((ARRAY['AZIENDALE'::character varying, 'PLURIAZIENDALE'::character varying, 'SETTORIALE'::character varying, 'TERRITORIALE'::character varying, 'PRIVATO'::character varying, 'OBBLIGATORIO'::character varying])::text[])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_piani_formativi_cliente_stato ON public.scadenze_bandi_piani_formativi USING btree (cliente_id, stato);
CREATE INDEX idx_piani_formativi_fondo ON public.scadenze_bandi_piani_formativi USING btree (fondo_id);
CREATE INDEX idx_piani_formativi_scadenza_rendicontazione ON public.scadenze_bandi_piani_formativi USING btree (data_scadenza_rendicontazione);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_profiling_template
-- ======================================================================
CREATE TABLE public.scadenze_bandi_profiling_template (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domanda text NOT NULL,
    tipo text NOT NULL,
    opzioni jsonb DEFAULT '[]'::jsonb,
    peso integer DEFAULT 1,
    categoria text DEFAULT 'generale'::text,
    ordine integer DEFAULT 0,
    attivo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    punteggi jsonb DEFAULT '[]'::jsonb
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_profiling_template ADD CONSTRAINT scadenze_bandi_profiling_template_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_profiling_template ADD CONSTRAINT scadenze_bandi_profiling_template_tipo_check CHECK ((tipo = ANY (ARRAY['text'::text, 'number'::text, 'select'::text, 'multiselect'::text, 'boolean'::text, 'textarea'::text, 'rating'::text])));
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_progetti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_progetti (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    bando_id uuid,
    cliente_id uuid,
    codice_progetto character varying(50),
    titolo_progetto text,
    descrizione_progetto text,
    stato progetto_stato DEFAULT 'DECRETO_ATTESO'::progetto_stato,
    importo_totale_progetto numeric(15,2),
    contributo_ammesso numeric(15,2),
    percentuale_contributo numeric(5,2),
    data_decreto_concessione date,
    scadenza_accettazione_esiti date,
    data_effettiva_accettazione_esiti date,
    data_avvio_progetto date,
    data_fine_progetto_prevista date,
    data_fine_progetto_effettiva date,
    anticipo_richiedibile boolean DEFAULT true,
    percentuale_anticipo numeric(5,2) DEFAULT 30.00,
    scadenza_richiesta_anticipo date,
    data_effettiva_richiesta_anticipo date,
    importo_anticipo_erogato numeric(15,2),
    numero_sal progetto_numero_sal DEFAULT 'UNICO'::progetto_numero_sal,
    scadenza_primo_sal date,
    data_effettiva_primo_sal date,
    scadenza_secondo_sal date,
    data_effettiva_secondo_sal date,
    scadenza_saldo_finale date,
    data_effettiva_saldo_finale date,
    proroga_richiedibile boolean DEFAULT true,
    scadenza_richiesta_proroga date,
    data_effettiva_richiesta_proroga date,
    mesi_proroga_concessi integer,
    scadenza_rendicontazione_finale date,
    data_effettiva_rendicontazione_finale date,
    modalita_calcolo_scadenza_rendicontazione text DEFAULT 'decreto_concessione'::text,
    referente_interno text,
    email_referente_interno text,
    note_progetto text,
    documenti_paths text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    data_base_calcolo date,
    created_by uuid,
    updated_by uuid,
    evento_base_id uuid,
    contributo_ottenuto numeric(12,2)
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_progetti ADD CONSTRAINT scadenze_bandi_progetti_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_progetti ADD CONSTRAINT scadenze_bandi_progetti_codice_progetto_key UNIQUE (codice_progetto);
ALTER TABLE ONLY public.scadenze_bandi_progetti ADD CONSTRAINT scadenze_bandi_progetti_bando_id_fkey FOREIGN KEY (bando_id) REFERENCES scadenze_bandi_bandi(id);
ALTER TABLE ONLY public.scadenze_bandi_progetti ADD CONSTRAINT scadenze_bandi_progetti_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id);
ALTER TABLE ONLY public.scadenze_bandi_progetti ADD CONSTRAINT scadenze_bandi_progetti_created_by_fkey FOREIGN KEY (created_by) REFERENCES scadenze_bandi_utenti(id);
ALTER TABLE ONLY public.scadenze_bandi_progetti ADD CONSTRAINT scadenze_bandi_progetti_evento_base_id_fkey FOREIGN KEY (evento_base_id) REFERENCES scadenze_bandi_eventi_catalogo(id);
ALTER TABLE ONLY public.scadenze_bandi_progetti ADD CONSTRAINT scadenze_bandi_progetti_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES scadenze_bandi_utenti(id);
-- Indici (non legati a vincoli)
CREATE INDEX idx_progetti_bando ON public.scadenze_bandi_progetti USING btree (bando_id);
CREATE INDEX idx_progetti_cliente ON public.scadenze_bandi_progetti USING btree (cliente_id);
CREATE INDEX idx_progetti_decreto ON public.scadenze_bandi_progetti USING btree (data_decreto_concessione);
CREATE INDEX idx_progetti_stato ON public.scadenze_bandi_progetti USING btree (stato);
CREATE INDEX idx_progetti_titolo_trgm ON public.scadenze_bandi_progetti USING gin (titolo_progetto gin_trgm_ops);
CREATE INDEX idx_scadenze_bandi_progetti_created_by ON public.scadenze_bandi_progetti USING btree (created_by);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_progetti_eventi
-- ======================================================================
CREATE TABLE public.scadenze_bandi_progetti_eventi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    progetto_id uuid NOT NULL,
    evento_id uuid NOT NULL,
    data_effettiva date,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_progetti_eventi ADD CONSTRAINT scadenze_bandi_progetti_eventi_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_progetti_eventi ADD CONSTRAINT scadenze_bandi_progetti_eventi_progetto_id_evento_id_key UNIQUE (progetto_id, evento_id);
ALTER TABLE ONLY public.scadenze_bandi_progetti_eventi ADD CONSTRAINT scadenze_bandi_progetti_eventi_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES scadenze_bandi_eventi_catalogo(id);
ALTER TABLE ONLY public.scadenze_bandi_progetti_eventi ADD CONSTRAINT scadenze_bandi_progetti_eventi_progetto_id_fkey FOREIGN KEY (progetto_id) REFERENCES scadenze_bandi_progetti(id) ON DELETE CASCADE;
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_progetti_eventi_evento ON public.scadenze_bandi_progetti_eventi USING btree (evento_id);
CREATE INDEX idx_scadenze_bandi_progetti_eventi_progetto ON public.scadenze_bandi_progetti_eventi USING btree (progetto_id);
-- Trigger
CREATE TRIGGER update_scadenze_bandi_progetti_eventi_updated_at BEFORE UPDATE ON public.scadenze_bandi_progetti_eventi FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: ABILITATA
--   POLICY "Utenti possono aggiornare eventi nei propri progetti" | PERMISSIVE | ruoli: public | comando: UPDATE | USING: (auth.role() = 'authenticated'::text) | WITH CHECK: -
--   POLICY "Utenti possono inserire eventi nei propri progetti" | PERMISSIVE | ruoli: public | comando: INSERT | USING: - | WITH CHECK: (auth.role() = 'authenticated'::text)
--   POLICY "Utenti possono vedere eventi dei propri progetti" | PERMISSIVE | ruoli: public | comando: SELECT | USING: (auth.role() = 'authenticated'::text) | WITH CHECK: -
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_prospect
-- ======================================================================
CREATE TABLE public.scadenze_bandi_prospect (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_prospect text,
    denominazione text NOT NULL,
    partita_iva text,
    codice_fiscale text,
    email text,
    pec text,
    telefono text,
    sito_web text,
    indirizzo text,
    cap text,
    citta text,
    provincia text,
    settore text,
    ateco_2025 text,
    dimensione text,
    numero_dipendenti integer,
    ultimo_fatturato numeric,
    legale_rappresentante_nome text,
    legale_rappresentante_cognome text,
    legale_rappresentante_email text,
    legale_rappresentante_telefono text,
    profiling_data jsonb DEFAULT '{}'::jsonb,
    profiling_score integer DEFAULT 0,
    fonte_acquisizione text,
    assegnato_a text,
    stato text DEFAULT 'nuovo'::text NOT NULL,
    decisione text,
    motivo_rifiuto text,
    data_decisione timestamp with time zone,
    deciso_da text,
    cliente_id uuid,
    data_conversione timestamp with time zone,
    convertito_da text,
    note text,
    creato_da text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    fonte_dettaglio text,
    data_contatto date,
    ricevuto_da text,
    referente_nome text,
    tipologia_soggetto text,
    area_interesse text,
    natura_interesse text,
    bisogno_dichiarato text,
    bisogno_interpretato text,
    affidabilita_percepita text,
    potenziale_economico text,
    budget_dichiarato boolean DEFAULT false,
    tempi_decisione text,
    note_qualitative text,
    raccomandazione text,
    motivazione_raccomandazione text,
    responsabile_qualificazione text,
    data_riunione_prevista date,
    congelato_il timestamp with time zone,
    scongela_il date,
    stato_pre_congelamento text,
    motivo_congelamento text,
    archiviato_il timestamp with time zone,
    motivo_archiviazione text
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_prospect ADD CONSTRAINT scadenze_bandi_prospect_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_prospect ADD CONSTRAINT scadenze_bandi_prospect_numero_prospect_key UNIQUE (numero_prospect);
ALTER TABLE ONLY public.scadenze_bandi_prospect ADD CONSTRAINT scadenze_bandi_prospect_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id);
ALTER TABLE ONLY public.scadenze_bandi_prospect ADD CONSTRAINT scadenze_bandi_prospect_decisione_check CHECK ((decisione = ANY (ARRAY['EVOLVI'::text, 'SPOT'::text, 'FPI'::text, 'CONSULENTI'::text, 'RIFIUTATO'::text])));
ALTER TABLE ONLY public.scadenze_bandi_prospect ADD CONSTRAINT scadenze_bandi_prospect_dimensione_check CHECK ((dimensione = ANY (ARRAY['MICRO'::text, 'PICCOLA'::text, 'MEDIA'::text, 'GRANDE'::text])));
ALTER TABLE ONLY public.scadenze_bandi_prospect ADD CONSTRAINT scadenze_bandi_prospect_fonte_acquisizione_check CHECK ((fonte_acquisizione = ANY (ARRAY['referral'::text, 'web'::text, 'evento'::text, 'cold_call'::text, 'altro'::text, 'telefonata'::text, 'email_inbound'::text, 'linkedin'::text])));
ALTER TABLE ONLY public.scadenze_bandi_prospect ADD CONSTRAINT scadenze_bandi_prospect_stato_check CHECK ((stato = ANY (ARRAY['bozza'::text, 'qualificato'::text, 'in_decisione'::text, 'preso_in_carico'::text, 'convertito'::text, 'congelato'::text, 'archiviato'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_prospect_assegnato ON public.scadenze_bandi_prospect USING btree (assegnato_a);
CREATE INDEX idx_prospect_cliente ON public.scadenze_bandi_prospect USING btree (cliente_id);
CREATE INDEX idx_prospect_stato ON public.scadenze_bandi_prospect USING btree (stato);
-- Trigger
CREATE TRIGGER trigger_generate_numero_prospect BEFORE INSERT ON public.scadenze_bandi_prospect FOR EACH ROW WHEN ((new.numero_prospect IS NULL)) EXECUTE FUNCTION generate_numero_prospect();
CREATE TRIGGER trigger_updated_at_scadenze_bandi_prospect BEFORE UPDATE ON public.scadenze_bandi_prospect FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_prospect_history
-- ======================================================================
CREATE TABLE public.scadenze_bandi_prospect_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid NOT NULL,
    stato_precedente text,
    stato_nuovo text NOT NULL,
    note text,
    utente text,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_prospect_history ADD CONSTRAINT scadenze_bandi_prospect_history_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_prospect_history ADD CONSTRAINT scadenze_bandi_prospect_history_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES scadenze_bandi_prospect(id) ON DELETE CASCADE;
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_rna_agente
-- ======================================================================
CREATE TABLE public.scadenze_bandi_rna_agente (
    id text NOT NULL,
    ultimo_contatto_at timestamp with time zone DEFAULT now() NOT NULL,
    stato text
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_rna_agente ADD CONSTRAINT scadenze_bandi_rna_agente_pkey PRIMARY KEY (id);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_rna_aiuti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_rna_aiuti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cor text NOT NULL,
    car text,
    titolo_misura text,
    des_tipo_misura text,
    soggetto_concedente text,
    data_concessione date,
    anno_concessione integer,
    titolo_progetto text,
    descrizione_progetto text,
    cup text,
    atto_concessione text,
    link_atto_concessione text,
    link_trasparenza text,
    codice_fiscale_beneficiario text NOT NULL,
    denominazione_beneficiario text,
    des_tipo_beneficiario text,
    regione_beneficiario text,
    cliente_id uuid,
    procedimenti text[] DEFAULT '{}'::text[] NOT NULL,
    regolamenti text[] DEFAULT '{}'::text[] NOT NULL,
    cod_regolamenti text[] DEFAULT '{}'::text[] NOT NULL,
    strumenti text[] DEFAULT '{}'::text[] NOT NULL,
    forma_proposta contributo_forma,
    importo_nominale numeric(15,2),
    elemento_aiuto numeric(15,2),
    de_minimis boolean DEFAULT false NOT NULL,
    ambito text DEFAULT 'ALTRO'::text NOT NULL,
    fondo_interprofessionale text,
    componenti jsonb,
    contributo_id uuid,
    collegamento_automatico boolean DEFAULT false NOT NULL,
    escludi_collegamento_auto boolean DEFAULT false NOT NULL,
    modificato_da_rna_at timestamp with time zone,
    file_origine text,
    prima_rilevazione_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_rna_aiuti ADD CONSTRAINT scadenze_bandi_rna_aiuti_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_rna_aiuti ADD CONSTRAINT uq_rna_aiuti_cor UNIQUE (cor);
ALTER TABLE ONLY public.scadenze_bandi_rna_aiuti ADD CONSTRAINT scadenze_bandi_rna_aiuti_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.scadenze_bandi_rna_aiuti ADD CONSTRAINT scadenze_bandi_rna_aiuti_contributo_id_fkey FOREIGN KEY (contributo_id) REFERENCES scadenze_bandi_contributi_ottenuti(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.scadenze_bandi_rna_aiuti ADD CONSTRAINT chk_rna_aiuti_ambito CHECK ((ambito = ANY (ARRAY['FPI'::text, 'GARANZIA_PMI'::text, 'ALTRO'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_rna_aiuti_ambito ON public.scadenze_bandi_rna_aiuti USING btree (ambito);
CREATE INDEX idx_rna_aiuti_cf ON public.scadenze_bandi_rna_aiuti USING btree (codice_fiscale_beneficiario);
CREATE INDEX idx_rna_aiuti_cliente ON public.scadenze_bandi_rna_aiuti USING btree (cliente_id);
CREATE INDEX idx_rna_aiuti_data ON public.scadenze_bandi_rna_aiuti USING btree (data_concessione DESC);
CREATE INDEX idx_rna_aiuti_de_minimis ON public.scadenze_bandi_rna_aiuti USING btree (cliente_id, data_concessione) WHERE de_minimis;
CREATE INDEX idx_rna_aiuti_fondo ON public.scadenze_bandi_rna_aiuti USING btree (fondo_interprofessionale);
CREATE UNIQUE INDEX uq_rna_aiuti_contributo ON public.scadenze_bandi_rna_aiuti USING btree (contributo_id) WHERE (contributo_id IS NOT NULL);
-- Trigger
CREATE TRIGGER trg_rna_aiuti_updated_at BEFORE UPDATE ON public.scadenze_bandi_rna_aiuti FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_rna_import_log
-- ======================================================================
CREATE TABLE public.scadenze_bandi_rna_import_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mese text NOT NULL,
    origine text DEFAULT 'CRON'::text NOT NULL,
    esito text DEFAULT 'IN_CORSO'::text NOT NULL,
    aiuti_letti integer,
    aiuti_clienti integer,
    nuovi integer,
    aggiornati integer,
    collegati_auto integer,
    durata_ms integer,
    errore text,
    avviato_at timestamp with time zone DEFAULT now() NOT NULL,
    completato_at timestamp with time zone
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_rna_import_log ADD CONSTRAINT scadenze_bandi_rna_import_log_pkey PRIMARY KEY (id);
-- Indici (non legati a vincoli)
CREATE INDEX idx_rna_import_log_mese ON public.scadenze_bandi_rna_import_log USING btree (mese, avviato_at DESC);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_rna_richieste
-- ======================================================================
CREATE TABLE public.scadenze_bandi_rna_richieste (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mese_da text NOT NULL,
    mese_a text NOT NULL,
    origine text DEFAULT 'MANUALE'::text NOT NULL,
    stato text DEFAULT 'IN_ATTESA'::text NOT NULL,
    mesi_totali integer,
    mesi_completati integer DEFAULT 0 NOT NULL,
    mese_corrente text,
    aiuti_clienti integer,
    nuovi integer,
    aggiornati integer,
    collegati_auto integer,
    mesi_in_errore integer,
    errore text,
    richiesta_da uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    avviata_at timestamp with time zone,
    completata_at timestamp with time zone
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_rna_richieste ADD CONSTRAINT scadenze_bandi_rna_richieste_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_rna_richieste ADD CONSTRAINT chk_rna_richieste_mesi CHECK (((mese_da ~ '^\d{4}_\d{2}$'::text) AND (mese_a ~ '^\d{4}_\d{2}$'::text) AND (mese_da <= mese_a)));
ALTER TABLE ONLY public.scadenze_bandi_rna_richieste ADD CONSTRAINT chk_rna_richieste_origine CHECK ((origine = ANY (ARRAY['MANUALE'::text, 'AUTOMATICA'::text])));
ALTER TABLE ONLY public.scadenze_bandi_rna_richieste ADD CONSTRAINT chk_rna_richieste_stato CHECK ((stato = ANY (ARRAY['IN_ATTESA'::text, 'IN_CORSO'::text, 'OK'::text, 'ERRORE'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_rna_richieste_created ON public.scadenze_bandi_rna_richieste USING btree (created_at DESC);
CREATE INDEX idx_rna_richieste_stato ON public.scadenze_bandi_rna_richieste USING btree (stato, created_at);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_scadenze
-- ======================================================================
CREATE TABLE public.scadenze_bandi_scadenze (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    progetto_id uuid,
    tipologia_scadenza_id uuid,
    data_scadenza timestamp with time zone NOT NULL,
    stato scadenze_bandi_stato_scadenza DEFAULT 'non_iniziata'::scadenze_bandi_stato_scadenza,
    priorita scadenze_bandi_priorita DEFAULT 'media'::scadenze_bandi_priorita,
    responsabile_email text,
    note text,
    completata_da text,
    completata_il timestamp with time zone,
    giorni_preavviso integer[] DEFAULT ARRAY[30, 15, 7, 1],
    alert_inviati integer[] DEFAULT ARRAY[]::integer[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cliente_id uuid,
    titolo text,
    bando_id uuid,
    created_by uuid,
    updated_by uuid,
    obbligatoria boolean DEFAULT false,
    tipo_scadenza character varying(50) DEFAULT 'generico'::character varying,
    data_effettiva timestamp with time zone,
    data_modificata_da text,
    data_modificata_il timestamp with time zone
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_scadenze ADD CONSTRAINT scadenze_bandi_scadenze_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_scadenze ADD CONSTRAINT scadenze_bandi_scadenze_bando_id_fkey FOREIGN KEY (bando_id) REFERENCES scadenze_bandi_bandi(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_scadenze ADD CONSTRAINT scadenze_bandi_scadenze_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES scadenze_bandi_clienti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_scadenze ADD CONSTRAINT scadenze_bandi_scadenze_created_by_fkey FOREIGN KEY (created_by) REFERENCES scadenze_bandi_utenti(id);
ALTER TABLE ONLY public.scadenze_bandi_scadenze ADD CONSTRAINT scadenze_bandi_scadenze_progetto_id_fkey FOREIGN KEY (progetto_id) REFERENCES scadenze_bandi_progetti(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_scadenze ADD CONSTRAINT scadenze_bandi_scadenze_tipologia_scadenza_id_fkey FOREIGN KEY (tipologia_scadenza_id) REFERENCES scadenze_bandi_tipologie_scadenze(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.scadenze_bandi_scadenze ADD CONSTRAINT scadenze_bandi_scadenze_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES scadenze_bandi_utenti(id);
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_scadenze_created_by ON public.scadenze_bandi_scadenze USING btree (created_by);
CREATE INDEX idx_scadenze_bando ON public.scadenze_bandi_scadenze USING btree (bando_id);
CREATE INDEX idx_scadenze_cliente ON public.scadenze_bandi_scadenze USING btree (cliente_id);
CREATE INDEX idx_scadenze_data ON public.scadenze_bandi_scadenze USING btree (data_scadenza);
CREATE INDEX idx_scadenze_data_effettiva ON public.scadenze_bandi_scadenze USING btree (data_effettiva) WHERE (data_effettiva IS NOT NULL);
CREATE INDEX idx_scadenze_data_scadenza ON public.scadenze_bandi_scadenze USING btree (data_scadenza);
CREATE INDEX idx_scadenze_entita ON public.scadenze_bandi_scadenze USING btree (cliente_id, bando_id, progetto_id);
CREATE INDEX idx_scadenze_progetto ON public.scadenze_bandi_scadenze USING btree (progetto_id);
CREATE INDEX idx_scadenze_stato ON public.scadenze_bandi_scadenze USING btree (stato);
-- Trigger
CREATE TRIGGER update_scadenze_updated_at BEFORE UPDATE ON public.scadenze_bandi_scadenze FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   POLICY "Utenti autenticati possono aggiornare scadenze" | PERMISSIVE | ruoli: authenticated | comando: UPDATE | USING: true | WITH CHECK: true
--   POLICY "Utenti autenticati possono eliminare scadenze" | PERMISSIVE | ruoli: authenticated | comando: DELETE | USING: true | WITH CHECK: -
--   POLICY "Utenti autenticati possono inserire scadenze" | PERMISSIVE | ruoli: authenticated | comando: INSERT | USING: - | WITH CHECK: true
--   POLICY "Utenti autenticati possono vedere tutte le scadenze" | PERMISSIVE | ruoli: authenticated | comando: SELECT | USING: true | WITH CHECK: -
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_scadenze_contrattuali
-- ======================================================================
CREATE TABLE public.scadenze_bandi_scadenze_contrattuali (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text DEFAULT 'GENERALE'::text NOT NULL,
    entity_id uuid,
    titolo text NOT NULL,
    descrizione text,
    tipo_scadenza text NOT NULL,
    categoria text,
    data_scadenza date NOT NULL,
    data_promemoria date,
    is_recurring boolean DEFAULT false,
    recurrence_pattern text,
    recurrence_interval integer DEFAULT 1,
    recurrence_end_date date,
    stato text DEFAULT 'APERTA'::text NOT NULL,
    priorita text DEFAULT 'MEDIA'::text NOT NULL,
    responsabile_email text,
    notifiche_attive boolean DEFAULT true,
    notifica_giorni_prima integer[] DEFAULT '{30,15,7,3,1}'::integer[],
    data_completamento timestamp with time zone,
    completato_da text,
    note_completamento text,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    created_by text,
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_scadenze_contrattuali ADD CONSTRAINT scadenze_bandi_scadenze_contrattuali_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_scadenze_contrattuali ADD CONSTRAINT scadenze_bandi_scadenze_contrattuali_entity_type_check CHECK ((entity_type = ANY (ARRAY['CLIENTE'::text, 'CONTRATTO_EVOLVI'::text, 'GENERALE'::text])));
ALTER TABLE ONLY public.scadenze_bandi_scadenze_contrattuali ADD CONSTRAINT scadenze_bandi_scadenze_contrattuali_priorita_check CHECK ((priorita = ANY (ARRAY['BASSA'::text, 'MEDIA'::text, 'ALTA'::text, 'CRITICA'::text])));
ALTER TABLE ONLY public.scadenze_bandi_scadenze_contrattuali ADD CONSTRAINT scadenze_bandi_scadenze_contrattuali_recurrence_pattern_check CHECK ((recurrence_pattern = ANY (ARRAY['MONTHLY'::text, 'QUARTERLY'::text, 'YEARLY'::text])));
ALTER TABLE ONLY public.scadenze_bandi_scadenze_contrattuali ADD CONSTRAINT scadenze_bandi_scadenze_contrattuali_stato_check CHECK ((stato = ANY (ARRAY['APERTA'::text, 'IN_CORSO'::text, 'COMPLETATA'::text, 'ANNULLATA'::text])));
ALTER TABLE ONLY public.scadenze_bandi_scadenze_contrattuali ADD CONSTRAINT scadenze_bandi_scadenze_contrattuali_tipo_scadenza_check CHECK ((tipo_scadenza = ANY (ARRAY['CONTRATTUALE'::text, 'FISCALE'::text, 'AMMINISTRATIVA'::text, 'CERTIFICAZIONE'::text, 'PAGAMENTO'::text, 'REVISIONE'::text, 'ALTRO'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_contr_data ON public.scadenze_bandi_scadenze_contrattuali USING btree (data_scadenza);
CREATE INDEX idx_scadenze_contr_entity ON public.scadenze_bandi_scadenze_contrattuali USING btree (entity_type, entity_id);
CREATE INDEX idx_scadenze_contr_stato ON public.scadenze_bandi_scadenze_contrattuali USING btree (stato);
-- Trigger
CREATE TRIGGER trigger_updated_at_scadenze_bandi_scadenze_contrattuali BEFORE UPDATE ON public.scadenze_bandi_scadenze_contrattuali FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_scadenze_contrattuali_log
-- ======================================================================
CREATE TABLE public.scadenze_bandi_scadenze_contrattuali_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scadenza_id uuid NOT NULL,
    azione text NOT NULL,
    dettagli jsonb DEFAULT '{}'::jsonb,
    utente text,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_scadenze_contrattuali_log ADD CONSTRAINT scadenze_bandi_scadenze_contrattuali_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_scadenze_contrattuali_log ADD CONSTRAINT scadenze_bandi_scadenze_contrattuali_log_scadenza_id_fkey FOREIGN KEY (scadenza_id) REFERENCES scadenze_bandi_scadenze_contrattuali(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_scadenze_contrattuali_log ADD CONSTRAINT scadenze_bandi_scadenze_contrattuali_log_azione_check CHECK ((azione = ANY (ARRAY['creazione'::text, 'modifica'::text, 'completamento'::text, 'notifica_inviata'::text, 'ricorrenza_generata'::text, 'annullamento'::text])));
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_sessioni
-- ======================================================================
CREATE TABLE public.scadenze_bandi_sessioni (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    utente_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    user_agent text,
    ip_address inet,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_sessioni ADD CONSTRAINT scadenze_bandi_sessioni_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_sessioni ADD CONSTRAINT scadenze_bandi_sessioni_token_hash_key UNIQUE (token_hash);
ALTER TABLE ONLY public.scadenze_bandi_sessioni ADD CONSTRAINT scadenze_bandi_sessioni_utente_id_fkey FOREIGN KEY (utente_id) REFERENCES scadenze_bandi_utenti(id) ON DELETE CASCADE;
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_sessioni_expires ON public.scadenze_bandi_sessioni USING btree (expires_at);
CREATE INDEX idx_scadenze_bandi_sessioni_token ON public.scadenze_bandi_sessioni USING btree (token_hash);
CREATE INDEX idx_scadenze_bandi_sessioni_utente ON public.scadenze_bandi_sessioni USING btree (utente_id);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: nessuno
-- Privilegi authenticated: nessuno

-- ======================================================================
-- TABELLA: public.scadenze_bandi_sigle_sindacali
-- ======================================================================
CREATE TABLE public.scadenze_bandi_sigle_sindacali (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sigla character varying(200) NOT NULL,
    nome_completo character varying(300) DEFAULT ''::character varying NOT NULL,
    confederazione character varying(100) DEFAULT ''::character varying,
    attivo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_sigle_sindacali ADD CONSTRAINT scadenze_bandi_sigle_sindacali_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_sigle_sindacali ADD CONSTRAINT scadenze_bandi_sigle_sindacali_sigla_key UNIQUE (sigla);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_system_settings
-- ======================================================================
CREATE TABLE public.scadenze_bandi_system_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    description text,
    encrypted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_system_settings ADD CONSTRAINT scadenze_bandi_system_settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_system_settings ADD CONSTRAINT scadenze_bandi_system_settings_key_key UNIQUE (key);
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_system_settings_key ON public.scadenze_bandi_system_settings USING btree (key);
-- RLS: ABILITATA
--   Policy: nessuna
-- Privilegi anon: nessuno
-- Privilegi authenticated: nessuno

-- ======================================================================
-- TABELLA: public.scadenze_bandi_template_scadenze
-- ======================================================================
CREATE TABLE public.scadenze_bandi_template_scadenze (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bando_id uuid,
    nome text NOT NULL,
    descrizione text,
    giorni_da_evento integer NOT NULL,
    evento_riferimento text NOT NULL,
    tipo_scadenza text NOT NULL,
    priorita text DEFAULT 'media'::text,
    obbligatoria boolean DEFAULT true,
    ordine_sequenza integer DEFAULT 1,
    dipende_da_template_id uuid,
    responsabile_suggerito text,
    note_template text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    unita_tempo text DEFAULT 'giorni'::text,
    evento_riferimento_id uuid
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_template_scadenze ADD CONSTRAINT scadenze_bandi_template_scadenze_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_template_scadenze ADD CONSTRAINT scadenze_bandi_template_scadenze_bando_id_fkey FOREIGN KEY (bando_id) REFERENCES scadenze_bandi_bandi(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scadenze_bandi_template_scadenze ADD CONSTRAINT scadenze_bandi_template_scadenze_dipende_da_template_id_fkey FOREIGN KEY (dipende_da_template_id) REFERENCES scadenze_bandi_template_scadenze(id);
ALTER TABLE ONLY public.scadenze_bandi_template_scadenze ADD CONSTRAINT scadenze_bandi_template_scadenze_evento_riferimento_id_fkey FOREIGN KEY (evento_riferimento_id) REFERENCES scadenze_bandi_eventi_catalogo(id);
ALTER TABLE ONLY public.scadenze_bandi_template_scadenze ADD CONSTRAINT scadenze_bandi_template_scadenze_priorita_check CHECK ((priorita = ANY (ARRAY['bassa'::text, 'media'::text, 'alta'::text, 'critica'::text])));
ALTER TABLE ONLY public.scadenze_bandi_template_scadenze ADD CONSTRAINT scadenze_bandi_template_scadenze_unita_tempo_check CHECK ((unita_tempo = ANY (ARRAY['giorni'::text, 'mesi'::text])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_template_evento_ref ON public.scadenze_bandi_template_scadenze USING btree (evento_riferimento_id);
CREATE INDEX idx_template_scadenze_bando ON public.scadenze_bandi_template_scadenze USING btree (bando_id);
CREATE INDEX idx_template_scadenze_evento ON public.scadenze_bandi_template_scadenze USING btree (evento_riferimento);
CREATE INDEX idx_template_scadenze_tipo ON public.scadenze_bandi_template_scadenze USING btree (tipo_scadenza);
-- Trigger
CREATE TRIGGER trigger_update_template_scadenze_updated_at BEFORE UPDATE ON public.scadenze_bandi_template_scadenze FOR EACH ROW EXECUTE FUNCTION update_template_scadenze_updated_at();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_tipologie_bando
-- ======================================================================
CREATE TABLE public.scadenze_bandi_tipologie_bando (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    nome text NOT NULL,
    descrizione text,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_tipologie_bando ADD CONSTRAINT scadenze_bandi_tipologie_bando_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_tipologie_bando ADD CONSTRAINT scadenze_bandi_tipologie_bando_nome_key UNIQUE (nome);
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_tipologie_scadenze
-- ======================================================================
CREATE TABLE public.scadenze_bandi_tipologie_scadenze (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    nome text NOT NULL,
    descrizione text,
    giorni_preavviso_default integer[] DEFAULT ARRAY[30, 15, 7, 1],
    colore_hex text DEFAULT '#3B82F6'::text,
    ordine_visualizzazione integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_tipologie_scadenze ADD CONSTRAINT scadenze_bandi_tipologie_scadenze_pkey PRIMARY KEY (id);
-- Trigger
CREATE TRIGGER update_tipologie_updated_at BEFORE UPDATE ON public.scadenze_bandi_tipologie_scadenze FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: ABILITATA
--   POLICY "Accesso anonimo lettura tipologie" | PERMISSIVE | ruoli: anon | comando: SELECT | USING: true | WITH CHECK: -
--   POLICY "Utenti autenticati possono aggiornare tipologie scadenze" | PERMISSIVE | ruoli: authenticated | comando: UPDATE | USING: true | WITH CHECK: true
--   POLICY "Utenti autenticati possono eliminare tipologie scadenze" | PERMISSIVE | ruoli: authenticated | comando: DELETE | USING: true | WITH CHECK: -
--   POLICY "Utenti autenticati possono inserire tipologie scadenze" | PERMISSIVE | ruoli: authenticated | comando: INSERT | USING: - | WITH CHECK: true
--   POLICY "Utenti autenticati possono vedere tipologie scadenze" | PERMISSIVE | ruoli: authenticated | comando: SELECT | USING: true | WITH CHECK: -
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_uffici_dipartimenti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_uffici_dipartimenti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome character varying(150) NOT NULL,
    descrizione text DEFAULT ''::text,
    ordine integer DEFAULT 0 NOT NULL,
    attivo boolean DEFAULT true NOT NULL,
    personalizzato boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_uffici_dipartimenti ADD CONSTRAINT scadenze_bandi_uffici_dipartimenti_pkey PRIMARY KEY (id);
-- Indici (non legati a vincoli)
CREATE UNIQUE INDEX idx_uffici_nome ON public.scadenze_bandi_uffici_dipartimenti USING btree (nome) WHERE (attivo = true);
-- RLS: ABILITATA
--   POLICY "Tutti possono leggere uffici" | PERMISSIVE | ruoli: public | comando: SELECT | USING: true | WITH CHECK: -
--   POLICY "Utenti autenticati possono gestire uffici" | PERMISSIVE | ruoli: public | comando: ALL | USING: true | WITH CHECK: -
-- Privilegi anon: SELECT, INSERT, UPDATE, DELETE
-- Privilegi authenticated: SELECT, INSERT, UPDATE, DELETE

-- ======================================================================
-- TABELLA: public.scadenze_bandi_utenti
-- ======================================================================
CREATE TABLE public.scadenze_bandi_utenti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    nome character varying(100) NOT NULL,
    cognome character varying(100) NOT NULL,
    livello_permessi character varying(20) NOT NULL,
    attivo boolean DEFAULT true NOT NULL,
    ultimo_accesso timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    gruppo_id uuid,
    first_login_password_change boolean DEFAULT false,
    gmail_refresh_token text,
    gmail_access_token text,
    gmail_connected_at timestamp with time zone,
    gmail_email character varying(255),
    firma_email_html text
);
-- Vincoli
ALTER TABLE ONLY public.scadenze_bandi_utenti ADD CONSTRAINT scadenze_bandi_utenti_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scadenze_bandi_utenti ADD CONSTRAINT scadenze_bandi_utenti_email_key UNIQUE (email);
ALTER TABLE ONLY public.scadenze_bandi_utenti ADD CONSTRAINT scadenze_bandi_utenti_created_by_fkey FOREIGN KEY (created_by) REFERENCES scadenze_bandi_utenti(id);
ALTER TABLE ONLY public.scadenze_bandi_utenti ADD CONSTRAINT scadenze_bandi_utenti_gruppo_id_fkey FOREIGN KEY (gruppo_id) REFERENCES scadenze_bandi_gruppi_utenti(id);
ALTER TABLE ONLY public.scadenze_bandi_utenti ADD CONSTRAINT scadenze_bandi_utenti_livello_permessi_check CHECK (((livello_permessi)::text = ANY ((ARRAY['admin'::character varying, 'collaboratore'::character varying])::text[])));
-- Indici (non legati a vincoli)
CREATE INDEX idx_scadenze_bandi_utenti_attivo ON public.scadenze_bandi_utenti USING btree (attivo);
CREATE INDEX idx_scadenze_bandi_utenti_email ON public.scadenze_bandi_utenti USING btree (email);
CREATE INDEX idx_scadenze_bandi_utenti_livello ON public.scadenze_bandi_utenti USING btree (livello_permessi);
CREATE INDEX idx_utenti_gmail_connected ON public.scadenze_bandi_utenti USING btree (id) WHERE (gmail_refresh_token IS NOT NULL);
-- Trigger
CREATE TRIGGER update_scadenze_bandi_utenti_updated_at BEFORE UPDATE ON public.scadenze_bandi_utenti FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- RLS: DISABILITATA
--   Policy: nessuna
-- Privilegi anon: nessuno
-- Privilegi authenticated: nessuno
-- Privilegi per colonna (GRANT espliciti a livello di colonna, da pg_attribute.attacl):
--   anon su id: SELECT
--   anon su email: SELECT
--   anon su nome: SELECT
--   anon su cognome: SELECT
--   anon su livello_permessi: SELECT
--   anon su attivo: SELECT
--   anon su ultimo_accesso: SELECT
--   anon su created_at: SELECT
--   anon su updated_at: SELECT
--   anon su created_by: SELECT
--   anon su gruppo_id: SELECT, UPDATE
--   anon su first_login_password_change: SELECT
--   anon su gmail_connected_at: SELECT
--   anon su gmail_email: SELECT
--   anon su firma_email_html: SELECT
--   authenticated su id: SELECT
--   authenticated su email: SELECT
--   authenticated su nome: SELECT
--   authenticated su cognome: SELECT
--   authenticated su livello_permessi: SELECT
--   authenticated su attivo: SELECT
--   authenticated su ultimo_accesso: SELECT
--   authenticated su created_at: SELECT
--   authenticated su updated_at: SELECT
--   authenticated su created_by: SELECT
--   authenticated su gruppo_id: SELECT, UPDATE
--   authenticated su first_login_password_change: SELECT
--   authenticated su gmail_connected_at: SELECT
--   authenticated su gmail_email: SELECT
--   authenticated su firma_email_html: SELECT


-- ############################################################################
-- SEZIONE 2 - VISTE
-- ############################################################################

-- ======================================================================
-- VISTA: public.scadenze_bandi_bandi_view
-- security_invoker: NO (la vista gira con i privilegi del proprietario postgres, quindi bypassa la RLS delle tabelle sottostanti)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.scadenze_bandi_bandi_view AS
 SELECT b.id,
    b.nome,
    b.descrizione,
    b.tipo_bando,
    b.stato,
    b.created_at,
    b.updated_at,
    b.codice_bando,
    b.ente_erogatore,
    b.tipologia_bando,
    b.contributo_massimo,
    b.budget_totale,
    b.percentuale_contributo,
    b.data_pubblicazione,
    b.data_apertura_presentazione,
    b.data_chiusura_presentazione,
    b.tempo_valutazione_giorni,
    b.data_base_calcolo AS data_pubblicazione_graduatoria,
    b.link_bando_ufficiale,
    b.documenti_paths,
    b.settori_ammessi,
    b.dimensioni_aziendali_ammesse,
    b.localizzazione_geografica,
    b.note_interne,
    b.referente_bando,
    b.email_referente,
    b.stato_bando,
    b.tipo_valutazione,
    b.spesa_minima_ammessa,
    b.regime_aiuto,
        CASE
            WHEN b.data_apertura_presentazione IS NULL OR b.data_chiusura_presentazione IS NULL THEN 'PROSSIMA_APERTURA'::text
            WHEN CURRENT_DATE < b.data_apertura_presentazione THEN 'PROSSIMA_APERTURA'::text
            WHEN CURRENT_DATE >= b.data_apertura_presentazione AND CURRENT_DATE <= b.data_chiusura_presentazione THEN 'APERTO'::text
            WHEN CURRENT_DATE > b.data_chiusura_presentazione AND CURRENT_DATE <= (b.data_chiusura_presentazione + '1 day'::interval * COALESCE(b.tempo_valutazione_giorni, 60)::double precision) THEN 'IN_VALUTAZIONE'::text
            ELSE 'CHIUSO'::text
        END AS stato_calcolato,
        CASE
            WHEN b.data_apertura_presentazione IS NOT NULL AND CURRENT_DATE < b.data_apertura_presentazione THEN b.data_apertura_presentazione - CURRENT_DATE
            ELSE NULL::integer
        END AS giorni_ad_apertura,
        CASE
            WHEN b.data_chiusura_presentazione IS NOT NULL AND CURRENT_DATE <= b.data_chiusura_presentazione THEN b.data_chiusura_presentazione - CURRENT_DATE
            ELSE NULL::integer
        END AS giorni_a_chiusura,
    ( SELECT count(*) AS count
           FROM scadenze_bandi_progetti p
          WHERE p.bando_id = b.id) AS progetti_collegati,
    ( SELECT count(*) AS count
           FROM scadenze_bandi_progetti p
          WHERE p.bando_id = b.id AND (p.stato = ANY (ARRAY['IN_CORSO'::progetto_stato, 'ACCETTATO'::progetto_stato]))) AS progetti_attivi,
    ( SELECT count(*) AS count
           FROM scadenze_bandi_documenti d
          WHERE d.bando_id = b.id) AS documenti_caricati
   FROM scadenze_bandi_bandi b;

-- ======================================================================
-- VISTA: public.scadenze_bandi_clienti_completa
-- security_invoker: NO (la vista gira con i privilegi del proprietario postgres, quindi bypassa la RLS delle tabelle sottostanti)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.scadenze_bandi_clienti_completa AS
 SELECT c.id,
    c.denominazione,
    c.numero_azienda,
    c.partita_iva,
    c.rea,
    c.codice_fiscale,
    c.ateco_2025,
    c.ateco_descrizione,
    c.data_costituzione,
    c.email,
    c.pec,
    c.telefono,
    c.sito_web,
    c.coordinate_bancarie,
    c.sdi,
    c.indirizzo_fatturazione,
    c.cap_fatturazione,
    c.citta_fatturazione,
    c.provincia_fatturazione,
    c.stato_fatturazione,
    c.ula,
    c.ultimo_fatturato,
    c.attivo_bilancio,
    c.dimensione,
    c.matricola_inps,
    c.pat_inail,
    c.numero_dipendenti,
    c.numero_volontari,
    c.numero_collaboratori,
    c.tipo_collegamento,
    c.impresa_collegata_id,
    c.percentuale_partecipazione,
    c.diritti_voto,
    c.influenza_dominante,
    c.note_collegamento,
    c.categoria_evolvi,
    c.durata_evolvi,
    c.scadenza_evolvi,
    c.assegnato_a,
    c.target,
    c.membro_di,
    c.proprietario,
    c.rating,
    c.descrizione,
    c.note,
    c.created_at,
    c.updated_at,
    c.creato_da,
    c.legale_rappresentante,
    c.data_bilancio_consolidato,
    c.legale_rappresentante_nome,
    c.legale_rappresentante_cognome,
    c.legale_rappresentante_codice_fiscale,
    c.legale_rappresentante_data_nascita,
    c.legale_rappresentante_luogo_nascita,
    c.legale_rappresentante_provincia_nascita,
    c.legale_rappresentante_nazionalita,
    c.legale_rappresentante_indirizzo,
    c.legale_rappresentante_cap,
    c.legale_rappresentante_citta,
    c.legale_rappresentante_provincia,
    c.legale_rappresentante_email,
    c.legale_rappresentante_telefono,
    c.legale_rappresentante_note,
        CASE
            WHEN c.legale_rappresentante_nome IS NOT NULL AND c.legale_rappresentante_cognome IS NOT NULL THEN (c.legale_rappresentante_nome || ' '::text) || c.legale_rappresentante_cognome
            ELSE NULL::text
        END AS legale_rappresentante_completo,
        CASE
            WHEN c.legale_rappresentante_data_nascita IS NOT NULL THEN date_part('year'::text, age(c.legale_rappresentante_data_nascita::timestamp with time zone))
            ELSE NULL::double precision
        END AS legale_rappresentante_eta
   FROM scadenze_bandi_clienti c;

-- ======================================================================
-- VISTA: public.scadenze_bandi_clienti_con_dimensione_aggregata
-- security_invoker: NO (la vista gira con i privilegi del proprietario postgres, quindi bypassa la RLS delle tabelle sottostanti)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.scadenze_bandi_clienti_con_dimensione_aggregata AS
 SELECT c.id,
    c.denominazione,
    c.numero_azienda,
    c.partita_iva,
    c.rea,
    c.codice_fiscale,
    c.ateco_2025,
    c.ateco_descrizione,
    c.data_costituzione,
    c.email,
    c.pec,
    c.telefono,
    c.sito_web,
    c.coordinate_bancarie,
    c.sdi,
    c.indirizzo_fatturazione,
    c.cap_fatturazione,
    c.citta_fatturazione,
    c.provincia_fatturazione,
    c.stato_fatturazione,
    c.ula,
    c.ultimo_fatturato,
    c.attivo_bilancio,
    c.dimensione,
    c.matricola_inps,
    c.pat_inail,
    c.numero_dipendenti,
    c.numero_volontari,
    c.numero_collaboratori,
    c.tipo_collegamento,
    c.impresa_collegata_id,
    c.percentuale_partecipazione,
    c.diritti_voto,
    c.influenza_dominante,
    c.note_collegamento,
    c.categoria_evolvi,
    c.durata_evolvi,
    c.scadenza_evolvi,
    c.assegnato_a,
    c.target,
    c.membro_di,
    c.proprietario,
    c.rating,
    c.descrizione,
    c.note,
    c.created_at,
    c.updated_at,
    c.creato_da,
    c.legale_rappresentante,
    c.data_bilancio_consolidato,
    c.legale_rappresentante_nome,
    c.legale_rappresentante_cognome,
    c.legale_rappresentante_codice_fiscale,
    c.legale_rappresentante_data_nascita,
    c.legale_rappresentante_luogo_nascita,
    c.legale_rappresentante_provincia_nascita,
    c.legale_rappresentante_nazionalita,
    c.legale_rappresentante_indirizzo,
    c.legale_rappresentante_cap,
    c.legale_rappresentante_citta,
    c.legale_rappresentante_provincia,
    c.legale_rappresentante_email,
    c.legale_rappresentante_telefono,
    c.legale_rappresentante_note,
        CASE
            WHEN c.legale_rappresentante_nome IS NOT NULL AND c.legale_rappresentante_cognome IS NOT NULL THEN (c.legale_rappresentante_nome || ' '::text) || c.legale_rappresentante_cognome
            ELSE NULL::text
        END AS legale_rappresentante_completo,
        CASE
            WHEN c.ula < 10::numeric AND (c.ultimo_fatturato <= 2000000::numeric OR c.attivo_bilancio <= 2000000::numeric) THEN 'MICRO'::text
            WHEN c.ula < 50::numeric AND (c.ultimo_fatturato <= 10000000::numeric OR c.attivo_bilancio <= 10000000::numeric) THEN 'PICCOLA'::text
            WHEN c.ula < 250::numeric AND (c.ultimo_fatturato <= 50000000::numeric OR c.attivo_bilancio <= 43000000::numeric) THEN 'MEDIA'::text
            ELSE 'GRANDE'::text
        END AS dimensione_aggregata,
    0 AS numero_collegamenti
   FROM scadenze_bandi_clienti c;

-- ======================================================================
-- VISTA: public.scadenze_bandi_clienti_con_documenti
-- security_invoker: NO (la vista gira con i privilegi del proprietario postgres, quindi bypassa la RLS delle tabelle sottostanti)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.scadenze_bandi_clienti_con_documenti AS
 SELECT c.id,
    c.denominazione,
    c.numero_azienda,
    c.partita_iva,
    c.rea,
    c.codice_fiscale,
    c.ateco_2025,
    c.ateco_descrizione,
    c.data_costituzione,
    c.email,
    c.pec,
    c.telefono,
    c.sito_web,
    c.coordinate_bancarie,
    c.sdi,
    c.indirizzo_fatturazione,
    c.cap_fatturazione,
    c.citta_fatturazione,
    c.provincia_fatturazione,
    c.stato_fatturazione,
    c.ula,
    c.ultimo_fatturato,
    c.attivo_bilancio,
    c.dimensione,
    c.matricola_inps,
    c.pat_inail,
    c.numero_dipendenti,
    c.numero_volontari,
    c.numero_collaboratori,
    c.tipo_collegamento,
    c.impresa_collegata_id,
    c.percentuale_partecipazione,
    c.diritti_voto,
    c.influenza_dominante,
    c.note_collegamento,
    c.categoria_evolvi,
    c.durata_evolvi,
    c.scadenza_evolvi,
    c.assegnato_a,
    c.target,
    c.membro_di,
    c.proprietario,
    c.rating,
    c.descrizione,
    c.note,
    c.created_at,
    c.updated_at,
    c.creato_da,
    c.legale_rappresentante,
    c.data_bilancio_consolidato,
    c.legale_rappresentante_nome,
    c.legale_rappresentante_cognome,
    c.legale_rappresentante_codice_fiscale,
    c.legale_rappresentante_data_nascita,
    c.legale_rappresentante_luogo_nascita,
    c.legale_rappresentante_provincia_nascita,
    c.legale_rappresentante_nazionalita,
    c.legale_rappresentante_indirizzo,
    c.legale_rappresentante_cap,
    c.legale_rappresentante_citta,
    c.legale_rappresentante_provincia,
    c.legale_rappresentante_email,
    c.legale_rappresentante_telefono,
    c.legale_rappresentante_note,
    c.created_by,
    c.updated_by,
    c.estremi_iscrizione_runts,
    c.banca_filiale,
    COALESCE(json_agg(json_build_object('id', d.id, 'nome_file', d.nome_file, 'nome_originale', d.nome_originale, 'categoria', d.categoria, 'file_path', d.file_path, 'file_size', d.file_size, 'mime_type', d.mime_type, 'created_at', d.created_at)) FILTER (WHERE d.id IS NOT NULL), '[]'::json) AS documenti
   FROM scadenze_bandi_clienti c
     LEFT JOIN scadenze_bandi_clienti_documenti d ON c.id = d.cliente_id
  GROUP BY c.id;

-- ======================================================================
-- VISTA: public.scadenze_bandi_clienti_con_referenti
-- security_invoker: NO (la vista gira con i privilegi del proprietario postgres, quindi bypassa la RLS delle tabelle sottostanti)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.scadenze_bandi_clienti_con_referenti AS
 SELECT c.id,
    c.denominazione,
    c.numero_azienda,
    c.partita_iva,
    c.rea,
    c.codice_fiscale,
    c.ateco_2025,
    c.ateco_descrizione,
    c.data_costituzione,
    c.email,
    c.pec,
    c.telefono,
    c.sito_web,
    c.coordinate_bancarie,
    c.sdi,
    c.indirizzo_fatturazione,
    c.cap_fatturazione,
    c.citta_fatturazione,
    c.provincia_fatturazione,
    c.stato_fatturazione,
    c.ula,
    c.ultimo_fatturato,
    c.attivo_bilancio,
    c.dimensione,
    c.matricola_inps,
    c.pat_inail,
    c.numero_dipendenti,
    c.numero_volontari,
    c.numero_collaboratori,
    c.tipo_collegamento,
    c.impresa_collegata_id,
    c.percentuale_partecipazione,
    c.diritti_voto,
    c.influenza_dominante,
    c.note_collegamento,
    c.categoria_evolvi,
    c.durata_evolvi,
    c.scadenza_evolvi,
    c.assegnato_a,
    c.target,
    c.membro_di,
    c.proprietario,
    c.rating,
    c.descrizione,
    c.note,
    c.created_at,
    c.updated_at,
    c.creato_da,
    c.legale_rappresentante,
    c.data_bilancio_consolidato,
    c.legale_rappresentante_nome,
    c.legale_rappresentante_cognome,
    c.legale_rappresentante_codice_fiscale,
    c.legale_rappresentante_data_nascita,
    c.legale_rappresentante_luogo_nascita,
    c.legale_rappresentante_provincia_nascita,
    c.legale_rappresentante_nazionalita,
    c.legale_rappresentante_indirizzo,
    c.legale_rappresentante_cap,
    c.legale_rappresentante_citta,
    c.legale_rappresentante_provincia,
    c.legale_rappresentante_email,
    c.legale_rappresentante_telefono,
    c.legale_rappresentante_note,
    c.created_by,
    c.updated_by,
    c.estremi_iscrizione_runts,
    c.banca_filiale,
    COALESCE(json_agg(json_build_object('id', r.id, 'cognome', r.cognome, 'nome', r.nome, 'email', r.email, 'telefono', r.telefono, 'note', r.note)) FILTER (WHERE r.id IS NOT NULL), '[]'::json) AS referenti
   FROM scadenze_bandi_clienti c
     LEFT JOIN scadenze_bandi_clienti_referenti r ON c.id = r.cliente_id
  GROUP BY c.id;

-- ======================================================================
-- VISTA: public.scadenze_bandi_clienti_note_full
-- security_invoker: NO (la vista gira con i privilegi del proprietario postgres, quindi bypassa la RLS delle tabelle sottostanti)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.scadenze_bandi_clienti_note_full AS
 SELECT n.id,
    n.cliente_id,
    n.data_riunione,
    n.data_caricamento,
    n.durata_minuti_stimata,
    n.tipo,
    n.titolo,
    n.sintesi_one_liner,
    n.contenuto_markdown,
    n.entita,
    n.verifiche_suggerite,
    n.sorgente,
    n.drive_file_id,
    n.drive_file_url,
    n.filename_originale,
    n.match_confidence,
    n.match_method,
    n.stato,
    n.created_by,
    n.created_at,
    n.updated_at,
    COALESCE(( SELECT json_agg(json_build_object('link_id', nb.id, 'bando_id', nb.bando_id, 'bando_nome', b.nome, 'stato', nb.stato, 'score', nb.score, 'metodo', nb.metodo) ORDER BY nb.created_at DESC) AS json_agg
           FROM scadenze_bandi_note_bandi nb
             LEFT JOIN scadenze_bandi_bandi b ON b.id = nb.bando_id
          WHERE nb.nota_id = n.id), '[]'::json) AS bandi_collegati,
    COALESCE(( SELECT json_agg(json_build_object('link_id', np.id, 'progetto_id', np.progetto_id, 'progetto_nome', p.titolo_progetto, 'stato', np.stato, 'score', np.score, 'metodo', np.metodo) ORDER BY np.created_at DESC) AS json_agg
           FROM scadenze_bandi_note_progetti np
             LEFT JOIN scadenze_bandi_progetti p ON p.id = np.progetto_id
          WHERE np.nota_id = n.id), '[]'::json) AS progetti_collegati,
    c.denominazione AS cliente_denominazione
   FROM scadenze_bandi_clienti_note n
     LEFT JOIN scadenze_bandi_clienti c ON c.id = n.cliente_id;

-- ======================================================================
-- VISTA: public.scadenze_bandi_dashboard
-- security_invoker: NO (la vista gira con i privilegi del proprietario postgres, quindi bypassa la RLS delle tabelle sottostanti)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.scadenze_bandi_dashboard AS
 SELECT c.id,
    now() AS data_scadenza,
    'non_iniziata'::text AS stato,
    'media'::text AS priorita,
    c.email AS responsabile_email,
    'Dashboard temporanea'::text AS nota_scadenza,
    'Generale'::text AS tipo_scadenza,
    '#3B82F6'::text AS colore_hex,
    c.denominazione AS nome_progetto,
    'Bando Generale'::text AS nome_bando,
    c.denominazione AS nome_cliente,
    c.email AS email_cliente,
    0 AS giorni_rimanenti
   FROM scadenze_bandi_clienti c
 LIMIT 0;

-- ======================================================================
-- VISTA: public.scadenze_bandi_documenti_progetto_view
-- security_invoker: NO (la vista gira con i privilegi del proprietario postgres, quindi bypassa la RLS delle tabelle sottostanti)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.scadenze_bandi_documenti_progetto_view AS
 SELECT dp.id,
    dp.progetto_id,
    dp.nome_file,
    dp.nome_originale,
    dp.tipo_documento,
    dp.formato_file,
    dp.dimensione_bytes,
    dp.url_file,
    dp.categoria,
    dp.sal_riferimento,
    dp.stato_compilazione,
    dp.bando_documento_origine_id,
    dp.ereditato_da_bando,
    dp.auto_compilazione_completata,
    dp.campi_auto_compilati,
    dp.data_ultima_auto_compilazione,
    dp.descrizione,
    dp.note_compilazione,
    dp.caricato_da,
    dp.compilato_da,
    dp.approvato_da,
    dp.data_approvazione,
    dp.versione,
    dp.created_at,
    dp.updated_at,
    p.titolo_progetto AS progetto_nome,
    p.codice_progetto,
    p.cliente_id,
    p.bando_id,
        CASE
            WHEN dp.ereditato_da_bando THEN b.nome
            ELSE NULL::text
        END AS bando_origine_nome,
        CASE
            WHEN dp.bando_documento_origine_id IS NOT NULL THEN bd.nome_file
            ELSE NULL::text
        END AS file_origine_bando,
        CASE dp.stato_compilazione
            WHEN 'compilato'::text THEN '✅ Compilato'::text
            WHEN 'in_compilazione'::text THEN '🔄 In corso'::text
            WHEN 'approvato'::text THEN '🎯 Approvato'::text
            ELSE '📝 Da compilare'::text
        END AS stato_display,
        CASE
            WHEN dp.auto_compilazione_completata THEN '🤖 Auto-compilato'::text
            WHEN dp.categoria = 'ereditato'::text AND NOT dp.auto_compilazione_completata THEN '⏳ Pronto per auto-compilazione'::text
            ELSE NULL::text
        END AS auto_compilazione_status
   FROM scadenze_bandi_documenti_progetto dp
     LEFT JOIN scadenze_bandi_progetti p ON dp.progetto_id = p.id
     LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
     LEFT JOIN scadenze_bandi_documenti bd ON dp.bando_documento_origine_id = bd.id
  ORDER BY dp.created_at DESC;

-- ======================================================================
-- VISTA: public.scadenze_bandi_progetti_view
-- security_invoker: NO (la vista gira con i privilegi del proprietario postgres, quindi bypassa la RLS delle tabelle sottostanti)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.scadenze_bandi_progetti_view AS
 SELECT p.id,
    p.bando_id,
    p.cliente_id,
    p.codice_progetto,
    p.titolo_progetto,
    p.descrizione_progetto,
    p.stato,
    p.importo_totale_progetto,
    p.contributo_ammesso,
    p.percentuale_contributo,
    p.data_decreto_concessione,
    p.scadenza_accettazione_esiti,
    p.data_effettiva_accettazione_esiti,
    p.data_avvio_progetto,
    p.data_fine_progetto_prevista,
    p.data_fine_progetto_effettiva,
    p.anticipo_richiedibile,
    p.percentuale_anticipo,
    p.scadenza_richiesta_anticipo,
    p.data_effettiva_richiesta_anticipo,
    p.importo_anticipo_erogato,
    p.numero_sal,
    p.scadenza_primo_sal,
    p.data_effettiva_primo_sal,
    p.scadenza_secondo_sal,
    p.data_effettiva_secondo_sal,
    p.scadenza_saldo_finale,
    p.data_effettiva_saldo_finale,
    p.proroga_richiedibile,
    p.scadenza_richiesta_proroga,
    p.data_effettiva_richiesta_proroga,
    p.mesi_proroga_concessi,
    p.scadenza_rendicontazione_finale,
    p.data_effettiva_rendicontazione_finale,
    p.modalita_calcolo_scadenza_rendicontazione,
    p.referente_interno,
    p.email_referente_interno,
    p.note_progetto,
    p.documenti_paths,
    p.created_at,
    p.updated_at,
    p.data_base_calcolo AS data_pubblicazione_graduatoria,
    b.nome AS bando_nome,
    b.codice_bando,
    b.ente_erogatore,
    b.tipologia_bando,
    b.contributo_massimo AS bando_contributo_massimo,
    c.denominazione AS cliente_denominazione,
    c.email AS cliente_email,
    c.partita_iva AS cliente_piva,
        CASE
            WHEN p.scadenza_accettazione_esiti IS NOT NULL AND p.data_effettiva_accettazione_esiti IS NULL THEN p.scadenza_accettazione_esiti - CURRENT_DATE
            ELSE NULL::integer
        END AS giorni_ad_accettazione,
        CASE
            WHEN p.scadenza_richiesta_anticipo IS NOT NULL AND p.data_effettiva_richiesta_anticipo IS NULL THEN p.scadenza_richiesta_anticipo - CURRENT_DATE
            ELSE NULL::integer
        END AS giorni_a_richiesta_anticipo,
        CASE
            WHEN p.scadenza_rendicontazione_finale IS NOT NULL THEN p.scadenza_rendicontazione_finale - CURRENT_DATE
            ELSE NULL::integer
        END AS giorni_a_rendicontazione,
        CASE
            WHEN p.stato = 'COMPLETATO'::progetto_stato THEN 'COMPLETATO'::text
            WHEN p.data_effettiva_accettazione_esiti IS NULL AND p.scadenza_accettazione_esiti IS NOT NULL AND CURRENT_DATE > p.scadenza_accettazione_esiti THEN 'DECRETO_RICEVUTO'::text
            WHEN p.data_effettiva_accettazione_esiti IS NULL THEN 'DECRETO_ATTESO'::text
            WHEN p.data_avvio_progetto IS NULL THEN 'ACCETTATO'::text
            WHEN p.data_avvio_progetto IS NOT NULL AND p.scadenza_rendicontazione_finale IS NOT NULL AND CURRENT_DATE <= p.scadenza_rendicontazione_finale THEN 'IN_CORSO'::text
            WHEN p.scadenza_rendicontazione_finale IS NOT NULL AND CURRENT_DATE > p.scadenza_rendicontazione_finale THEN 'IN_CORSO'::text
            ELSE p.stato::text
        END AS stato_calcolato,
    COALESCE(( SELECT count(*) AS count
           FROM scadenze_bandi_documenti_progetto
          WHERE scadenze_bandi_documenti_progetto.progetto_id = p.id), 0::bigint) AS documenti_caricati,
    COALESCE(( SELECT count(*) AS count
           FROM scadenze_bandi_scadenze
          WHERE scadenze_bandi_scadenze.progetto_id = p.id), 0::bigint) AS scadenze_totali,
    COALESCE(( SELECT count(*) AS count
           FROM scadenze_bandi_scadenze
          WHERE scadenze_bandi_scadenze.progetto_id = p.id AND (scadenze_bandi_scadenze.stato <> ALL (ARRAY['completata'::scadenze_bandi_stato_scadenza, 'annullata'::scadenze_bandi_stato_scadenza]))), 0::bigint) AS scadenze_attive,
        CASE
            WHEN p.stato = 'COMPLETATO'::progetto_stato THEN 100
            WHEN p.scadenza_rendicontazione_finale IS NOT NULL AND CURRENT_DATE > p.scadenza_rendicontazione_finale THEN 95
            WHEN p.data_avvio_progetto IS NOT NULL THEN
            CASE
                WHEN p.data_effettiva_richiesta_anticipo IS NOT NULL THEN 75
                ELSE 50
            END
            WHEN p.data_effettiva_accettazione_esiti IS NOT NULL THEN 25
            ELSE 10
        END AS percentuale_completamento
   FROM scadenze_bandi_progetti p
     LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
     LEFT JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id
  ORDER BY p.created_at DESC;

-- ======================================================================
-- VISTA: public.scadenze_bandi_template_view
-- security_invoker: NO (la vista gira con i privilegi del proprietario postgres, quindi bypassa la RLS delle tabelle sottostanti)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.scadenze_bandi_template_view AS
 SELECT ts.id,
    ts.bando_id,
    ts.nome,
    ts.descrizione,
    ts.giorni_da_evento,
    ts.evento_riferimento,
    ts.tipo_scadenza,
    ts.priorita,
    ts.obbligatoria,
    ts.ordine_sequenza,
    ts.dipende_da_template_id,
    ts.responsabile_suggerito,
    ts.note_template,
    ts.created_at,
    ts.updated_at,
    ts.unita_tempo,
    b.nome AS bando_nome,
    b.codice_bando,
    b.tipologia_bando,
    dep.nome AS dipende_da_nome,
    dep.tipo_scadenza AS dipende_da_tipo
   FROM scadenze_bandi_template_scadenze ts
     LEFT JOIN scadenze_bandi_bandi b ON ts.bando_id = b.id
     LEFT JOIN scadenze_bandi_template_scadenze dep ON ts.dipende_da_template_id = dep.id
  ORDER BY ts.ordine_sequenza, ts.giorni_da_evento;

-- ======================================================================
-- VISTA: public.scadenze_bandi_utenti_view
-- security_invoker: NO (la vista gira con i privilegi del proprietario postgres, quindi bypassa la RLS delle tabelle sottostanti)
-- Privilegi SELECT: anon=no, authenticated=no
-- ======================================================================
CREATE VIEW public.scadenze_bandi_utenti_view AS
 SELECT scadenze_bandi_utenti.id,
    scadenze_bandi_utenti.email,
    scadenze_bandi_utenti.nome,
    scadenze_bandi_utenti.cognome,
    scadenze_bandi_utenti.livello_permessi,
    scadenze_bandi_utenti.attivo,
    scadenze_bandi_utenti.ultimo_accesso,
    scadenze_bandi_utenti.created_at,
    scadenze_bandi_utenti.updated_at,
    scadenze_bandi_utenti.created_by,
    concat(scadenze_bandi_utenti.nome, ' ', scadenze_bandi_utenti.cognome) AS nome_completo
   FROM scadenze_bandi_utenti
  WHERE scadenze_bandi_utenti.attivo = true;

-- ======================================================================
-- VISTA: public.scadenze_enhanced_simple
-- security_invoker: NO (la vista gira con i privilegi del proprietario postgres, quindi bypassa la RLS delle tabelle sottostanti)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.scadenze_enhanced_simple AS
 SELECT s.id,
    s.progetto_id,
    s.tipologia_scadenza_id,
    s.data_scadenza,
    s.stato,
    s.priorita,
    s.responsabile_email,
    s.note,
    s.completata_da,
    s.completata_il,
    s.giorni_preavviso,
    s.alert_inviati,
    s.created_at,
    s.updated_at,
    s.cliente_id,
    s.titolo,
    s.bando_id,
    s.data_scadenza::date - CURRENT_DATE AS giorni_rimanenti,
        CASE
            WHEN (s.data_scadenza::date - CURRENT_DATE) <= 2 THEN 'URGENTE'::text
            WHEN (s.data_scadenza::date - CURRENT_DATE) <= 7 THEN 'IMMINENTE'::text
            ELSE 'NORMALE'::text
        END AS urgenza,
    p.titolo_progetto,
    p.codice_progetto,
    COALESCE(c_diretto.denominazione, c_progetto.denominazione) AS cliente_denominazione,
    COALESCE(b_diretto.nome, b_progetto.nome) AS bando_nome,
    COALESCE(b_diretto.codice_bando, b_progetto.codice_bando) AS bando_codice,
    t.nome AS tipologia_nome,
        CASE
            WHEN s.progetto_id IS NOT NULL THEN 'PROGETTO'::text
            WHEN s.bando_id IS NOT NULL THEN 'BANDO'::text
            WHEN s.cliente_id IS NOT NULL THEN 'CLIENTE'::text
            ELSE 'GENERALE'::text
        END AS entita_collegata
   FROM scadenze_bandi_scadenze s
     LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
     LEFT JOIN scadenze_bandi_clienti c_diretto ON s.cliente_id = c_diretto.id
     LEFT JOIN scadenze_bandi_clienti c_progetto ON p.cliente_id = c_progetto.id
     LEFT JOIN scadenze_bandi_bandi b_diretto ON s.bando_id = b_diretto.id
     LEFT JOIN scadenze_bandi_bandi b_progetto ON p.bando_id = b_progetto.id
     LEFT JOIN scadenze_bandi_tipologie_scadenze t ON s.tipologia_scadenza_id = t.id;

-- ======================================================================
-- VISTA: public.vista_contributi_ottenuti
-- security_invoker: SI (reloptions: security_invoker=true)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.vista_contributi_ottenuti AS
 SELECT c.id,
    c.cliente_id,
    c.progetto_id,
    c.anno_competenza,
    c.bando_id,
    COALESCE(b.nome, c.bando_denominazione_manuale) AS bando_nome,
    b.codice_bando AS bando_codice,
    COALESCE(c.ente_erogatore, b.ente_erogatore) AS ente_erogatore,
    c.forma_contributo,
    c.stato,
    c.origine,
    c.importo_progetto,
    c.importo_contributo,
    c.esl,
    c.intensita_aiuto_pct,
    c.regime_aiuto,
    c.rna_codice_concessione,
    c.rna_url,
    c.data_concessione,
    c.data_erogazione,
    c.note,
    c.created_at,
    c.updated_at,
    p.codice_progetto AS progetto_codice,
    p.titolo_progetto AS progetto_titolo,
    cl.denominazione AS cliente_denominazione,
    cl.partita_iva AS cliente_partita_iva,
    cl.provincia_fatturazione AS cliente_provincia,
    cl.email AS cliente_email,
    cl.pec AS cliente_pec,
    cl.categoria_evolvi AS cliente_categoria_evolvi,
    cl.dimensione AS cliente_dimensione,
    cl.ateco_2025 AS cliente_ateco
   FROM scadenze_bandi_contributi_ottenuti c
     JOIN scadenze_bandi_clienti cl ON cl.id = c.cliente_id
     LEFT JOIN scadenze_bandi_bandi b ON b.id = c.bando_id
     LEFT JOIN scadenze_bandi_progetti p ON p.id = c.progetto_id;

-- ======================================================================
-- VISTA: public.vista_match_bandi_clienti
-- security_invoker: NO (la vista gira con i privilegi del proprietario postgres, quindi bypassa la RLS delle tabelle sottostanti)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.vista_match_bandi_clienti AS
 WITH esig AS (
         SELECT e.cliente_id,
            array_agg(DISTINCT c.c) AS categorie
           FROM scadenze_bandi_clienti_esigenze e,
            LATERAL unnest(e.categorie) c(c)
          WHERE e.stato = 'attiva'::text
          GROUP BY e.cliente_id
        )
 SELECT cl.id AS cliente_id,
    cl.denominazione AS cliente_denominazione,
    cl.partita_iva AS cliente_partita_iva,
    cl.provincia_fatturazione AS cliente_provincia,
    b.id AS bando_id,
    b.titolo,
    b.fonte,
    b.tipologia_aiuto,
    b.stato,
    b.data_apertura,
    b.data_scadenza,
    b.url_dettagli,
    b.investimenti_spesati,
    ARRAY( SELECT unnest(b.investimenti_spesati) AS unnest
        INTERSECT
         SELECT unnest(esig.categorie) AS unnest) AS categorie_in_comune
   FROM esig
     JOIN scadenze_bandi_clienti cl ON cl.id = esig.cliente_id
     JOIN scadenze_bandi_bandi_esterni b ON (b.stato = ANY (ARRAY['attivo'::text, 'in_apertura'::text])) AND b.investimenti_spesati && esig.categorie
  WHERE NOT (EXISTS ( SELECT 1
           FROM scadenze_bandi_clienti_bandi_esterni ov
          WHERE ov.cliente_id = cl.id AND ov.bando_esterno_id = b.id));

-- ======================================================================
-- VISTA: public.vista_match_bandi_per_cliente
-- security_invoker: NO (la vista gira con i privilegi del proprietario postgres, quindi bypassa la RLS delle tabelle sottostanti)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.vista_match_bandi_per_cliente AS
 WITH cats AS (
         SELECT m_1.cliente_id,
            array_agg(DISTINCT cc.cc ORDER BY cc.cc) AS categorie_coperte
           FROM vista_match_bandi_clienti m_1,
            LATERAL unnest(m_1.categorie_in_comune) cc(cc)
          GROUP BY m_1.cliente_id
        )
 SELECT m.cliente_id,
    m.cliente_denominazione,
    m.cliente_partita_iva,
    m.cliente_provincia,
    count(*)::integer AS n_bandi,
    count(*) FILTER (WHERE m.stato = 'attivo'::text)::integer AS n_bandi_attivi,
    count(*) FILTER (WHERE m.stato = 'in_apertura'::text)::integer AS n_bandi_in_apertura,
    c.categorie_coperte,
    array_agg(m.titolo ORDER BY m.titolo) AS bandi_titoli
   FROM vista_match_bandi_clienti m
     JOIN cats c USING (cliente_id)
  GROUP BY m.cliente_id, m.cliente_denominazione, m.cliente_partita_iva, m.cliente_provincia, c.categorie_coperte;

-- ======================================================================
-- VISTA: public.vista_rna_aiuti
-- security_invoker: SI (reloptions: security_invoker=true)
-- Privilegi SELECT: anon=si, authenticated=si
-- ======================================================================
CREATE VIEW public.vista_rna_aiuti AS
 SELECT a.id,
    a.cor,
    a.car,
    a.titolo_misura,
    a.soggetto_concedente,
    a.data_concessione,
    a.anno_concessione,
    a.procedimenti,
    a.regolamenti,
    a.strumenti,
    a.forma_proposta,
    a.importo_nominale,
    a.elemento_aiuto,
    a.de_minimis,
    a.ambito,
    a.fondo_interprofessionale,
    a.contributo_id IS NOT NULL AS nostro,
    a.contributo_id,
    a.link_atto_concessione,
    a.link_trasparenza,
    a.cliente_id,
    cl.denominazione AS cliente_denominazione,
    cl.partita_iva AS cliente_partita_iva,
    cl.provincia_fatturazione AS cliente_provincia,
    cl.email AS cliente_email,
    cl.pec AS cliente_pec,
    cl.categoria_evolvi AS cliente_categoria_evolvi,
    cl.dimensione AS cliente_dimensione
   FROM scadenze_bandi_rna_aiuti a
     JOIN scadenze_bandi_clienti cl ON cl.id = a.cliente_id;


-- ############################################################################
-- SEZIONE 3 - FUNZIONI
-- ############################################################################

-- ======================================================================
-- FUNZIONE: find_note_candidate_for_bando(uuid,real)
-- SECURITY DEFINER: NO (SECURITY INVOKER) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si
-- ======================================================================
CREATE OR REPLACE FUNCTION public.find_note_candidate_for_bando(p_bando_id uuid, p_soglia real DEFAULT 0.4)
 RETURNS TABLE(nota_id uuid, titolo text, cliente_id uuid, cliente_denominazione text, data_riunione date, score real)
 LANGUAGE sql
 STABLE
AS $function$
    WITH bando AS (
        SELECT lower(nome) AS nome_l
        FROM scadenze_bandi_bandi
        WHERE id = p_bando_id
    ),
    candidati AS (
        SELECT
            n.id AS nota_id,
            n.titolo,
            n.cliente_id,
            n.data_riunione,
            MAX(word_similarity(
                (SELECT nome_l FROM bando),
                lower(elem)
            )) AS score
        FROM scadenze_bandi_clienti_note n,
             jsonb_array_elements_text(
                COALESCE(n.entita->'bandi', '[]'::jsonb)
             ) AS elem
        WHERE n.stato IN ('pubblicata', 'archiviata')
        GROUP BY n.id, n.titolo, n.cliente_id, n.data_riunione
    )
    SELECT
        c.nota_id,
        c.titolo,
        c.cliente_id,
        cl.denominazione AS cliente_denominazione,
        c.data_riunione,
        c.score
    FROM candidati c
    LEFT JOIN scadenze_bandi_clienti cl ON cl.id = c.cliente_id
    WHERE c.score > p_soglia
      AND NOT EXISTS (
          SELECT 1 FROM scadenze_bandi_note_bandi nb
          WHERE nb.nota_id = c.nota_id
            AND nb.bando_id = p_bando_id
      )
    ORDER BY c.score DESC
    LIMIT 20;
$function$
;

-- ======================================================================
-- FUNZIONE: find_note_candidate_for_progetto(uuid,real)
-- SECURITY DEFINER: NO (SECURITY INVOKER) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si
-- ======================================================================
CREATE OR REPLACE FUNCTION public.find_note_candidate_for_progetto(p_progetto_id uuid, p_soglia real DEFAULT 0.4)
 RETURNS TABLE(nota_id uuid, titolo text, cliente_id uuid, cliente_denominazione text, data_riunione date, score real)
 LANGUAGE sql
 STABLE
AS $function$
    WITH progetto AS (
        SELECT lower(titolo_progetto) AS nome_l
        FROM scadenze_bandi_progetti
        WHERE id = p_progetto_id AND titolo_progetto IS NOT NULL
    ),
    candidati AS (
        SELECT
            n.id AS nota_id,
            n.titolo,
            n.cliente_id,
            n.data_riunione,
            MAX(word_similarity(
                (SELECT nome_l FROM progetto),
                lower(elem)
            )) AS score
        FROM scadenze_bandi_clienti_note n,
             jsonb_array_elements_text(
                COALESCE(n.entita->'progetti', '[]'::jsonb)
             ) AS elem
        WHERE n.stato IN ('pubblicata', 'archiviata')
          AND EXISTS (SELECT 1 FROM progetto)
        GROUP BY n.id, n.titolo, n.cliente_id, n.data_riunione
    )
    SELECT
        c.nota_id,
        c.titolo,
        c.cliente_id,
        cl.denominazione AS cliente_denominazione,
        c.data_riunione,
        c.score
    FROM candidati c
    LEFT JOIN scadenze_bandi_clienti cl ON cl.id = c.cliente_id
    WHERE c.score > p_soglia
      AND NOT EXISTS (
          SELECT 1 FROM scadenze_bandi_note_progetti np
          WHERE np.nota_id = c.nota_id
            AND np.progetto_id = p_progetto_id
      )
    ORDER BY c.score DESC
    LIMIT 20;
$function$
;

-- ======================================================================
-- FUNZIONE: generate_numero_contratto_evolvi()
-- SECURITY DEFINER: NO (SECURITY INVOKER) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si | usata dai trigger: scadenze_bandi_contratti_evolvi
-- ======================================================================
CREATE OR REPLACE FUNCTION public.generate_numero_contratto_evolvi()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  next_num INTEGER;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_contratto FROM 13) AS INTEGER)), 0) + 1
  INTO next_num
  FROM scadenze_bandi_contratti_evolvi
  WHERE numero_contratto LIKE 'EVOLVI-' || current_year || '-%';
  NEW.numero_contratto := 'EVOLVI-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$function$
;

-- ======================================================================
-- FUNZIONE: generate_numero_fattura_evolvi()
-- SECURITY DEFINER: NO (SECURITY INVOKER) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si | usata dai trigger: scadenze_bandi_evolvi_fatture
-- ======================================================================
CREATE OR REPLACE FUNCTION public.generate_numero_fattura_evolvi()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  next_num INTEGER;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_fattura FROM 16) AS INTEGER)), 0) + 1
  INTO next_num
  FROM scadenze_bandi_evolvi_fatture
  WHERE numero_fattura LIKE 'FAT-EVOLVI-' || current_year || '-%';
  NEW.numero_fattura := 'FAT-EVOLVI-' || current_year || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$function$
;

-- ======================================================================
-- FUNZIONE: generate_numero_prospect()
-- SECURITY DEFINER: SI (proprietario postgres) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si | usata dai trigger: scadenze_bandi_prospect
-- ======================================================================
CREATE OR REPLACE FUNCTION public.generate_numero_prospect()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$                                                                                                                                                       
  DECLARE                                                                                                                                                     
    next_num INTEGER;                                                                                                                                         
    current_year TEXT;                                                                                                                                    
  BEGIN
    current_year := EXTRACT(YEAR FROM NOW())::TEXT;
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero_prospect FROM 11) AS INTEGER)), 0) + 1
    INTO next_num
    FROM scadenze_bandi_prospect
    WHERE numero_prospect LIKE 'PROS-' || current_year || '-%';
    NEW.numero_prospect := 'PROS-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
    RETURN NEW;
  END;
  $function$
;

-- ======================================================================
-- FUNZIONE: gestionale_is_admin()
-- SECURITY DEFINER: SI (proprietario postgres) | config: search_path=public
-- EXECUTE: anon=si, authenticated=si
-- ======================================================================
CREATE OR REPLACE FUNCTION public.gestionale_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.scadenze_bandi_utenti u
    where u.id = public.gestionale_utente_id()
      and u.livello_permessi = 'admin'
  )
$function$
;

-- ======================================================================
-- FUNZIONE: gestionale_utente_id()
-- SECURITY DEFINER: SI (proprietario postgres) | config: search_path=public
-- EXECUTE: anon=si, authenticated=si
-- ======================================================================
CREATE OR REPLACE FUNCTION public.gestionale_utente_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select u.id
  from public.scadenze_bandi_utenti u
  where coalesce(auth.jwt() ->> 'app', '') = 'gestionale_evolvi'
    and (auth.jwt() ->> 'sub') ~ '^[0-9a-fA-F-]{36}$'
    and u.id = (auth.jwt() ->> 'sub')::uuid
    and u.attivo = true
$function$
;

-- ======================================================================
-- FUNZIONE: match_bandi(text,integer,real)
-- SECURITY DEFINER: NO (SECURITY INVOKER) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si
-- ======================================================================
CREATE OR REPLACE FUNCTION public.match_bandi(query_text text, max_results integer DEFAULT 3, soglia_minima real DEFAULT 0.3)
 RETURNS TABLE(id uuid, nome text, score real)
 LANGUAGE sql
 STABLE
AS $function$
    SELECT b.id, b.nome,
           word_similarity(lower(query_text), lower(b.nome)) AS score
    FROM scadenze_bandi_bandi b
    WHERE word_similarity(lower(query_text), lower(b.nome)) > soglia_minima
    ORDER BY score DESC
    LIMIT max_results;
$function$
;

-- ======================================================================
-- FUNZIONE: match_bandi_esterni_per_cliente(uuid)
-- SECURITY DEFINER: NO (SECURITY INVOKER) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si
-- ======================================================================
CREATE OR REPLACE FUNCTION public.match_bandi_esterni_per_cliente(p_cliente_id uuid)
 RETURNS SETOF scadenze_bandi_bandi_esterni
 LANGUAGE sql
 STABLE
AS $function$
    WITH cat AS (
        SELECT array_agg(DISTINCT c) AS categorie
        FROM scadenze_bandi_clienti_esigenze e,
             unnest(e.categorie) AS c
        WHERE e.cliente_id = p_cliente_id
          AND e.stato = 'attiva'
    )
    SELECT b.*
    FROM scadenze_bandi_bandi_esterni b, cat
    WHERE b.stato IN ('attivo', 'in_apertura')
      AND cat.categorie IS NOT NULL
      AND b.investimenti_spesati && cat.categorie
      AND NOT EXISTS (
          SELECT 1
          FROM scadenze_bandi_clienti_bandi_esterni ov
          WHERE ov.cliente_id = p_cliente_id
            AND ov.bando_esterno_id = b.id
      )
    -- I bandi già attivi prima di quelli che apriranno; poi per scadenza.
    ORDER BY (b.stato = 'in_apertura'),
             b.data_scadenza ASC NULLS LAST,
             b.created_at DESC;
$function$
;

-- ======================================================================
-- FUNZIONE: match_clienti(text,integer,real)
-- SECURITY DEFINER: NO (SECURITY INVOKER) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si
-- ======================================================================
CREATE OR REPLACE FUNCTION public.match_clienti(query_text text, max_results integer DEFAULT 5, soglia_minima real DEFAULT 0.2)
 RETURNS TABLE(id uuid, denominazione text, partita_iva character varying, codice_fiscale character varying, score real)
 LANGUAGE sql
 STABLE
AS $function$
    SELECT
        c.id,
        c.denominazione,
        c.partita_iva,
        c.codice_fiscale,
        word_similarity(lower(query_text), lower(c.denominazione)) AS score
    FROM scadenze_bandi_clienti c
    WHERE
        word_similarity(lower(query_text), lower(c.denominazione)) > soglia_minima
    ORDER BY score DESC
    LIMIT max_results;
$function$
;

-- ======================================================================
-- FUNZIONE: match_progetti(text,integer,real)
-- SECURITY DEFINER: NO (SECURITY INVOKER) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si
-- ======================================================================
CREATE OR REPLACE FUNCTION public.match_progetti(query_text text, max_results integer DEFAULT 3, soglia_minima real DEFAULT 0.3)
 RETURNS TABLE(id uuid, titolo_progetto text, score real)
 LANGUAGE sql
 STABLE
AS $function$
    SELECT p.id, p.titolo_progetto,
           word_similarity(lower(query_text), lower(p.titolo_progetto)) AS score
    FROM scadenze_bandi_progetti p
    WHERE p.titolo_progetto IS NOT NULL
      AND word_similarity(lower(query_text), lower(p.titolo_progetto)) > soglia_minima
    ORDER BY score DESC
    LIMIT max_results;
$function$
;

-- ======================================================================
-- FUNZIONE: update_bando_stato_automatico()
-- SECURITY DEFINER: NO (SECURITY INVOKER) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si | usata dai trigger: scadenze_bandi_bandi
-- ======================================================================
CREATE OR REPLACE FUNCTION public.update_bando_stato_automatico()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Calcola stato automatico
    NEW.stato_bando := (CASE
        WHEN NEW.data_apertura_presentazione IS NULL OR NEW.data_chiusura_presentazione IS NULL THEN 'PROSSIMA_APERTURA'
        WHEN CURRENT_DATE < NEW.data_apertura_presentazione THEN 'PROSSIMA_APERTURA'
        WHEN CURRENT_DATE >= NEW.data_apertura_presentazione AND CURRENT_DATE <= NEW.data_chiusura_presentazione THEN 'APERTO'
        WHEN CURRENT_DATE > NEW.data_chiusura_presentazione AND
             CURRENT_DATE <= (NEW.data_chiusura_presentazione + INTERVAL '1 day' * COALESCE(NEW.tempo_valutazione_giorni, 60)) THEN 'IN_VALUTAZIONE'
        ELSE 'CHIUSO'
    END)::bando_stato;

    RETURN NEW;
END;
$function$
;

-- ======================================================================
-- FUNZIONE: update_calendar_events_updated_at()
-- SECURITY DEFINER: NO (SECURITY INVOKER) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si | usata dai trigger: scadenze_bandi_calendar_events
-- ======================================================================
CREATE OR REPLACE FUNCTION public.update_calendar_events_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

-- ======================================================================
-- FUNZIONE: update_documenti_progetto_timestamp()
-- SECURITY DEFINER: NO (SECURITY INVOKER) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si | usata dai trigger: scadenze_bandi_documenti_progetto
-- ======================================================================
CREATE OR REPLACE FUNCTION public.update_documenti_progetto_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

-- ======================================================================
-- FUNZIONE: update_fabbisogno_rilevazione_timestamp()
-- SECURITY DEFINER: NO (SECURITY INVOKER) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si | usata dai trigger: scadenze_bandi_fabbisogno_rilevazioni
-- ======================================================================
CREATE OR REPLACE FUNCTION public.update_fabbisogno_rilevazione_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

-- ======================================================================
-- FUNZIONE: update_template_scadenze_updated_at()
-- SECURITY DEFINER: NO (SECURITY INVOKER) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si | usata dai trigger: scadenze_bandi_documenti, scadenze_bandi_template_scadenze
-- ======================================================================
CREATE OR REPLACE FUNCTION public.update_template_scadenze_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

-- ======================================================================
-- FUNZIONE: update_updated_at_column()
-- SECURITY DEFINER: NO (SECURITY INVOKER) | config: nessun search_path impostato
-- EXECUTE: anon=si, authenticated=si | usata dai trigger: scadenze_bandi_additional_recipients, scadenze_bandi_bandi, scadenze_bandi_bandi_esterni, scadenze_bandi_clienti, scadenze_bandi_clienti_bandi_esterni, scadenze_bandi_clienti_documenti, scadenze_bandi_clienti_esigenze, scadenze_bandi_clienti_note, scadenze_bandi_clienti_referenti, scadenze_bandi_collegamenti_aziendali, scadenze_bandi_contatti, scadenze_bandi_contract_tracking, scadenze_bandi_contratti_evolvi, scadenze_bandi_contributi_ottenuti, scadenze_bandi_documenti_amministrativi, scadenze_bandi_documenti_cliente, scadenze_bandi_email_accounts, scadenze_bandi_email_folders, scadenze_bandi_email_messages, scadenze_bandi_eventi_catalogo, scadenze_bandi_evolvi_fatture, scadenze_bandi_legali_rappresentanti, scadenze_bandi_note_bandi, scadenze_bandi_note_progetti, scadenze_bandi_notification_settings, scadenze_bandi_progetti_eventi, scadenze_bandi_prospect, scadenze_bandi_rna_aiuti, scadenze_bandi_scadenze, scadenze_bandi_scadenze_contrattuali, scadenze_bandi_tipologie_scadenze, scadenze_bandi_utenti
-- ======================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;


-- ############################################################################
-- SEZIONE 4 - TIPI ENUM usati dalle tabelle del perimetro
-- ############################################################################

-- Usato da: scadenze_bandi_bandi.stato_bando
CREATE TYPE public.bando_stato AS ENUM ('PROSSIMA_APERTURA', 'APERTO', 'CHIUSO', 'IN_VALUTAZIONE');

-- Usato da: scadenze_bandi_bandi.tipo_valutazione
CREATE TYPE public.bando_tipo_valutazione AS ENUM ('A_PUNTEGGIO', 'JUST_IN_TIME');

-- Usato da: scadenze_bandi_contributi_ottenuti.forma_contributo, scadenze_bandi_rna_aiuti.forma_proposta
CREATE TYPE public.contributo_forma AS ENUM ('FONDO_PERDUTO', 'CREDITO_IMPOSTA', 'FINANZIAMENTO_AGEVOLATO', 'GARANZIA', 'CONTRIBUTO_INTERESSI', 'MISTO');

-- Usato da: scadenze_bandi_contributi_ottenuti.origine
CREATE TYPE public.contributo_origine AS ENUM ('DA_PROGETTO', 'MANUALE', 'DA_RNA');

-- Usato da: scadenze_bandi_contributi_ottenuti.stato
CREATE TYPE public.contributo_stato AS ENUM ('AMMESSO', 'CONCESSO', 'EROGATO_PARZIALE', 'EROGATO_TOTALE', 'REVOCATO', 'RINUNCIATO');

-- Usato da: scadenze_bandi_progetti.numero_sal
CREATE TYPE public.progetto_numero_sal AS ENUM ('UNICO', 'DUE', 'TRE');

-- Usato da: scadenze_bandi_progetti.stato
CREATE TYPE public.progetto_stato AS ENUM ('DECRETO_ATTESO', 'DECRETO_RICEVUTO', 'ACCETTATO', 'IN_CORSO', 'COMPLETATO', 'SOSPESO', 'ANNULLATO');

-- Usato da: scadenze_bandi_clienti.categoria_evolvi
CREATE TYPE public.scadenze_bandi_categoria_evolvi AS ENUM ('BASE', 'PREMIUM', 'BUSINESS', 'ENTERPRISE', 'EVOLVI', 'CLIENTE_SPOT', 'FPI', 'CONSULENTI');

-- Usato da: scadenze_bandi_clienti.dimensione
CREATE TYPE public.scadenze_bandi_dimensione_azienda AS ENUM ('MICRO', 'PICCOLA', 'MEDIA', 'GRANDE');

-- Usato da: scadenze_bandi_scadenze.priorita
CREATE TYPE public.scadenze_bandi_priorita AS ENUM ('bassa', 'media', 'alta', 'critica');

-- Usato da: scadenze_bandi_legali_rappresentanti.sesso
CREATE TYPE public.scadenze_bandi_sesso AS ENUM ('M', 'F');

-- Usato da: scadenze_bandi_bandi.stato
CREATE TYPE public.scadenze_bandi_stato_bando AS ENUM ('attivo', 'archiviato');

-- Usato da: scadenze_bandi_scadenze.stato
CREATE TYPE public.scadenze_bandi_stato_scadenza AS ENUM ('non_iniziata', 'in_corso', 'completata', 'annullata');

-- Usato da: scadenze_bandi_clienti.tipo_collegamento, scadenze_bandi_collegamenti_aziendali.tipo_collegamento
CREATE TYPE public.scadenze_bandi_tipo_collegamento AS ENUM ('AUTONOMA', 'ASSOCIATA', 'COLLEGATA');
