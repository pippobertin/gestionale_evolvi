-- Vista dei progetti: aggiunte in coda fase della pratica, responsabile e revisore.
-- Le colonne esistenti restano identiche e nello stesso ordine.
create or replace view public.scadenze_bandi_progetti_view with (security_invoker = on) as
 SELECT p.id, p.bando_id, p.cliente_id, p.codice_progetto, p.titolo_progetto, p.descrizione_progetto, p.stato,
    p.importo_totale_progetto, p.contributo_ammesso, p.percentuale_contributo, p.data_decreto_concessione,
    p.scadenza_accettazione_esiti, p.data_effettiva_accettazione_esiti, p.data_avvio_progetto,
    p.data_fine_progetto_prevista, p.data_fine_progetto_effettiva, p.anticipo_richiedibile, p.percentuale_anticipo,
    p.scadenza_richiesta_anticipo, p.data_effettiva_richiesta_anticipo, p.importo_anticipo_erogato, p.numero_sal,
    p.scadenza_primo_sal, p.data_effettiva_primo_sal, p.scadenza_secondo_sal, p.data_effettiva_secondo_sal,
    p.scadenza_saldo_finale, p.data_effettiva_saldo_finale, p.proroga_richiedibile, p.scadenza_richiesta_proroga,
    p.data_effettiva_richiesta_proroga, p.mesi_proroga_concessi, p.scadenza_rendicontazione_finale,
    p.data_effettiva_rendicontazione_finale, p.modalita_calcolo_scadenza_rendicontazione, p.referente_interno,
    p.email_referente_interno, p.note_progetto, p.documenti_paths, p.created_at, p.updated_at,
    p.data_base_calcolo AS data_pubblicazione_graduatoria,
    b.nome AS bando_nome, b.codice_bando, b.ente_erogatore, b.tipologia_bando, b.contributo_massimo AS bando_contributo_massimo,
    c.denominazione AS cliente_denominazione, c.email AS cliente_email, c.partita_iva AS cliente_piva,
    CASE WHEN p.scadenza_accettazione_esiti IS NOT NULL AND p.data_effettiva_accettazione_esiti IS NULL
         THEN p.scadenza_accettazione_esiti - CURRENT_DATE ELSE NULL::integer END AS giorni_ad_accettazione,
    CASE WHEN p.scadenza_richiesta_anticipo IS NOT NULL AND p.data_effettiva_richiesta_anticipo IS NULL
         THEN p.scadenza_richiesta_anticipo - CURRENT_DATE ELSE NULL::integer END AS giorni_a_richiesta_anticipo,
    CASE WHEN p.scadenza_rendicontazione_finale IS NOT NULL
         THEN p.scadenza_rendicontazione_finale - CURRENT_DATE ELSE NULL::integer END AS giorni_a_rendicontazione,
    CASE
        WHEN p.stato = 'COMPLETATO'::progetto_stato THEN 'COMPLETATO'::text
        WHEN p.data_effettiva_accettazione_esiti IS NULL AND p.scadenza_accettazione_esiti IS NOT NULL AND CURRENT_DATE > p.scadenza_accettazione_esiti THEN 'DECRETO_RICEVUTO'::text
        WHEN p.data_effettiva_accettazione_esiti IS NULL THEN 'DECRETO_ATTESO'::text
        WHEN p.data_avvio_progetto IS NULL THEN 'ACCETTATO'::text
        WHEN p.data_avvio_progetto IS NOT NULL AND p.scadenza_rendicontazione_finale IS NOT NULL AND CURRENT_DATE <= p.scadenza_rendicontazione_finale THEN 'IN_CORSO'::text
        WHEN p.scadenza_rendicontazione_finale IS NOT NULL AND CURRENT_DATE > p.scadenza_rendicontazione_finale THEN 'IN_CORSO'::text
        ELSE p.stato::text
    END AS stato_calcolato,
    COALESCE((SELECT count(*) FROM scadenze_bandi_documenti_progetto WHERE scadenze_bandi_documenti_progetto.progetto_id = p.id), 0::bigint) AS documenti_caricati,
    COALESCE((SELECT count(*) FROM scadenze_bandi_scadenze WHERE scadenze_bandi_scadenze.progetto_id = p.id), 0::bigint) AS scadenze_totali,
    COALESCE((SELECT count(*) FROM scadenze_bandi_scadenze WHERE scadenze_bandi_scadenze.progetto_id = p.id
              AND (scadenze_bandi_scadenze.stato <> ALL (ARRAY['completata'::scadenze_bandi_stato_scadenza, 'annullata'::scadenze_bandi_stato_scadenza]))), 0::bigint) AS scadenze_attive,
    CASE
        WHEN p.stato = 'COMPLETATO'::progetto_stato THEN 100
        WHEN p.scadenza_rendicontazione_finale IS NOT NULL AND CURRENT_DATE > p.scadenza_rendicontazione_finale THEN 95
        WHEN p.data_avvio_progetto IS NOT NULL THEN CASE WHEN p.data_effettiva_richiesta_anticipo IS NOT NULL THEN 75 ELSE 50 END
        WHEN p.data_effettiva_accettazione_esiti IS NOT NULL THEN 25
        ELSE 10
    END AS percentuale_completamento,
    p.fase,
    p.rp_id,
    p.rev_id
   FROM scadenze_bandi_progetti p
     LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
     LEFT JOIN scadenze_bandi_clienti c ON p.cliente_id = c.id
  ORDER BY p.created_at DESC;
