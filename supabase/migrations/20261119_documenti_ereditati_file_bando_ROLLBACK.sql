-- Annulla 20261119_documenti_ereditati_file_bando.sql ripristinando i percorsi precedenti
update public.scadenze_bandi_documenti_progetto d
set url_file = k.url_file, bando_documento_origine_id = k.bando_documento_origine_id
from gestionale_backup.documenti_progetto_url_20261119 k
where k.id = d.id;
