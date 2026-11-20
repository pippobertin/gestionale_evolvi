-- =============================================================================
-- Correzioni funzionali (20/11/2026)
--
-- 1. Scadenze contrattuali: la formazione (piani formativi e certificazioni
--    obbligatorie) salva e cerca le proprie scadenze per cliente e con tipo
--    entità FORMAZIONE, ma la tabella non aveva la colonna cliente_id e il
--    vincolo non ammetteva FORMAZIONE: ogni inserimento falliva e la panoramica
--    della formazione dava errore. Si aggiungono la colonna (compilata per le
--    scadenze dei contratti Evolvi esistenti) e il tipo FORMAZIONE.
-- 2. Prospect: lo stato predefinito era 'nuovo', non ammesso dal vincolo; ora
--    'bozza', lo stato iniziale usato dalle schermate.
-- Annullamento: 20261120_correzioni_scadenze_prospect_ROLLBACK.sql
-- =============================================================================
alter table public.scadenze_bandi_scadenze_contrattuali
  add column if not exists cliente_id uuid references public.scadenze_bandi_clienti(id) on delete set null;
create index if not exists idx_scadenze_contrattuali_cliente on public.scadenze_bandi_scadenze_contrattuali (cliente_id);

update public.scadenze_bandi_scadenze_contrattuali s
set cliente_id = e.cliente_id
from public.scadenze_bandi_contratti_evolvi e
where s.entity_type = 'CONTRATTO_EVOLVI' and s.entity_id = e.id and s.cliente_id is null;

alter table public.scadenze_bandi_scadenze_contrattuali drop constraint scadenze_bandi_scadenze_contrattuali_entity_type_check;
alter table public.scadenze_bandi_scadenze_contrattuali add constraint scadenze_bandi_scadenze_contrattuali_entity_type_check
  check (entity_type = any (array['CLIENTE', 'CONTRATTO_EVOLVI', 'GENERALE', 'FORMAZIONE']));

alter table public.scadenze_bandi_prospect alter column stato set default 'bozza';
