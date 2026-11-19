-- =============================================================================
-- Fase 3, passaggio D, gruppo 5: formazione, fabbisogno, contributi, RNA
--
-- Accesso solo agli utenti attivi del gestionale con badge. Il questionario
-- pubblico sul fabbisogno, l'agente RNA e le importazioni passano da route del
-- server con il client riservato, che non è soggetto a queste regole.
-- Le funzioni di ricerca (match_*, find_note_candidate_*) non sono più
-- eseguibili con la sola chiave pubblica; essendo "security invoker" leggono
-- comunque soltanto ciò che le regole delle tabelle consentono.
-- La tabella "documenti" senza prefisso non appartiene al gestionale (il codice
-- usa solo il bucket di archiviazione con lo stesso nome) e non viene toccata.
-- Annullamento: 20261119_fase3_d_gruppo5_formazione_fabbisogno_contributi_rna_ROLLBACK.sql
-- =============================================================================
do $$
declare
  t text;
  f text;
  p record;
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
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy gestionale_accesso on public.%I for all to authenticated '
      || 'using ((select public.gestionale_utente_id()) is not null) '
      || 'with check ((select public.gestionale_utente_id()) is not null)', t);
  end loop;

  foreach f in array array[
    'public.match_clienti(text, integer, real)',
    'public.match_bandi(text, integer, real)',
    'public.match_progetti(text, integer, real)',
    'public.match_bandi_esterni_per_cliente(uuid)',
    'public.find_note_candidate_for_bando(uuid, real)',
    'public.find_note_candidate_for_progetto(uuid, real)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
