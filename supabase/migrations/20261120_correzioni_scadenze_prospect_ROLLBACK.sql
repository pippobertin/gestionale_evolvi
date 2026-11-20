-- Annulla 20261120_correzioni_scadenze_prospect.sql (elimina le scadenze FORMAZIONE eventualmente create)
alter table public.scadenze_bandi_prospect alter column stato set default 'nuovo';
delete from public.scadenze_bandi_scadenze_contrattuali where entity_type = 'FORMAZIONE';
alter table public.scadenze_bandi_scadenze_contrattuali drop constraint scadenze_bandi_scadenze_contrattuali_entity_type_check;
alter table public.scadenze_bandi_scadenze_contrattuali add constraint scadenze_bandi_scadenze_contrattuali_entity_type_check
  check (entity_type = any (array['CLIENTE', 'CONTRATTO_EVOLVI', 'GENERALE']));
drop index if exists public.idx_scadenze_contrattuali_cliente;
alter table public.scadenze_bandi_scadenze_contrattuali drop column if exists cliente_id;
