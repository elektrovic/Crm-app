#!/usr/bin/env bash
#
# Flytter det som ligger på denne grenen over på «test», og bygger den.
#
# Bruk:  bin/til-test.sh
#
# Testgrenen rulles ut på
#   https://test--sunny-semolina-02e49d.netlify.app
# mot testdatabasen, aldri mot produksjon. Produksjon røres ikke før du
# kjører bin/rull-ut.sh på main.
#
# Dette koster ett Netlify-bygg. Samle gjerne opp flere endringer først.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "Det ligger uforpliktede endringer. Commit dem først — ellers blir de"
  echo "ikke med, og du tester noe annet enn det du tror."
  git status --short
  exit 1
fi

fra="$(git rev-parse --abbrev-ref HEAD)"

git fetch origin test >/dev/null 2>&1 || true
git checkout -B test "$fra"

# Uten en commit uten «[skip netlify]» bygger ikke Netlify. Vanlige
# commits er merket med den nettopp for å slippe et bygg per endring.
git commit --allow-empty -m "Test: $(git log -1 --pretty=%s "$fra")"
git push -u --force-with-lease origin test

git checkout "$fra"

echo
echo "Testgrenen er oppdatert og bygges nå."
echo "  https://test--sunny-semolina-02e49d.netlify.app"
echo
echo "Produksjon er urørt. Si «legg ut» når testen ser bra ut."
