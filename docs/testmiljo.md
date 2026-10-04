# Testmiljø

Tre miljøer, tre databaser. Ingen av dem deler data med de andre.

| Miljø | Gren | Adresse | Database |
|---|---|---|---|
| Produksjon | `main` | `sunny-semolina-02e49d.netlify.app` | Supabase, prod |
| Test | `test` | `test--sunny-semolina-02e49d.netlify.app` | Supabase, test |
| Lokalt | — | `localhost:3000` | Postgres på din maskin |

Produksjon får nye endringer bare når du sier **«legg ut»**.

---

## Vernet

Skillet mellom test og produksjon er ikke bygget på at noen husker å
sette riktig `DATABASE_URL`. Det er bygget inn i koden.

`app/src/db/vern.ts` kjøres både når appen åpner databasen og når
migreringen endrer tabellene. Vet den at dette ikke er produksjon —
fordi `MILJO` er `test` eller `lokal`, fordi Netlify sier
`CONTEXT=branch-deploy`, eller fordi `next dev` har satt
`NODE_ENV=development` — og URL-en likevel peker på produksjonsbasen,
så stopper den med en feilmelding i stedet for å koble til.

Taushet regnes som produksjon. En glemt variabel skal ikke ta ned den
ekte appen for montørene; den skal bare la den stå.

**Skru den aldri av for å få noe til å virke.** Feiler den, peker noe
faktisk feil sted.

---

## Oppsett, én gang

### 1. Testdatabase hos Supabase

Lag den selv i Supabase, så passordet aldri er innom en chat eller en
loggfil.

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Navn: `montorappen-test`. Region: **West EU (London)** — samme som
   produksjon, så tregheten er lik.
3. La Supabase lage passordet. Lagre det i passordboksen din.
4. **Connect** → **Transaction pooler** → kopier URI-en. Den ser slik ut:
   `postgresql://postgres.<ref>:<passord>@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`
5. **Connect** → **Session pooler** (port 5432) → kopier den også. Den
   skal brukes til migrering, som krever én forbindelse som står i ro.

Gratisplanen hos Supabase rommer to prosjekter, så dette koster
ingenting.

### 2. Miljøvariabler i Netlify

Netlify → **Site configuration → Environment variables**.

Hver variabel kan ha **forskjellig verdi per kontekst**. Det er det som
gjør at testgrenen kan ha sin egen database. Velg **«Different value for
each deploy context»** når du legger dem inn.

Disse må settes for **Branch deploys**:

| Variabel | Verdi | Hemmelig |
|---|---|---|
| `DATABASE_URL` | testbasen, transaction pooler (6543) | ja |
| `DATABASE_URL_DIREKTE` | testbasen, session pooler (5432) | ja |
| `AUTH_URL` | `https://test--sunny-semolina-02e49d.netlify.app` | nei |
| `AUTH_SECRET` | egen verdi, `npx auth secret` | ja |
| `KRYPTERINGSNOKKEL` | egen verdi, `openssl rand -base64 32` | ja |

`MILJO` er allerede satt: `produksjon` på produksjon, `test` på
branch deploys.

**Sjekk samtidig at produksjonsverdiene er låst til produksjon.** En
variabel som står på «Same value for all deploy contexts» gjelder også
testgrenen — og da ville testen skrevet i den ekte basen. Det er den ene
feilen dette oppsettet finnes for å hindre, og vernet stopper den, men
den bør ikke oppstå.

De øvrige nøklene — Tripletex, Pocket, ABAX, SMS, Graph — kan du velge:

- **la dem stå på «alle kontekster»**, så tester du mot de ekte
  tjenestene, eller
- **sett tomme verdier for branch deploys**, så er integrasjonene av i
  test og ingenting kan sendes ut ved et uhell.

Anbefalt: tomt for SMS, e-post og Tripletex-skriving. Et testbilde som
havner på et ekte prosjekt i Tripletex er vanskelig å få bort igjen.

### 3. Slå på branch deploys

Netlify → **Site configuration → Build & deploy → Branches and deploy
contexts** → **Add branch** → `test`.

Uten dette bygges ikke grenen i det hele tatt.

### 4. Entra ID

Dette er adressene du spurte om. Én app-registrering, tre Redirect URI-er.

Azure-portalen → **Entra ID → App registrations** → appen →
**Authentication** → **Web** → **Add URI**:

```
https://sunny-semolina-02e49d.netlify.app/api/auth/callback/microsoft-entra-id
https://test--sunny-semolina-02e49d.netlify.app/api/auth/callback/microsoft-entra-id
http://localhost:3000/api/auth/callback/microsoft-entra-id
```

Den første er produksjon og ligger antagelig inne fra før. De to andre
er nye.

`http://localhost:3000` er den eneste adressen Entra godtar uten
HTTPS, og bare fordi den er localhost.

Får du **AADSTS50011** ved innlogging, er adressen i feilmeldingen ikke
lagt inn. Kopier den derfra — den er alltid riktig.

---

## Til daglig

### Kjøre lokalt

```bash
bin/lokalt.sh
```

Setter opp database, tabeller og testdata første gang, og starter appen
på `http://localhost:3000`. Logg inn ved å velge ansatt; passordet er
`lokal-test-passord`.

Krever Node 22. Finner den ingen Postgres, starter den en i Docker.

### Legge noe på testgrenen

```bash
bin/til-test.sh
```

Flytter arbeidet over på `test` og bygger det. Koster ett Netlify-bygg,
så samle gjerne opp flere endringer.

### Legge ut i produksjon

```bash
bin/rull-ut.sh "Hva som ble lagt ut"
```

Bare fra `main`, og bare når du har sagt fra.

---

## Når noe ikke stemmer

**«DATABASE_URL peker på produksjonsbasen, men dette er test»**
Vernet gjorde jobben sin. `DATABASE_URL` for branch deploys er ikke satt,
så Netlify faller tilbake på produksjonsverdien. Sett den per kontekst.

**Testgrenen bygger ikke**
Branch deploys er ikke slått på for `test` (punkt 3), eller den siste
commiten er merket `[skip netlify]`. `bin/til-test.sh` lager alltid én
commit uten merkelappen.

**Innlogging feiler bare på test**
`AUTH_URL` for branch deploys mangler, eller Redirect URI-en er ikke lagt
inn i Entra.

**Tabellene mangler i testbasen**
Migreringen kjører under bygging. Første bygg av testgrenen lager dem.
Feilet det, står grunnen i byggloggen.
