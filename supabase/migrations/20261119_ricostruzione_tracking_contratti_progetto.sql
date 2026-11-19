-- Ricostruzione del tracking dei contratti di progetto (19/11/2026)
--
-- Fino al commit bf5e5ed le route di approvazione e invio scrivevano il tracking
-- con entity_type 'CONTRATTO_PROGETTO', rifiutato dal vincolo della tabella:
-- nessun contratto di progetto risultava tracciato. Le righe vengono ricostruite
-- dai PDF "Contratto_APPROVATO" presenti su Google Drive (codice PROG nel nome).
-- Data di invio = data di creazione del PDF su Drive; destinatario = email (o PEC)
-- attuale del cliente, la stessa che usa la route di approvazione.
-- Idempotente: inserisce solo dove non esiste già una riga PROGETTO per il progetto.
-- Ripristino: delete ... where signed_contract_notes like 'Ricostruito da Google Drive%'.

with pdf(codice_progetto, drive_id, creato) as (values
  ('PROG-2026-9151', '1FVozmUsBbO_zMgq27ixgKVNreLV38jao', timestamptz '2026-08-31T08:35:09Z'),
  ('PROG-2026-4149', '1CzaLlRZZ3Fq_NwhdzqLTk-enmaVRi7FC', timestamptz '2026-08-31T09:05:35Z'),
  ('PROG-2026-6405', '14fadeSBqGF7m5lSRFZQGDYs8dVrWBkYO', timestamptz '2026-08-03T09:54:31Z'),
  ('PROG-2026-7205', '1hpSo65B34RiFcvqFlgRBRQ-qWBKBESRH', timestamptz '2026-08-03T07:08:42Z'),
  ('PROG-2026-0118', '1xlxZ7M_PdBjYsJhtK-1UlM1552C8xPEp', timestamptz '2026-08-03T07:13:29Z'),
  ('PROG-2026-2258', '1uMyDWSF-ERvQk7fCIAy_z7YeLUOHuM5p', timestamptz '2026-08-03T07:07:34Z'),
  ('PROG-2026-2086', '1v4ziU1LPzpqpa8k1U1dPlad_KKRhxYyq', timestamptz '2026-08-03T07:09:31Z'),
  ('PROG-2026-4799', '1yT-7pEB_yPK7FsTookDUQ6vaJCviLFyH', timestamptz '2026-07-30T07:46:38Z'),
  ('PROG-2026-3179', '1oJqfon_DWRdFqBYt31UxG-srwvMOOPUs', timestamptz '2026-07-09T09:20:37Z'),
  ('PROG-2026-2372', '1VKOSKOKS3FtoX_VCvTeouutaT_Hmfvhg', timestamptz '2026-05-28T10:38:01Z'),
  ('PROG-2026-9858', '19eW3YFWLqBxfJp7FA_5ZjKAaf3mom0eJ', timestamptz '2026-05-04T09:30:04Z'),
  ('PROG-2026-6337', '1bh-kiqsFDZwc3uaog1kVEyeYXQMtXzMD', timestamptz '2026-04-13T10:08:39Z')
)
insert into public.scadenze_bandi_contract_tracking (
  entity_type, entity_id, cliente_id, contract_document_url,
  email_sent, email_sent_at, email_sent_to, email_delivery_status, overall_status,
  signed_contract_notes, created_at, updated_at
)
select
  'PROGETTO', p.id, p.cliente_id,
  'https://drive.google.com/file/d/' || pdf.drive_id || '/view?usp=drivesdk',
  true, pdf.creato, coalesce(nullif(c.email, ''), nullif(c.pec, '')), 'SENT', 'SENT',
  'Ricostruito da Google Drive il 19/11/2026: data di invio = creazione del PDF approvato; destinatario = email attuale del cliente.',
  pdf.creato, now()
from pdf
join public.scadenze_bandi_progetti p on p.codice_progetto = pdf.codice_progetto
join public.scadenze_bandi_clienti c on c.id = p.cliente_id
where not exists (
  select 1 from public.scadenze_bandi_contract_tracking t
  where t.entity_type = 'PROGETTO' and t.entity_id = p.id
);
