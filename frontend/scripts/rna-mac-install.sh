#!/bin/bash
# ============================================================================
# Installa sul Mac l'aggiornamento automatico degli aiuti RNA.
#
# Perché sul Mac: rna.gov.it non accetta connessioni dai server cloud
# (Vercel e GitHub Actions vanno in timeout), mentre da una connessione
# italiana normale risponde.
#
# Cosa fa:
#   - copia lo script di importazione in ~/Library/Application Support/GestionaleEvolviRNA
#     (fuori da Documenti, che macOS protegge dai processi in background)
#   - installa lì la sola libreria Supabase
#   - pianifica l'esecuzione ogni lunedì alle 9:00 con launchd:
#       * primo lunedì del mese: rilettura completa dal 2020 (recupera lo storico dei clienti nuovi)
#       * altri lunedì: ultimi 4 mesi
#     Se il Mac è in stop alle 9:00 parte al risveglio; se è spento salta alla settimana dopo.
#   - fa subito una prova sul mese corrente
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
A=\$(date -u +%Y_%m)
if [ "\$(date +%e | tr -d ' ')" -le 7 ]; then
  DA=2020_01                               # primo lunedì del mese: storico completo
else
  DA=\$(date -u -v1d -v-3m +%Y_%m)          # ultimi 4 mesi
fi
echo "=== \$(date '+%Y-%m-%d %H:%M') importazione RNA \$DA → \$A"
"$NODE" --experimental-strip-types scripts/rna-import.mts "\$DA" "\$A" 2>&1 | grep -v -i -E 'experimentalwarning|type stripping|trace-warnings'
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
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>1</integer>
    <key>Hour</key><integer>9</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PL

echo "→ Attivo la pianificazione (ogni lunedì alle 9:00)"
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "→ Prova sul mese corrente"
( cd "$DEST" && "$NODE" --experimental-strip-types scripts/rna-import.mts "$(date -u +%Y_%m)" 2>&1 \
  | grep -v -i -E 'experimentalwarning|type stripping|trace-warnings' )

echo ""
echo "Fatto. Log delle esecuzioni: $LOG"
