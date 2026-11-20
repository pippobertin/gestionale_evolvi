-- Annulla 20261120_fase4_b_ripristino.sql
-- La colonna transazione resta (il registro non si modifica); si toglie solo il valore predefinito.
drop function if exists public.gestionale_ripristina(bigint);
alter table public.scadenze_bandi_registro_operazioni alter column transazione drop default;
drop index if exists public.idx_registro_transazione;
drop index if exists public.idx_registro_ripristino_di;
-- Il trigger torna alla versione della 4A: rieseguire la funzione
-- gestionale_registra_operazione() da 20261120_fase4_a_registro_operazioni.sql.
