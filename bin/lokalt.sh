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
  # Postgres.app legger ikke binærfilene i PATH av seg selv.
  for d in /Applications/Postgres.app/Contents/Versions/*/bin; do
    [ -d "$d" ] && PATH="$PATH:$d"
  done
  export PATH

  if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    return 0
  fi

  # 1) Postgres.app er installert, men ikke startet.
  if [ -d /Applications/Postgres.app ]; then
    si "Starter Postgres.app …"
    open -a Postgres >/dev/null 2>&1 || true
    for _ in $(seq 1 25); do
      pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1 && return 0
      sleep 1
    done
  fi

  # 2) Homebrew.
  if command -v brew >/dev/null; then
    tjeneste="$(brew services list 2>/dev/null | awk '/^postgresql/{print $1; exit}')"
    if [ -z "$tjeneste" ]; then
      si "Installerer Postgres via Homebrew (tar noen minutter) …"
      brew install postgresql@17 >/dev/null
      tjeneste="postgresql@17"
    fi
    si "Starter Postgres …"
    brew services start "$tjeneste" >/dev/null 2>&1 || true
    for _ in $(seq 1 25); do
      pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1 && return 0
      sleep 1
    done
  fi

  # 3) Docker.
  if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
    if [ -z "$(docker ps -q -f name=montorappen-db)" ]; then
      si "Starter Postgres i Docker …"
      docker start montorappen-db >/dev/null 2>&1 || \
        docker run -d --name montorappen-db \
          -e POSTGRES_USER=montor \
          -e POSTGRES_HOST_AUTH_METHOD=trust \
          -e POSTGRES_DB=montorappen \
          -p 5432:5432 postgres:17 >/dev/null
    fi
    printf 'Venter på databasen'
    for _ in $(seq 1 40); do
      if docker exec montorappen-db pg_isready -U montor >/dev/null 2>&1; then
        echo " — oppe."
        return 0
      fi
      printf '.'; sleep 1
    done
    echo
  fi

  nei "Fant ingen database. Enkleste vei: installer Homebrew fra brew.sh,
lukk vinduet, åpne et nytt og kjør denne på nytt. Da ordner resten seg selv."
}

start_postgres

# Rollen og basen finnes ikke på en fersk Postgres. Lages de ikke her,
# møter du «role montor does not exist» i stedet for en app.
#
# Hvem som er administrator varierer med hvordan Postgres ble installert:
# Postgres.app og Homebrew bruker ditt eget brukernavn, Docker og Linux
# bruker «postgres». Vi prøver oss fram i stedet for å gjette.
adm=""
for u in "$(id -un)" postgres montor; do
  if psql -h 127.0.0.1 -U "$u" -d postgres -tAc "select 1" >/dev/null 2>&1; then
    adm="$u"; break
  fi
done
[ -n "$adm" ] || nei "Postgres svarer, men slipper meg ikke inn. Hvilken bruker er administrator?"

kjor_sql() { psql -h 127.0.0.1 -U "$adm" -d postgres -tAc "$1" 2>/dev/null; }

kjor_sql "select 1 from pg_roles where rolname='montor'" | grep -q 1 \
  || kjor_sql "create role montor login superuser" >/dev/null
kjor_sql "select 1 from pg_database where datname='montorappen'" | grep -q 1 \
  || kjor_sql "create database montorappen owner montor" >/dev/null

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

# ------------------------------------------------------ første bruker
#
# Ingen demodata. Du ba om en portal uten kulisser, og tre oppdiktede
# ansatte gjør det umulig å se om det du nettopp bygget virker på ekte
# data eller bare på dem.
#
# I stedet lages din egen administrator, én gang, hvis basen er tom.
# Resten av brukerne lager du inne i portalen.
#
# Vil du likevel ha testdata å klikke rundt i:  npm run db:demodata
# Vil du tømme alt igjen:                       npm run db:tom
# Vi teller brukere som FAKTISK kan logge inn, ikke rader i tabellen.
# Gamle demodata ga rader uten passord, og da hoppet dette over — med en
# base full av ansatte og ingen vei inn.
medPassord="$(psql "$BASE_URL" -tAc \
  "select count(*) from ansatte where passord_hash is not null and aktiv" 2>/dev/null | tr -d ' ' || true)"
[ -n "$medPassord" ] || medPassord=0

if [ "$medPassord" = "0" ]; then
  antall="$(psql "$BASE_URL" -tAc "select count(*) from ansatte" 2>/dev/null | tr -d ' ' || true)"
  [ -n "$antall" ] || antall=0

  if [ "$antall" != "0" ]; then
    si "Fant $antall gamle ansatte uten passord — rydder dem bort …"
    (cd "$app" && npm run --silent db:tom)
  fi

  si "Lager din administrator …"
  (cd "$app" && npm run --silent db:forstebruker -- "${MONTOR_NAVN:-Victor Halland}" "${MONTOR_EPOST:-victor@hallandgroup.no}")
fi

si "Starter appen på http://localhost:3000"
echo "Avslutt med Ctrl+C."
echo
exec env MILJO=lokal npm --prefix "$app" run dev
