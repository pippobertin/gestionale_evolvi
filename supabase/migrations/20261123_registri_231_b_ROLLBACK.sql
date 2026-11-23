-- Annulla 20261123_registri_231_b.sql (i dati dei due registri vanno persi)
drop trigger if exists trg_utente_cessato on public.scadenze_bandi_utenti;
drop function if exists public.gestionale_utente_cessato();
drop function if exists public.gestionale_rimuovi_autorizzazioni_cessate();
drop table if exists public.scadenze_bandi_deleghe_persone;
drop table if exists public.scadenze_bandi_deleghe;
drop table if exists public.scadenze_bandi_checklist_personale;
drop function if exists public.gestionale_registri_231_b_aggiorna();
delete from public.scadenze_bandi_permessi_ruolo where permesso = 'deleghe.gestisci';
delete from public.scadenze_bandi_permessi_catalogo where chiave = 'deleghe.gestisci';
delete from public.scadenze_bandi_checklist_voci where tipo in ('personale_ingresso_interno', 'personale_ingresso_esterno', 'personale_uscita');
alter table public.scadenze_bandi_checklist_voci drop column if exists facoltativa;
