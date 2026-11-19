-- Annulla 20261119_tabella_responsabili_scadenze.sql (elimina anche i responsabili salvati)
drop table if exists public.scadenze_bandi_responsabili_scadenze;
notify pgrst, 'reload schema';
