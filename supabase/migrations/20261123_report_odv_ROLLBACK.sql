-- Annulla 20261123_report_odv.sql (i report salvati nel gestionale vanno persi; i PDF restano su Drive)
drop table if exists public.scadenze_bandi_report_odv;
drop function if exists public.gestionale_controlla_report_odv();
delete from public.scadenze_bandi_system_settings where key = 'promemoria_report_odv';
