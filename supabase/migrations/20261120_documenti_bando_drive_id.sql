-- Identificativo su Google Drive della copia di un documento del bando (cartella
-- BANDI E PROGETTI > anno > bando > ALLEGATI/NORMATIVA): serve per spostarla nel
-- cestino di Drive quando il documento viene eliminato dal gestionale.
-- (Annullamento: alter table public.scadenze_bandi_documenti drop column google_drive_id;)
alter table public.scadenze_bandi_documenti add column if not exists google_drive_id text;
