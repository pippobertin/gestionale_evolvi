-- =============================================================================
-- Registrazione dei contratti firmati restituiti dai clienti (20/11/2026)
--
-- Il file firmato viene salvato su Google Drive nella stessa cartella del
-- contratto approvato; nel tracking si registrano file, data di ricezione,
-- canale, note, chi ha registrato e quando. Solo colonne aggiunte.
-- signed_contract_received_at = data di ricezione indicata da chi registra.
-- Annullamento: 20261120_contratti_firmati_ROLLBACK.sql
-- =============================================================================
alter table public.scadenze_bandi_contract_tracking
  add column if not exists signed_contract_drive_id text,
  add column if not exists signed_contract_drive_url text,
  add column if not exists signed_contract_file_name text,
  add column if not exists signed_contract_canale text
    check (signed_contract_canale in ('email', 'pec', 'a_mano', 'piattaforma_firma', 'altro')),
  add column if not exists signed_contract_registrato_da uuid references public.scadenze_bandi_utenti(id),
  add column if not exists signed_contract_registrato_at timestamptz;
