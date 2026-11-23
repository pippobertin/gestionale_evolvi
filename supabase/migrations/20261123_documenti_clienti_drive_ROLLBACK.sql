-- Annulla 20261123_documenti_clienti_drive.sql. Prima di eseguirlo, i documenti che
-- esistono solo su Drive (storage_path nullo) vanno riportati nell'archivio interno.
alter table public.scadenze_bandi_documenti_amministrativi
  drop column if exists google_drive_id,
  drop column if exists google_drive_url;
alter table public.scadenze_bandi_clienti_documenti
  drop column if exists google_drive_id,
  drop column if exists spostato_in;
alter table public.scadenze_bandi_clienti drop column if exists drive_cartella_id;
