-- Vista denormalizzata per l'ambito "Contributi ottenuti" delle Interrogazioni.
BEGIN;

CREATE OR REPLACE VIEW vista_contributi_ottenuti
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.cliente_id,
  c.progetto_id,
  c.anno_competenza,
  c.bando_id,
  COALESCE(b.nome, c.bando_denominazione_manuale)  AS bando_nome,
  b.codice_bando                                   AS bando_codice,
  COALESCE(c.ente_erogatore, b.ente_erogatore)     AS ente_erogatore,
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
  p.codice_progetto                                AS progetto_codice,
  p.titolo_progetto                                AS progetto_titolo,
  cl.denominazione                                 AS cliente_denominazione,
  cl.partita_iva                                   AS cliente_partita_iva,
  cl.provincia_fatturazione                        AS cliente_provincia,
  cl.email                                         AS cliente_email,
  cl.pec                                           AS cliente_pec,
  cl.categoria_evolvi                              AS cliente_categoria_evolvi,
  cl.dimensione                                    AS cliente_dimensione,
  cl.ateco_2025                                    AS cliente_ateco
FROM scadenze_bandi_contributi_ottenuti c
JOIN scadenze_bandi_clienti cl ON cl.id = c.cliente_id
LEFT JOIN scadenze_bandi_bandi b ON b.id = c.bando_id
LEFT JOIN scadenze_bandi_progetti p ON p.id = c.progetto_id;

GRANT SELECT ON vista_contributi_ottenuti TO anon, authenticated;

COMMENT ON VIEW vista_contributi_ottenuti IS
  'Contributi ottenuti con nome bando (catalogo o manuale), ente, progetto e dati cliente. Usata dall''ambito Interrogazioni "contributi".';

COMMIT;
