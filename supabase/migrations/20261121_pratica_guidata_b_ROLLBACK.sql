-- Annulla 20261121_pratica_guidata_b.sql
drop function if exists public.gestionale_segnala_ritardi();
drop function if exists public.gestionale_segnala_rettifica() cascade;
drop function if exists public.gestionale_controlla_rendiconto() cascade;
drop function if exists public.gestionale_controlla_integrazione() cascade;
drop table if exists public.scadenze_bandi_rettifiche;
drop table if exists public.scadenze_bandi_rendiconti;
drop table if exists public.scadenze_bandi_integrazioni;
delete from public.scadenze_bandi_checklist_voci where tipo = 'checklist_rendicontazione';
