-- Annulla 20261124_controllo_pagine_bandi.sql
drop table if exists public.scadenze_bandi_controllo_novita;
drop table if exists public.scadenze_bandi_controllo_pagine;
alter table public.scadenze_bandi_bandi drop column if exists controllo_pagina;
