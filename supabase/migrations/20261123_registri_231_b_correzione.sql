-- Correzione di 20261123_registri_231_b: il controllo "checklist completata" leggeva
-- old.completata_il anche sulle deleghe, che non hanno quel campo (errore al riesame
-- e a ogni modifica di una delega). Ora lo legge solo dove esiste.
create or replace function public.gestionale_registri_231_b_aggiorna()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if tg_table_name = 'scadenze_bandi_checklist_personale' then
    if (to_jsonb(old) ->> 'completata_il') is not null then
      raise exception 'La checklist è già completata e non si modifica più';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $fn$;
