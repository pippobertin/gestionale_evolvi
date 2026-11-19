-- Annulla 20261119_fase3_d_gruppo5_formazione_fabbisogno_contributi_rna.sql: tutte queste
-- tabelle avevano RLS disattivata, nessuna policy e pieno accesso di anon; le funzioni
-- erano eseguibili da chiunque. Solo in emergenza.
do $$
declare t text; f text;
begin
  foreach t in array array[
    'scadenze_bandi_certificazioni_obbligatorie',
    'scadenze_bandi_clienti_adesioni_fpi',
    'scadenze_bandi_contributi_ottenuti',
    'scadenze_bandi_corsi_formativi',
    'scadenze_bandi_documenti_formazione',
    'scadenze_bandi_partecipanti_formazione',
    'scadenze_bandi_piani_formativi',
    'scadenze_bandi_fabbisogno_rilevazioni',
    'scadenze_bandi_fabbisogno_popolazione',
    'scadenze_bandi_fabbisogno_inserimenti_previsti',
    'scadenze_bandi_fabbisogno_obblighi_dichiarati',
    'scadenze_bandi_rna_aiuti',
    'scadenze_bandi_rna_import_log',
    'scadenze_bandi_rna_richieste',
    'scadenze_bandi_rna_agente'
  ] loop
    execute format('drop policy if exists gestionale_accesso on public.%I', t);
    execute format('alter table public.%I disable row level security', t);
    execute format('grant all on public.%I to anon, authenticated', t);
  end loop;

  foreach f in array array[
    'public.match_clienti(text, integer, real)',
    'public.match_bandi(text, integer, real)',
    'public.match_progetti(text, integer, real)',
    'public.match_bandi_esterni_per_cliente(uuid)',
    'public.find_note_candidate_for_bando(uuid, real)',
    'public.find_note_candidate_for_progetto(uuid, real)'
  ] loop
    execute format('grant execute on function %s to public, anon', f);
  end loop;
end $$;
