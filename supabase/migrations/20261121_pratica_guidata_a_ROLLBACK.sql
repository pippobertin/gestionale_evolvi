-- Annulla 20261121_pratica_guidata_a.sql
drop trigger if exists trg_passaggio_iniziale on public.scadenze_bandi_progetti;
drop trigger if exists trg_protegge_fase on public.scadenze_bandi_progetti;
drop function if exists public.gestionale_passaggio_iniziale();
drop function if exists public.gestionale_protegge_fase();
drop function if exists public.gestionale_cambia_fase(uuid, text, text);
drop function if exists public.gestionale_stato_pratica(uuid);
drop function if exists public.gestionale_verifica_rev() cascade;
drop function if exists public.gestionale_passaggi_immutabili() cascade;
drop table if exists public.scadenze_bandi_pratica_passaggi;
drop table if exists public.scadenze_bandi_checklist_voci;
drop table if exists public.scadenze_bandi_pratica_verifiche;
drop table if exists public.scadenze_bandi_contatti_pa;
drop table if exists public.scadenze_bandi_ordini_lavoro;
delete from public.scadenze_bandi_system_settings where key = 'utente_au';
alter table public.scadenze_bandi_progetti
  drop constraint if exists progetti_fase_check,
  drop constraint if exists progetti_rp_rev_diversi,
  drop column if exists fase, drop column if exists rp_id, drop column if exists rev_id,
  drop column if exists pratica_propria, drop column if exists trasmissione,
  drop column if exists motivazione_stesso_bando, drop column if exists data_invio;
