-- Annulla 20261120_fase4_c1_permessi.sql
-- Spegnimento rapido senza annullare: update scadenze_bandi_system_settings set value = 'no' where key = 'permessi_attivi';
do $do$
declare t text;
begin
  for t in select event_object_table from information_schema.triggers
           where trigger_schema = 'public' and trigger_name = 'trg_controlla_permesso'
  loop
    execute format('drop trigger if exists trg_controlla_permesso on public.%I', t);
  end loop;
end $do$;
drop function if exists public.gestionale_controlla_permesso();
drop function if exists public.gestionale_ha_permesso(text, uuid);
drop function if exists public.gestionale_ruolo(uuid);
drop function if exists public.gestionale_ambiente();
delete from public.scadenze_bandi_system_settings where key = 'permessi_attivi';
drop table if exists public.scadenze_bandi_permessi_ruolo;
drop table if exists public.scadenze_bandi_permessi_catalogo;
-- Le colonne aggiunte ai contratti restano (dati storici di generazione e approvazione).
-- Il vincolo dei ruoli torna a due valori solo se nessun utente ha i ruoli nuovi:
alter table public.scadenze_bandi_utenti drop constraint if exists scadenze_bandi_utenti_livello_permessi_check;
alter table public.scadenze_bandi_utenti add constraint scadenze_bandi_utenti_livello_permessi_check
  check (livello_permessi::text = any (array['admin', 'collaboratore']));
