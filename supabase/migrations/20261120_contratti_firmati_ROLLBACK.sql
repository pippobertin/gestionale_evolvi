-- Annulla 20261120_contratti_firmati.sql (solo insieme al codice precedente; i file su Drive restano)
alter table public.scadenze_bandi_contract_tracking
  drop column if exists signed_contract_registrato_at,
  drop column if exists signed_contract_registrato_da,
  drop column if exists signed_contract_canale,
  drop column if exists signed_contract_file_name,
  drop column if exists signed_contract_drive_url,
  drop column if exists signed_contract_drive_id;
