#!/usr/bin/env bash
#
# Starter Montørappen lokalt, mot din egen database på maskinen.
#
# Bruk:  bin/lokalt.sh
# Så:    åpne http://localhost:3000
#
# Den rører ALDRI produksjonsbasen. Vernet i app/src/db/vern.ts nekter å
# koble til den når MILJO er «lokal», så selv en DATABASE_URL som er
# klippet fra feil sted stopper her i stedet for å skrive i den ekte
# basen.
set -euo pipefail

cd "$(dirname "$0")/.."
app="$PWD/app"

BASE_URL="postgres://montor@127.0.0.1:5432/montorappen"

si() { printf '\n\033[1m%s\033[0m\n' "$*"; }
nei() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

# --------------------------------------------------------------- node
command -v node >/dev/null || nei "Node er ikke installert. Hent versjon 22 fra nodejs.org."
major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$major" -ge 22 ] || nei "Node $major er for gammel. Appen bygges med versjon 22."

# ----------------------------------------------------------- database
#
# Tre veier, i tur og orden: en Postgres som alt kjører, en vi kan starte,
# eller en vi setter opp i Docker. Den som vil teste en knapp skal ikke
# måtte lese en installasjonsveiledning først.
start_postgres() {
  if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    return 0
  fi

  if command -v brew >/dev/null && brew services list 2>/dev/null | grep -q postgres; then
    si "Starter Postgres via Homebrew …"
    brew services start "$(brew services list | awk '/postgres/{print $1; exit}')" >/dev/null
    sleep 3
  elif command -v docker >/dev/null; then
    if [ -z "$(docker ps -q -f name=montorappen-db)" ]; then
      si "Starter Postgres i Docker …"
      docker run -d --name montorappen-db --rm \
        -e POSTGRES_USER=montor \
        -e POSTGRES_HOST_AUTH_METHOD=trust \
        -e POSTGRES_DB=montorappen \
        -p 5432:5432 postgres:17 >/dev/null 2>&1 \
        || docker start montorappen-db >/dev/null
    fi
    printf 'Venter på databasen'
    for _ in $(seq 1 30); do
      if docker exec montorappen-db pg_isready -U montor >/dev/null 2>&1; then
        echo " — oppe."
        return 0
      fi
      printf '.'; sleep 1
    done
    echo
    nei "Databasen i Docker svarte ikke."
  else
    nei "Fant ingen Postgres. Installer den, eller installer Docker — da ordner dette seg selv."
  fi

  pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1 || nei "Postgres svarer ikke på port 5432."
}

start_postgres

# ---------------------------------------------------------------- .env
if [ ! -f "$app/.env" ]; then
  si "Lager app/.env for lokal kjøring …"
  cp "$app/.env.example" "$app/.env"
  {
    echo
    echo "# Satt av bin/lokalt.sh"
    echo "MILJO=lokal"
    echo "DATABASE_URL=$BASE_URL"
    echo "AUTH_URL=http://localhost:3000"
    echo "DEMO_INNLOGGING=1"
    echo "DEMO_PASSORD=lokal-test-passord"
    echo "AUTH_SECRET=$(openssl rand -base64 32)"
    echo "KRYPTERINGSNOKKEL=$(openssl rand -base64 32)"
  } >> "$app/.env"
  echo "Ferdig. Innlogging: velg ansatt, passord «lokal-test-passord»."
fi

# MILJO=lokal er det som holder produksjonsbasen utenfor rekkevidde.
# Mangler den i en .env noen har laget selv, legges den til.
grep -q '^MILJO=' "$app/.env" || echo "MILJO=lokal" >> "$app/.env"

# --------------------------------------------------- avhengigheter
if [ ! -d "$app/node_modules" ]; then
  si "Installerer pakker (tar et par minutter første gang) …"
  (cd "$app" && npm install)
fi

# ------------------------------------------------------- migrering
si "Oppdaterer tabellene …"
(cd "$app" && npm run db:migrate)

# -------------------------------------------------------- testdata
#
# Bare når basen er tom. Har du jobbet med noe lokalt, skal det ikke bli
# overskrevet av tre oppdiktede ansatte fordi du startet appen på nytt.
antall="$(psql "$BASE_URL" -tAc "select count(*) from ansatte" 2>/dev/null || echo 0)"
if [ "$antall" = "0" ]; then
  si "Basen er tom — legger inn testdata …"
  # Flagget må settes: demodata.ts nekter å kjøre uten, nettopp for at
  # den aldri skal kunne gå av seg selv mot en ekte base.
  (cd "$app" && SEED_VED_BYGG=1 npm run db:demodata)
fi

si "Starter appen på http://localhost:3000"
echo "Avslutt med Ctrl+C."
echo
exec env MILJO=lokal npm --prefix "$app" run dev
