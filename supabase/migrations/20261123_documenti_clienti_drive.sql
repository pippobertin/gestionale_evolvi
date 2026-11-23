-- =============================================================================
-- Documenti dei clienti su Google Drive
-- I nuovi documenti vanno nel Drive condiviso "Gestionale Evolvi", cartella
-- CLIENTI/<cliente>/DOCUMENTI/<categoria>, coperta dal backup di Workspace; il
-- gestionale conserva l'elenco con il collegamento al file (google_drive_id,
-- lo stesso nome usato per bandi e progetti: il ripristino dal registro toglie
-- già il file dal cestino di Drive). I documenti esistenti si spostano con la
-- procedura in Impostazioni; il percorso nell'archivio interno resta finché le
-- copie non vengono eliminate.
-- Annullamento: 20261123_documenti_clienti_drive_ROLLBACK.sql
-- =============================================================================
alter table public.scadenze_bandi_documenti_amministrativi
  add column if not exists google_drive_id text,
  add column if not exists google_drive_url text,
  alter column storage_path drop not null;
alter table public.scadenze_bandi_clienti_documenti
  add column if not exists google_drive_id text,
  add column if not exists spostato_in uuid;   -- documento corrispondente nei documenti del cliente (migrazione)
alter table public.scadenze_bandi_clienti
  add column if not exists drive_cartella_id text;
