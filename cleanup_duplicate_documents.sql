-- Elimina documenti duplicati (quelli con TEMPLATE_ nel nome e senza google_drive_id)
-- Mantiene solo i documenti corretti

-- Prima verifica quali documenti verranno eliminati
SELECT
  id,
  progetto_id,
  nome_file,
  categoria,
  caricato_da,
  google_drive_id
FROM scadenze_bandi_documenti_progetto
WHERE
  (nome_file LIKE 'TEMPLATE_%' AND google_drive_id IS NULL)
  OR caricato_da = 'SISTEMA_AUTO_EREDITÀ'
ORDER BY progetto_id, nome_file;

-- Elimina i documenti duplicati
DELETE FROM scadenze_bandi_documenti_progetto
WHERE
  (nome_file LIKE 'TEMPLATE_%' AND google_drive_id IS NULL)
  OR caricato_da = 'SISTEMA_AUTO_EREDITÀ';

-- Verifica documenti rimasti
SELECT
  progetto_id,
  COUNT(*) as num_documenti,
  SUM(CASE WHEN google_drive_id IS NOT NULL THEN 1 ELSE 0 END) as con_drive_id
FROM scadenze_bandi_documenti_progetto
GROUP BY progetto_id
ORDER BY progetto_id;
