-- Annulla 20261121_registri_231_a.sql
drop function if exists public.gestionale_dichiarazione_propria() cascade;
drop function if exists public.gestionale_controlla_decisioni_231() cascade;
drop function if exists public.gestionale_puo_decidere_231(uuid, uuid);
drop table if exists public.scadenze_bandi_conflitti;
drop table if exists public.scadenze_bandi_dichiarazioni_interessi;
drop table if exists public.scadenze_bandi_qualifiche;
delete from public.scadenze_bandi_checklist_voci where tipo in ('qualifica_societa', 'qualifica_persona');
