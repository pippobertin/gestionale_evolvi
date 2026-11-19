-- =============================================================================
-- Documenti di progetto ereditati dal bando: collegamento al file vero (19/11/2026)
--
-- Alla creazione di un progetto il form salvava i documenti del bando con un
-- percorso "placeholder" (temp_.../placeholder_<nome>) che non è mai esistito
-- nell'archivio: anteprima e download davano "Object not found". Ogni documento
-- ereditato corrisponde a uno e un solo documento del bando (stesso bando, stesso
-- nome) il cui file è in bandi-documenti: si salvano quel percorso e il
-- collegamento al documento di origine. Il codice (ProgettoForm) legge ora i
-- documenti ereditati dall'archivio dei bandi.
-- I valori precedenti sono conservati in gestionale_backup (schema non esposto
-- dalle API) per l'annullamento: 20261119_documenti_ereditati_file_bando_ROLLBACK.sql
-- =============================================================================
create schema if not exists gestionale_backup;
revoke all on schema gestionale_backup from public, anon, authenticated;

create table gestionale_backup.documenti_progetto_url_20261119 as
  select id, url_file, bando_documento_origine_id
  from public.scadenze_bandi_documenti_progetto
  where url_file like '%/placeholder\_%';

update public.scadenze_bandi_documenti_progetto d
set url_file = b.url_file,
    bando_documento_origine_id = b.id
from public.scadenze_bandi_progetti p, public.scadenze_bandi_documenti b
where p.id = d.progetto_id
  and b.bando_id = p.bando_id
  and (b.nome_file = d.nome_file or b.nome_originale = d.nome_file)
  and d.url_file like '%/placeholder\_%';
