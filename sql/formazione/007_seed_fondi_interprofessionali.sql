-- Seed dei principali fondi paritetici interprofessionali italiani
-- Idempotente: usa ON CONFLICT DO NOTHING

INSERT INTO scadenze_bandi_fondi_interprofessionali (codice, nome, sigla, settori_ccnl, attivo)
VALUES
  ('FONDIMPRESA', 'Fondimpresa - Fondo per la formazione continua di Confindustria, CGIL, CISL, UIL', 'Fondimpresa',
    ARRAY['Industria', 'Metalmeccanico', 'Chimico', 'Tessile', 'Alimentare'], TRUE),
  ('FONDIRIGENTI', 'Fondirigenti - Fondo per la formazione dei dirigenti industriali', 'Fondirigenti',
    ARRAY['Dirigenti Industria'], TRUE),
  ('FONDER', 'Fond.E.R. - Fondo Enti Religiosi', 'Fond.E.R.',
    ARRAY['Enti religiosi', 'Scuole paritarie', 'Sanita confessionale'], TRUE),
  ('FORTE', 'For.Te. - Fondo per la formazione continua del terziario', 'For.Te.',
    ARRAY['Commercio', 'Turismo', 'Servizi', 'Logistica', 'Spedizioni'], TRUE),
  ('FONDARTIGIANATO', 'Fondartigianato - Fondo artigiani', 'Fondartigianato',
    ARRAY['Artigianato', 'PMI artigiane'], TRUE),
  ('FONDOPROFESSIONI', 'Fondoprofessioni - Fondo per i dipendenti degli studi professionali', 'Fondoprofessioni',
    ARRAY['Studi professionali', 'Studi legali', 'Studi commercialisti'], TRUE),
  ('FONCOOP', 'Fon.Coop - Fondo per la formazione nelle cooperative', 'Fon.Coop',
    ARRAY['Cooperative', 'Mutue', 'Consorzi cooperativi'], TRUE),
  ('FBA', 'Fondo Banche e Assicurazioni', 'FBA',
    ARRAY['Credito', 'Assicurazioni', 'Servizi finanziari'], TRUE),
  ('FONDOLAVORO', 'Fondolavoro - Fondo interprofessionale per la formazione continua', 'Fondolavoro',
    ARRAY['Multisettorale'], TRUE),
  ('FONSERVIZI', 'Fonservizi - Fondo per la formazione dei lavoratori dei servizi', 'Fonservizi',
    ARRAY['Servizi', 'Terziario avanzato'], TRUE),
  ('FONDITALIA', 'FondItalia - Fondo formazione Italia', 'FondItalia',
    ARRAY['Multisettorale', 'PMI'], TRUE),
  ('FORMAZIENDA', 'Formazienda - Fondo per la formazione nelle PMI', 'Formazienda',
    ARRAY['PMI', 'Multisettorale'], TRUE),
  ('FONDO_DIRIGENTI_PMI', 'Fondo Dirigenti PMI', 'Fondo Dir. PMI',
    ARRAY['Dirigenti PMI'], TRUE),
  ('FONARCOM', 'FonARCom - Fondo paritetico interprofessionale nazionale per la formazione continua', 'FonARCom',
    ARRAY['Artigianato', 'Commercio', 'Multisettorale'], TRUE),
  ('FONTER', 'Fonter - Fondo per la formazione continua dei lavoratori del terziario', 'Fonter',
    ARRAY['Terziario', 'Distribuzione', 'Servizi'], TRUE)
ON CONFLICT (codice) DO NOTHING;
