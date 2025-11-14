-- Verifica semplice del sistema step by step

-- 1. Conteggio tabelle
SELECT 'CLIENTI' as tabella, COUNT(*) as totale FROM scadenze_bandi_clienti;
SELECT 'BANDI' as tabella, COUNT(*) as totale FROM scadenze_bandi_bandi;
SELECT 'PROGETTI' as tabella, COUNT(*) as totale FROM scadenze_bandi_progetti;
SELECT 'SCADENZE' as tabella, COUNT(*) as totale FROM scadenze_bandi_scadenze;