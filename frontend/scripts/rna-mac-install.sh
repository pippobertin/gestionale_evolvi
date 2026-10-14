#!/bin/bash
# ============================================================================
# Installa sul Mac l'aggiornamento automatico degli aiuti RNA.
#
# Perché sul Mac: rna.gov.it non accetta connessioni dai server cloud
# (Vercel e GitHub Actions vanno in timeout), mentre da una connessione
# italiana normale risponde.
#
# Cosa fa:
#   - copia l'agente e l'importazione in ~/Library/Application Support/GestionaleEvolviRNA
#     (fuori da Documenti, che macOS protegge dai processi in background)
#   - installa lì la sola libreria Supabase
#   - avvia l'agente con launchd ogni 5 minuti (e all'accensione). L'agente:
#       * esegue le richieste fatte dal pulsante "Aggiorna da RNA" del gestionale
#       * ogni 7 giorni rilegge gli ultimi 4 mesi, ogni 30 giorni lo storico dal 2020
#         (se il Mac era spento o in stop recupera appena si riaccende)
#   - fa subito un giro dell'agente
#
# Uso (dalla cartella frontend):   bash scripts/rna-mac-install.sh
# Da rilanciare se cambia src/lib/rna/importer.ts o scripts/rna-import.mts.
#
# Disinstallazione:
#   launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/it.blmproject.gestionale.rna-sync.plist
#   rm ~/Library/LaunchAgents/it.blmproject.gestionale.rna-sync.plist
#   rm -rf ~/Library/Application\ Support/GestionaleEvolviRNA
# ============================================================================
set -euo pipefail

FRONTEND="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/Library/Application Support/GestionaleEvolviRNA"
LABEL="it.blmproject.gestionale.rna-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/gestionale-rna-sync.log"

NODE="$(command -v node || true)"
NPM="$(command -v npm || true)"
if [ -z "$NODE" ] || [ -z "$NPM" ]; then
  echo "ERRORE: node/npm non trovati nel PATH." ; exit 1
fi
if ! "$NODE" -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=6)?0:1)'; then
  echo "ERRORE: serve Node 22.6 o superiore (trovato $("$NODE" -v))." ; exit 1
fi
if [ ! -f "$FRONTEND/.env.local" ]; then
  echo "ERRORE: manca $FRONTEND/.env.local" ; exit 1
fi

echo "→ Copio i file in: $DEST"
mkdir -p "$DEST/src/lib/rna" "$DEST/scripts" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cp "$FRONTEND/src/lib/rna/importer.ts" "$DEST/src/lib/rna/importer.ts"
cp "$FRONTEND/scripts/rna-import.mts" "$DEST/scripts/rna-import.mts"
cp "$FRONTEND/scripts/rna-agent.mts" "$DEST/scripts/rna-agent.mts"
grep -E '^NEXT_PUBLIC_SUPABASE_(URL|ANON_KEY)=' "$FRONTEND/.env.local" > "$DEST/.env.local"
chmod 600 "$DEST/.env.local"

cat > "$DEST/package.json" <<'JSON'
{ "name": "gestionale-rna-sync", "private": true, "type": "module" }
JSON
VER="$("$NODE" -p "require('$FRONTEND/package.json').dependencies['@supabase/supabase-js']")"
echo "→ Installo @supabase/supabase-js@$VER"
( cd "$DEST" && "$NPM" install --no-audit --no-fund --silent "@supabase/supabase-js@$VER" )

cat > "$DEST/run.sh" <<RUN
#!/bin/bash
# Generato da rna-mac-install.sh — non modificare a mano.
cd "\$(dirname "\$0")"
"$NODE" --experimental-strip-types scripts/rna-agent.mts 2>&1 | grep -v -i -E 'experimentalwarning|type stripping|trace-warnings|MODULE_TYPELESS|Reparsing|eliminate this warning'
RUN
chmod +x "$DEST/run.sh"

cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$DEST/run.sh</string></array>
  <key>StartInterval</key><integer>300</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PL

echo "→ Attivo l'agente (ogni 5 minuti e all'accensione)"
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "→ Primo giro dell'agente"
sleep 3
tail -n 20 "$LOG" 2>/dev/null || true

echo ""
echo "Fatto. Log delle esecuzioni: $LOG"
