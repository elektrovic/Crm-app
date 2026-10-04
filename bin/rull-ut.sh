#!/usr/bin/env bash
#
# Starter ett Netlify-bygg.
#
# Alle vanlige commits merkes «[skip netlify]» og bygger ikke. Denne lager
# én tom commit uten den merkelappen, og da bygges alt som er pushet siden
# sist i én runde.
#
# Bruk:  bin/rull-ut.sh "Kalenderen og hurtigregistreringen"
set -euo pipefail

grunn="${1:-Rull ut det som er pushet}"

if [ -n "$(git status --porcelain)" ]; then
  echo "Det ligger uforpliktede endringer. Commit dem først — ellers blir de"
  echo "ikke med i bygget, og du tror de er ute."
  git status --short
  exit 1
fi

git commit --allow-empty -m "Rull ut: ${grunn}"
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"

echo
echo "Bygget er startet. Det tar rundt 30 sekunder."
