-- Coda email: nuovo stato "annullata" e annullamento delle email arretrate (21/11/2026).
-- Il Gmail di sistema non era collegato: dal 21/11/2025 nessuna email è partita e la coda
-- ha accumulato centinaia di avvisi ormai superati. Si annullano, così che un futuro
-- ricollegamento di Gmail non li spedisca tutti insieme. Restano consultabili.
alter table public.scadenze_bandi_email_queue drop constraint if exists scadenze_bandi_email_queue_status_check;
alter table public.scadenze_bandi_email_queue add constraint scadenze_bandi_email_queue_status_check
  check (status = any (array['pending', 'sent', 'failed', 'annullata']));
update public.scadenze_bandi_email_queue
   set status = 'annullata',
       error_message = 'Annullata il 21/11/2026: arretrato accumulato senza Gmail di sistema collegato'
 where status = 'pending';
-- Annullamento: update public.scadenze_bandi_email_queue set status = 'pending', error_message = null
--   where status = 'annullata' and error_message like 'Annullata il 21/11/2026%';
