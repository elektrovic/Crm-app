# Sette opp Montørappen — fra ingenting til noe dere kan klikke i

Oppskrifta under er den korteste veien til et system dere kan teste på
mobilen. Den forutsetter ingenting annet enn en nettleser: du trenger
ingen terminal, og du skal ikke kjøre noen kommandoer.

Regn med en halvtime.

Rekkefølgen betyr noe — Netlify trenger databasen før den bygger.

---

## 1. Database hos Supabase

1. Gå til [supabase.com](https://supabase.com) og lag et prosjekt.
   Kall det `montorappen`.
2. **Velg region i EU** — Frankfurt eller Stockholm.
   Dette er ikke en smakssak. Det ligger personopplysninger og
   posisjonsdata fra bilene i denne databasen, og de skal bli i EU/EØS.
3. Sett et databasepassord og ta vare på det.
4. Gå til **Project Settings → Database → Connection string**.

Der finner du flere strenger. **Du trenger to av dem**, og forskjellen
er viktig:

| Hvilken | Port | Skal settes som |
|---|---|---|
| **Transaction pooler** | `6543` | `DATABASE_URL` |
| **Session pooler** | `5432` | `DATABASE_URL_DIREKTE` |

Bytt ut `[YOUR-PASSWORD]` med passordet ditt i begge.

### Ikke bruk «Direct connection»

Dashbordet tilbyr også en **Direct connection** (`db.<ref>.supabase.co`).
Den ser ut som det riktige valget, og den virker ikke:

```
$ host db.<ref>.supabase.co
  IPv4: ingen
  IPv6: 2a05:d01c:...
```

På gratisplanen har den bare IPv6-adresse. Netlify sine funksjoner går ut
over IPv4. Forbindelsen blir aldri opprettet, og feilen du får er en
tidsavbrudd uten forklaring.

Begge strengene våre skal derfor gå gjennom **pooleren**, som har IPv4.

### Finn riktig vertsnavn — ikke gjett

Poseren har flere verter (`aws-0-…`, `aws-1-…`), og begge svarer på DNS.
Velger du feil, får du «Tenant or user not found» først når appen kjører
i produksjon — ikke under bygging.

Kopier derfor strengen fra dashbordet i stedet for å gjette. Skal du
sjekke en streng du allerede har, kan databasen teste den selv:

```sql
create extension if not exists dblink with schema extensions;

select * from extensions.dblink(
  'host=… port=6543 dbname=postgres sslmode=require
   user=… password=… connect_timeout=8',
  'select count(*)::text from ansatte'
) as t(antall text);
```

Får du et tall tilbake, er strengen riktig — vert, bruker og passord.
Får du en feil, står grunnen i feilmeldingen.

### Hvorfor to

Appen kjører som serverløse funksjoner — mange korte liv, ikke én server
som står. Til det er transaksjonsposeren riktig: den deler et lite knippe
forbindelser på mange kall.

Men den gir deg ikke den samme forbindelsen to ganger. Det går fint for
vanlige spørringer, og dårlig når tabellene skal endres — da må én
forbindelse stå i ro fra start til slutt. Derfor kjører migreringen over
den direkte forbindelsen, og bare den.

Setter du bare `DATABASE_URL`, brukes den til begge. Det virker ofte, og
feiler når du minst vil det.

### Supabase sin GitHub-kobling

Har du koblet Supabase til GitHub-lageret, gjør ikke den noe for oss.
Den ser etter migrasjoner i `supabase/migrations`, og våre ligger i
`app/drizzle` og kjøres under bygginga på Netlify. Den er ufarlig å la
stå, men den er ikke det som lager tabellene.

Tabellene lager appen selv. Du trenger ikke gjøre noe med dem.

---

## 2. Nøkler

Tre hemmeligheter må lages. De er tilfeldige tekststrenger, og de skal
ikke deles med noen.

Har du en terminal:

```bash
openssl rand -base64 32     # kjør tre ganger, én per nøkkel
```

Har du ikke det, bruk en passordgenerator og lag tre strenger på minst 32
tegn hver.

| Nøkkel | Hva den gjør |
|---|---|
| `AUTH_SECRET` | Signerer innloggingen. Byttes den ut, blir alle logget ut. |
| `KRYPTERINGSNOKKEL` | Krypterer Tripletex-tokenene i databasen. **Mistes den, er tokenene tapt.** Ta vare på den. |
| `SYNK_NOKKEL` | Lar den planlagte jobben starte synk mot Tripletex. |

---

## 3. Netlify

1. Logg inn på [netlify.com](https://netlify.com).
2. **Add new site → Import an existing project → GitHub**.
3. Velg `elektrovic/Crm-app`.
4. **Ikke fyll ut noe** under byggeinnstillinger. `netlify.toml` i
   lageret sier allerede hvor appen ligger og hvordan den bygges.
5. Før du trykker Deploy: gå til **Environment variables** og legg inn
   verdiene i neste steg.

### Miljøvariabler

| Navn | Verdi |
|---|---|
| `DATABASE_URL` | Transaction pooler, port **6543** |
| `DATABASE_URL_DIREKTE` | Session pooler, port **5432** |
| `AUTH_SECRET` | Nøkkel 1 |
| `KRYPTERINGSNOKKEL` | Nøkkel 2 |
| `SYNK_NOKKEL` | Nøkkel 3 |
| `AUTH_URL` | Adressa til sida, f.eks. `https://montorappen.netlify.app` |
| `AUTH_TRUST_HOST` | `true` |
| `DEFAULT_TENANT_ID` | `halland` |
| `FIRMANAVN` | `Halland Gruppen` |
| `DEMO_INNLOGGING` | `1` — **se advarselen under** |
| `SEED_VED_BYGG` | `1` — **bare første gang** |

`AUTH_URL` vet du ikke før første bygg. Sett en midlertidig verdi, se hva
sida heter, og rett den opp etterpå. Uten riktig verdi virker ikke
innloggingen.

6. Trykk **Deploy**.

Første bygg tar noen minutter. Under bygginga lager appen tabellene i
Neon og legger inn demodataene.

---

## 4. Etter første bygg

**Fjern `SEED_VED_BYGG` med en gang.** Den er ferdig med jobben sin. Blir
den stående, kjører den ved hvert eneste bygg — ufarlig, siden den hopper
over det som finnes, men det er støy du ikke trenger.

Rett opp `AUTH_URL` hvis den var gjettet.

Så åpner du sida på mobilen. Du får opp tre navn — Tore, Marius og Lise —
og velger hvem du vil se appen som. Tore og Lise er montører, Marius er
leder og ser ledelsesflata.

Legg den til på hjemskjermen, så oppfører den seg som en app.

---

## ⚠️ Om demomodus

`DEMO_INNLOGGING=1` slår av innlogging. **Alle som har lenka kommer
inn.** Det er meningen mens dere ser på systemet, og helt feil når det
ligger noe ekte der.

Før ekte kundedata legges inn:

1. Sett opp Microsoft Entra ID (steg 3 i `app/README.md`).
2. Bytt `entraOid` på de ansatte til de ekte verdiene fra Entra.
3. Fjern `DEMO_INNLOGGING`.
4. Slett demoradene — de tre oppdiktede ansatte og prosjektene deres.

---

## Det som ikke virker ennå, og hvorfor

Dette er ventet på dette stadiet. Ingenting av det er ødelagt.

| | Hvorfor |
|---|---|
| Prosjekter og timer synkes ikke | Tripletex-tokenene er ikke lagt inn |
| Bilkartet er tomt | ABAX-nøklene er ikke lagt inn |
| SMS-knappen vises ikke | `SMS_LEVERANDOR` er ikke satt |
| AI-triagering vises ikke | `AI_LEVERANDOR` er ikke satt |

Alle fire er med vilje: funksjoner uten nøkler skjuler seg selv i stedet
for å feile foran brukeren. Oppskrift for hver av dem ligger i
`app/README.md`.

---

## Slik står oppsettet nå

| | |
|---|---|
| Lager | `elektrovic/Crm-app`, gren `main` |
| Hosting | Netlify, bygger automatisk ved hver push |
| Database | Supabase, region `eu-west-2` (London) |
| Innlogging | Demomodus — **ingen pålogging** |

### To ting å vite før dette tar ekte data

**Serverfunksjonene kjører i USA.** Netlify legger dem i `us-east-2`
(Ohio) på gratisplanen, og det kan ikke endres uten å betale. Alt appen
gjør på serveren — inkludert å behandle posisjonsdata fra bilene — skjer
altså utenfor EU/EØS, selv om databasen står i London. Det går fint for
demodata. Det går ikke for ekte ansatte.

**Databasen står i London, ikke i EU.** `eu-west-2` er Storbritannia.
Overføring dit er tillatt i dag gjennom EU-kommisjonens
adekvansbeslutning for UK, men det er en annen og svakere ordning enn å
ligge i EU/EØS. Frankfurt eller Stockholm er ryddigere. Å flytte betyr
nytt Supabase-prosjekt.

Begge deler er greie mens dere ser på systemet med oppdiktede data.
Begge må løses før første ekte montør fører en time.

---

## En felle i Netlify: «secret»-flagget

Miljøvariabler kan merkes som hemmelige i Netlify. Settes de med det
flagget gjennom API-et, kan de bli **stilltiende forkastet**: svaret sier
at variabelen er lagret, og den finnes ikke.

Det så slik ut her: appen svarte «A server error occurred» på hver side,
og helsesjekken svarte «Not found». Begge deler fordi `DATABASE_URL` og
`SYNK_NOKKEL` ikke fantes — ikke fordi verdiene var feil.

**Sjekk derfor alltid etterpå** at variablene faktisk ligger der, i stedet
for å stole på kvitteringen. Står de ikke i lista, legg dem inn uten
hemmelig-flagget.

Og husk: **endrede miljøvariabler slår ikke inn før neste utrulling.**
Å rette en verdi uten å bygge på nytt gjør ingenting.

## En felle i Postgres: hvem eier tabellene

Bygget feilet på dette, og feilmeldingen sier ikke hva som er galt:

```
PostgresError: must be owner of table vedlegg   (42501)
Failed query: ALTER TABLE "vedlegg" ADD COLUMN "tripletex_forsok" ...
```

Databasen ble satt opp av Supabase sin `postgres`-rolle, mens appen kobler
seg på som `montorappen`. Den fikk `CREATE` på databasen, og det er nok til
å **lage** nye tabeller — derfor gikk alle migreringene fram til nå.

Men `ALTER TABLE` krever at du **eier** tabellen. Det holder ikke å ha
skriverettigheter på den. Så første gang en migrering skulle endre en
kolonne på noe som ble laget før `montorappen` fantes, stoppet den.

Det lumske er at feilen ikke kommer før den dagen en migrering endrer noe.
Alt ser riktig ut i månedsvis.

### Slik ble det rettet

Kjørt som `postgres` i Supabase sin SQL-editor:

```sql
-- postgres må kunne «bli» montorappen for å gi bort eierskapet
grant montorappen to postgres;

do $$
declare r record;
begin
  for r in select tablename from pg_tables
           where schemaname='public' and tableowner <> 'montorappen' loop
    execute format('alter table public.%I owner to montorappen', r.tablename);
  end loop;
  for r in select sequencename from pg_sequences where schemaname='public' loop
    execute format('alter sequence public.%I owner to montorappen', r.sequencename);
  end loop;
end $$;
```

Sjekk etterpå at alt står på én eier:

```sql
select tableowner, count(*) from pg_tables
where schemaname='public' group by tableowner;
```

Settes databasen opp på nytt et annet sted, er dette verdt å gjøre med en
gang — ikke vente til en migrering feiler.
