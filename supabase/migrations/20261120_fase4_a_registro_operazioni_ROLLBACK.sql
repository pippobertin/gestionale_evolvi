-- Annulla 20261120_fase4_a_registro_operazioni.sql
-- ATTENZIONE: elimina il registro delle operazioni accumulato fino a quel momento.
-- Esportarlo prima (Impostazioni > Registro attività > Esporta).
do $do$
declare t text;
begin
  for t in select event_object_table from information_schema.triggers
           where trigger_schema = 'public' and trigger_name = 'trg_registro_operazioni'
  loop
    execute format('drop trigger if exists trg_registro_operazioni on public.%I', t);
  end loop;
end $do$;

drop function if exists public.gestionale_registra_operazione();

-- Il registro dei dati dimensionali torna a riconoscere solo il badge
create or replace function public.gestionale_log_dati_cliente()
returns trigger language plpgsql security definer set search_path = public
as $fn$
declare autore uuid := public.gestionale_utente_id();
begin
  if tg_table_name = 'scadenze_bandi_clienti' then
    if new.ula is distinct from old.ula then
      insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
      values (new.id, 'cliente', 'ula', old.ula::text, new.ula::text, autore);
    end if;
    if new.ultimo_fatturato is distinct from old.ultimo_fatturato then
      insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
      values (new.id, 'cliente', 'fatturato', old.ultimo_fatturato::text, new.ultimo_fatturato::text, autore);
    end if;
    if new.attivo_bilancio is distinct from old.attivo_bilancio then
      insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
      values (new.id, 'cliente', 'attivo', old.attivo_bilancio::text, new.attivo_bilancio::text, autore);
    end if;
    if new.esercizio_riferimento is distinct from old.esercizio_riferimento then
      insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
      values (new.id, 'cliente', 'esercizio_riferimento', old.esercizio_riferimento::text, new.esercizio_riferimento::text, autore);
    end if;
  elsif tg_op = 'INSERT' then
    insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
    values (new.cliente_id, 'esercizio ' || new.esercizio, 'inserimento',
            null, format('ULA %s, fatturato %s, attivo %s (%s)', coalesce(new.ula::text, '-'), coalesce(new.fatturato::text, '-'), coalesce(new.attivo::text, '-'), new.fonte), autore);
  elsif tg_op = 'UPDATE' then
    insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
    select new.cliente_id, 'esercizio ' || new.esercizio, c.campo, c.prima, c.dopo, autore
    from (values ('ula', old.ula::text, new.ula::text),
                 ('fatturato', old.fatturato::text, new.fatturato::text),
                 ('attivo', old.attivo::text, new.attivo::text),
                 ('fonte', old.fonte, new.fonte)) as c(campo, prima, dopo)
    where c.prima is distinct from c.dopo;
  elsif tg_op = 'DELETE' then
    insert into scadenze_bandi_clienti_dati_log (cliente_id, origine, campo, valore_precedente, valore_nuovo, modificato_da)
    values (old.cliente_id, 'esercizio ' || old.esercizio, 'eliminazione',
            format('ULA %s, fatturato %s, attivo %s', coalesce(old.ula::text, '-'), coalesce(old.fatturato::text, '-'), coalesce(old.attivo::text, '-')), null, autore);
    return old;
  end if;
  return new;
end $fn$;

drop function if exists public.gestionale_autore();
drop function if exists public.gestionale_canale();
drop table if exists public.scadenze_bandi_registro_operazioni;
drop function if exists public.gestionale_registro_immutabile();
