-- Annulla 20261123_registri_231_c.sql (i dati di segnalatori, compensi e deroghe vanno persi)
drop table if exists public.scadenze_bandi_compensi_segnalatori;
drop table if exists public.scadenze_bandi_segnalatori;
drop table if exists public.scadenze_bandi_deroghe;
drop function if exists public.gestionale_controlla_segnalatori();
drop function if exists public.gestionale_controlla_deroghe();
delete from public.scadenze_bandi_permessi_ruolo where permesso = 'segnalatori.gestisci';
delete from public.scadenze_bandi_permessi_catalogo where chiave = 'segnalatori.gestisci';
