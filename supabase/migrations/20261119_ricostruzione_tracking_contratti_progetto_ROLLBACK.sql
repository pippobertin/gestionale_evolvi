-- Annulla la ricostruzione del tracking dei contratti di progetto
delete from public.scadenze_bandi_contract_tracking
where entity_type = 'PROGETTO'
  and signed_contract_notes like 'Ricostruito da Google Drive%';
