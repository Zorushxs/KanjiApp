#!/usr/bin/env bash
# Proves al navegador: engega el servidor, obre l'arnès amb Chrome sense finestra i en mostra el resultat.
# Ús (des de Git Bash): bash tests/browser/run.sh [port]
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8767}"
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
PROFILE="$(mktemp -d)"
rm -f "$HERE/result.txt"
python "$HERE/server.py" "$PORT" >/dev/null 2>&1 &
SRV=$!
sleep 1
"$CHROME" --headless=new --disable-gpu --no-first-run --autoplay-policy=no-user-gesture-required \
  --user-data-dir="$PROFILE" --window-size=1200,1000 "http://127.0.0.1:$PORT/tests/browser/harness.html" >/dev/null 2>&1 &
CH=$!
for i in $(seq 1 240); do [ -f "$HERE/result.txt" ] && break; sleep 0.5; done
kill $CH $SRV 2>/dev/null
# Tanca només els Chrome d'aquest perfil temporal (mai el teu Chrome normal).
if command -v powershell >/dev/null; then
  powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -like '*$(basename "$PROFILE")*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1
fi
rm -rf "$PROFILE" 2>/dev/null
if [ -f "$HERE/result.txt" ]; then
  grep -v '^ok' "$HERE/result.txt"; echo "($(grep -c '^ok' "$HERE/result.txt") ok)"
  grep -q 'TOT OK' "$HERE/result.txt"
else
  echo "SENSE RESULTAT (temps esgotat)"; exit 1
fi
