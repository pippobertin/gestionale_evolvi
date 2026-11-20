#!/bin/bash
# =============================================================================
# Prova di chiusura del Gestionale Evolvi con la sola chiave pubblica (anon).
#
# La chiave pubblica è contenuta nel codice JavaScript del sito: chiunque può
# leggerla. Questo script verifica che, con essa sola, nessuna tabella, vista,
# funzione o file del gestionale sia leggibile o modificabile.
#
# Uso (dalla cartella frontend):  bash scripts/prova-chiave-pubblica.sh
# Legge NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY da .env.local
# (o dall'ambiente). Non scrive nulla: i tentativi di scrittura usano dati di
# prova e devono essere rifiutati.
# =============================================================================
if [ -f .env.local ]; then
  while IFS='=' read -r k v; do
    case "$k" in NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)
      v="${v%\"}"; v="${v#\"}"; [ -z "${!k}" ] && export "$k=$v";; esac
  done < .env.local
fi
URL="${NEXT_PUBLIC_SUPABASE_URL%/}"
K="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
if [ -z "$URL" ] || [ -z "$K" ]; then echo "Mancano NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY"; exit 1; fi
H=(-H "apikey: $K" -H "Authorization: Bearer $K")

TABELLE="scadenze_bandi_additional_recipients scadenze_bandi_ateco_2025 scadenze_bandi_bandi scadenze_bandi_bandi_esterni scadenze_bandi_bandi_view scadenze_bandi_calendar_events scadenze_bandi_ccnl scadenze_bandi_ccnl_sigle scadenze_bandi_certificazioni_obbligatorie scadenze_bandi_clienti scadenze_bandi_clienti_adesioni_fpi scadenze_bandi_clienti_bandi_esterni scadenze_bandi_clienti_completa scadenze_bandi_clienti_con_dimensione_aggregata scadenze_bandi_clienti_con_documenti scadenze_bandi_clienti_con_referenti scadenze_bandi_clienti_documenti scadenze_bandi_clienti_esigenze scadenze_bandi_clienti_note scadenze_bandi_clienti_note_full scadenze_bandi_clienti_referenti scadenze_bandi_collegamenti_aziendali scadenze_bandi_consulenti_clienti scadenze_bandi_contatti scadenze_bandi_contract_tracking scadenze_bandi_contratti_evolvi scadenze_bandi_contributi_ottenuti scadenze_bandi_corsi_formativi scadenze_bandi_dashboard scadenze_bandi_documenti scadenze_bandi_documenti_amministrativi scadenze_bandi_documenti_bando scadenze_bandi_documenti_cliente scadenze_bandi_documenti_formazione scadenze_bandi_documenti_progetto scadenze_bandi_documenti_progetto_view scadenze_bandi_email_accounts scadenze_bandi_email_attachments scadenze_bandi_email_folders scadenze_bandi_email_links scadenze_bandi_email_messages scadenze_bandi_email_queue scadenze_bandi_email_sync_logs scadenze_bandi_eventi_catalogo scadenze_bandi_evolvi_fatture scadenze_bandi_fabbisogno_inserimenti_previsti scadenze_bandi_fabbisogno_obblighi_dichiarati scadenze_bandi_fabbisogno_popolazione scadenze_bandi_fabbisogno_rilevazioni scadenze_bandi_fondi_interprofessionali scadenze_bandi_gruppi_utenti scadenze_bandi_legali_rappresentanti scadenze_bandi_note_bandi scadenze_bandi_note_progetti scadenze_bandi_notification_log scadenze_bandi_notification_settings scadenze_bandi_partecipanti_formazione scadenze_bandi_piani_formativi scadenze_bandi_profiling_template scadenze_bandi_progetti scadenze_bandi_progetti_eventi scadenze_bandi_progetti_view scadenze_bandi_prospect scadenze_bandi_prospect_history scadenze_bandi_responsabili_scadenze scadenze_bandi_rna_agente scadenze_bandi_rna_aiuti scadenze_bandi_rna_import_log scadenze_bandi_rna_richieste scadenze_bandi_scadenze scadenze_bandi_scadenze_contrattuali scadenze_bandi_scadenze_contrattuali_log scadenze_bandi_sessioni scadenze_bandi_sigle_sindacali scadenze_bandi_system_settings scadenze_bandi_template_scadenze scadenze_bandi_template_view scadenze_bandi_tipologie_bando scadenze_bandi_tipologie_scadenze scadenze_bandi_uffici_dipartimenti scadenze_bandi_utenti scadenze_bandi_utenti_view scadenze_enhanced_simple vista_contributi_ottenuti vista_match_bandi_clienti vista_match_bandi_per_cliente vista_rna_aiuti"

aperte=0; errori=0; chiuse=0
esito() { # $1 descrizione, $2 codice HTTP, $3 corpo
  if [ "$2" = "000" ]; then echo "ERRORE RETE  $1"; errori=$((errori+1)); return; fi
  case "$2" in
    2*) if [ -z "$3" ] || [ "$3" = "[]" ]; then echo "chiusa       $1 ($2, nessun dato)"; chiuse=$((chiuse+1));
        else echo "APERTA       $1 ($2) ${3:0:80}"; aperte=$((aperte+1)); fi ;;
    *)  echo "chiusa       $1 ($2)"; chiuse=$((chiuse+1)) ;;
  esac
}
richiesta() { r=$(curl -s -w '\n%{http_code}' "$@"); CODE=$(echo "$r" | tail -1); BODY=$(echo "$r" | sed '$d'); }

echo "== Lettura di tabelle e viste"
for t in $TABELLE; do richiesta "${H[@]}" "$URL/rest/v1/$t?select=*&limit=1"; esito "$t" "$CODE" "$BODY"; done

echo "== Scrittura (deve essere rifiutata)"
richiesta "${H[@]}" -H "Content-Type: application/json" -H "Prefer: return=representation" -X POST "$URL/rest/v1/scadenze_bandi_clienti" -d '{"denominazione":"PROVA CHIAVE PUBBLICA"}'
esito "inserimento in clienti" "$CODE" "$BODY"
richiesta "${H[@]}" -H "Content-Type: application/json" -H "Prefer: return=representation" -X PATCH "$URL/rest/v1/scadenze_bandi_utenti?email=eq.nessuno@example.com" -d '{"gruppo_id":null}'
esito "modifica gruppo utenti" "$CODE" "$BODY"

echo "== Funzioni di ricerca"
for f in match_clienti match_bandi match_progetti; do
  richiesta "${H[@]}" -H "Content-Type: application/json" -X POST "$URL/rest/v1/rpc/$f" -d '{"query_text":"srl","max_results":3,"soglia_minima":0.1}'
  esito "funzione $f" "$CODE" "$BODY"
done

echo "== Archivi dei file"
for b in bandi-documenti clienti-documenti progetti-documenti clienti-amministrativi contratti-firmati; do
  richiesta "${H[@]}" -H "Content-Type: application/json" -X POST "$URL/storage/v1/object/list/$b" -d '{"prefix":"","limit":5}'
  esito "elenco file $b" "$CODE" "$BODY"
done
richiesta "${H[@]}" "$URL/storage/v1/object/public/progetti-documenti/e71655ec-d08f-4af0-9aad-665948877c02/1779432141005_Modul_C.pdf"
esito "link pubblico progetti-documenti" "$CODE" "$( [ "${CODE:0:1}" = 2 ] && echo file)"
richiesta "${H[@]}" -H "Content-Type: text/plain" -X POST "$URL/storage/v1/object/clienti-amministrativi/prova-chiave-pubblica.txt" --data-binary "prova"
esito "caricamento in clienti-amministrativi" "$CODE" "$( [ "${CODE:0:1}" = 2 ] && echo caricato)"

echo
echo "Risultato: $chiuse chiuse, $aperte APERTE, $errori errori di rete"
[ "$aperte" -eq 0 ] && [ "$errori" -eq 0 ] && echo "OK: con la sola chiave pubblica non si accede a nulla del gestionale."
