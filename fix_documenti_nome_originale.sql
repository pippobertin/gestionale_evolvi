-- Fix: popola nome_originale per i documenti progetto
-- Questo permette il matching con i file di Google Drive

-- Aggiorna nome_originale se NULL, copiandolo da nome_file
UPDATE scadenze_bandi_documenti_progetto
SET nome_originale = nome_file
WHERE nome_originale IS NULL;

-- Verifica risultati
SELECT
  id,
  nome_file,
  nome_originale,
  categoria,
  google_drive_id IS NOT NULL as has_drive_id
FROM scadenze_bandi_documenti_progetto
ORDER BY created_at DESC
LIMIT 20;
