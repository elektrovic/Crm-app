# Montørappen

Intern portal for Halland Gruppen. Timeføring mot Tripletex, bilkart og
kjørebok fra ABAX, og prosjektinfo montørene deler seg imellom. Én
installerbar web-app (PWA) som virker på både mobil og PC.

Bygget etter prototypen i `../project/Montørappen.dc.html` — designsystemet
i `src/app/globals.css` er hentet derfra, slik at alt nytt arver samme
utseende automatisk.

## Status

Dette er **fase 1–6** av seks, med Ahlsell-transporten som eneste rest.
Det som virker i dag:

| Del | Status |
| --- | --- |
| Designsystem fra prototypen | Ferdig |
| Innlogging med Entra ID + roller | Ferdig |
| Databaseskjema med kunde-ID | Ferdig |
| Tripletex-klient (timer, prosjekter, aktiviteter) | Ferdig |
| ABAX-klient + timeforslag fra kjørebok | Ferdig, med tester |
| PWA med offline sendekø | Ferdig |
| Skjermer: hjem, timer, bilkart, sendekø | Ferdig |
| Prosjektkort med adkomstinfo | Ferdig |
| Mangler med diktering og bestilling til leder | Ferdig |
| Tillegg med prisliste, bilde og signatur | Ferdig |
| Kontrollskjema, ett spørsmål av gangen | Ferdig |
| SMS til kunde før og etter oppdrag | Ferdig, med tester |
| Admin-flate med mørk sidemeny og rollesperre | Ferdig |
| CRM med fem underfaner | Ferdig |
| Henvendelser i én liste med AI-triagering | Ferdig |
| Bemanning med fargekoder og ukesoversikt | Ferdig |
| Synk av prosjekter, aktiviteter og ansatte fra Tripletex | Ferdig |
| Aktivitetsvelger i timeskjermen | Ferdig |
| Kryptering av Tripletex-token | Ferdig, med tester |
| Bestillingsmodell med varenummer og CSV-eksport | Ferdig, med tester |
| Tillegg som underprosjekt i Tripletex | Ferdig, med tester |
| Bilder og signaturer til Tripletex-vedlegg | Ferdig |
| Geokoding av prosjektadresser (Kartverket) | Ferdig, med tester |
| Ahlsell-transport (EDI eller PunchOut) | Venter på e-handelsavtale |

## Kom i gang

```bash
npm install
cp .env.example .env      # fyll ut verdiene under
npm run db:push           # oppretter tabellene
npm run db:seed           # testdata for utvikling
npm run dev
```

### Se appen uten Entra ID

Innlogging går normalt gjennom Microsoft Entra ID, og den app-registreringen
må noen sette opp før det finnes en vei inn. For å komme inn før det:

```bash
DEMO_INNLOGGING=1        # i .env
```

Da får innloggingssida en liste over de ansatte som ligger i databasen, og
man velger hvem man vil se appen som. Ingen passord.

Demomodus slipper bare inn ansatte som allerede finnes og er aktive — den
lager ingen kontoer — men den er likevel en åpen dør. **Den skal stå av i
det øyeblikket ekte kundedata legges inn.** Bakgrunnen står i
`src/lib/demo.ts`.

### Miljøvariabler

Alle ligger forklart i `.env.example`. De tre som må på plass før noe virker:

- `AUTH_MICROSOFT_ENTRA_ID_*` — fra App registrations i Entra ID.
  Redirect URI: `https://<domene>/api/auth/callback/microsoft-entra-id`
- `DATABASE_URL` — PostgreSQL, i EU-region i produksjon.
- `TRIPLETEX_CONSUMER_TOKEN` og `TRIPLETEX_EMPLOYEE_TOKEN`.

ABAX-variablene kan stå tomme; da vises bilkartet med en feilmelding og
timeforslagene uteblir, men resten av appen virker.

SMS og e-post er avslått til de er satt opp, og knappene skjules i appen —
vi later aldri som om en melding gikk ut:

- **SMS til kunde** krever `SMS_LEVERANDOR` og innlogging hos leverandøren.
  Sveve er implementert; LINK Mobility har en plass klar i
  `src/lib/sms/client.ts`.
- **«Send lista til daglig leder»** går som e-post gjennom Microsoft Graph,
  med den samme app-registreringen som innloggingen. Krever
  applikasjonstillatelsen `Mail.Send` med administratorsamtykke, pluss
  `GRAPH_AVSENDER` og `BESTILLING_MOTTAKER`.

### Kommandoer

```bash
npm run dev         # utviklingsserver
npm run build       # produksjonsbygg
npm test            # tester (kjørebok-logikken)
npm run typecheck   # TypeScript uten å bygge
npm run db:push     # synk skjema mot databasen
```

## Slik henger det sammen

```
src/
  app/
    (app)/            Montørens del — hjem, timer, prosjekt, biler, kø
    admin/            Ledelsens del — dashboard, CRM, henvendelser, bemanning
    api/timer/        Tar imot timeføringer fra sendekøen
    logg-inn/         Entra ID-innlogging
  auth.ts             Innlogging, roller hentes fra databasen
  auth.config.ts      Edge-trygg del (brukes av proxy.ts)
  proxy.ts            Avviser forespørsler uten innlogging
  db/schema.ts        Tabeller, alle med tenantId
  lib/
    tripletex/        API-klient med session token, og synkjobben
    abax/             API-klient + timeforslag fra kjørebok (rene moduler)
    ahlsell/          Bestillingsdokument, formater og transport
    geo/              Adresse til koordinater, mot Kartverket
    ai/triage.ts      Leverandøruavhengig AI-triagering av henvendelser
    krypto.ts         AES-256-GCM for hemmeligheter i databasen
    crm/frister.ts    Fristsortering for oppfølgingslista (ren, testet)
    uke.ts            Ukeberegning for bemanningsrutenettet (ren, testet)
    sms/              Leverandøruavhengig SMS + telefonnummer og meldingsmaler
    epost/graph.ts    E-post via Microsoft Graph
    offline/ko.ts     Sendekøen i IndexedDB
    bilde.ts          Komprimerer kamerabilder før de forlater telefonen
    tale.ts           Diktering der nettleseren støtter det
    tilgang.ts        Rollesjekker — håndheves her, ikke i UI
    endringslogg.ts   Hvem endret hva, når
```

### Fire valg som er verdt å kjenne til

**Sendekøen skriver lokalt først.** En timeføring lagres i IndexedDB på
telefonen, sendes derfra, og lagres i vår database før den går til
Tripletex. Montøren kan føre timer i en kjeller uten dekning, og vi har
raden selv om Tripletex er nede.

**Hver linje har en klientnøkkel.** Serveren avviser en nøkkel den har sett
før. Uten det ville et gjensendt kall ført de samme timene to ganger — den
klassiske feilen i offline-systemer.

**Tilgang håndheves i spørringen.** En montør får ikke kollegaenes oppdrag
i svaret i det hele tatt; det er ikke skjult i grensesnittet. Se
`synligAnsattId()` i `src/lib/tilgang.ts`.

**`tenantId` ligger på hver rad.** Halland er eneste kunde i dag. Kolonnen
koster ingenting nå, og er forskjellen på uker og måneder den dagen
systemet skal selges videre.

**Prislister og kontrollskjema er data, ikke kode.** De ligger i
`prislinjer` og `skjemamaler`, én rad per avdeling. Ledelsen skal kunne
endre en pris uten at noen bygger appen på nytt, og en ny kunde skal kunne
ha sine egne uten at koden røres.

**En SMS kan ikke angres.** Derfor sender appen aldri automatisk: montøren
ser hele teksten, trykker, og bekrefter. Hver melding har en klientnøkkel,
så et gjensendt kall ikke sender kunden det samme to ganger.

**Bestillinger er bygget for Ahlsell, ikke for e-post.** Ahlsell tilbyr
ikke et REST-API for bestilling — de kjører EDI, PunchOut og prisfiler.
Alle tre trenger de samme opplysningene, så de ligger i datamodellen
allerede: kundenummer, referanse, leveringsadresse, og linjer med
EFO-nummer, antall og enhet. I dag går bestillingen som e-post med en
CSV-utgave under. Når e-handelsavtalen er på plass er det bare
`ahlsellEdi()` i `src/lib/ahlsell/transport.ts` som skal skrives.

**AI-forslag er forslag.** Triageringen skriver til egne `ai_`-kolonner,
atskilt fra det saksbehandleren selv har bestemt, og flytter aldri en
henvendelse videre i pipelinen. Modellnavnet lagres på raden, så et rart
forslag kan spores tilbake.

## Personvern — les før ABAX-funksjonene utvides

Posisjon og kjørebok fra ansattes biler er personopplysninger, og
Datatilsynet har egne regler for GPS i arbeidsbiler.

Formålet i dag er avgrenset til to ting: å foreslå timer montøren selv
bekrefter, og å finne nærmeste ledige bil ved akuttoppdrag. Dataene brukes
ikke til å vurdere den enkeltes arbeidsinnsats, og ingen timer føres uten
at et menneske har trykket «Bruk».

Drøftingen med de ansatte er gjennomført og signert (bekreftet av
ledelsen 3. september 2026). **Utvides bruken senere** — for eksempel til
geo-låst stempling eller oppfølging av den enkelte — må den runden tas på
nytt før funksjonen settes i drift.

## Det som gjenstår før produksjon

- [x] Drøfting og signert dokumentasjon av GPS-bruken med de ansatte
- [ ] Ekte `entraOid` på de ansatte (seed-verdiene er plassholdere)
- [ ] Tillegg gjennom sendekøen; krever nett i dag fordi bildet er for stort
- [ ] Testet sikkerhetskopi av databasen
- [ ] Sette opp synken som planlagt jobb — se under
- [ ] Bekrefte pipeline-trinnene og reklamasjonsstatusene — de er gjettet
      ut fra prototypen og ligger som lister i `src/db/schema.ts`
- [ ] Velge AI-leverandør: Claude er implementert, Pocket AI trenger
      endepunkt, modellnavn og et eksempelsvar

## Kjente forbehold

Endepunktene mot Tripletex og ABAX er skrevet etter offentlig dokumentasjon
og bør verifiseres mot deres testmiljø ved første oppkobling — særlig
feltnavnene i ABAX-svarene (`items`, `location`, `from`/`to`) og hvordan
Tripletex melder fra om låst periode. `erLaastPeriode()` i
`src/lib/tripletex/client.ts` kjenner igjen både norsk og engelsk feiltekst,
men bør bekreftes mot et ekte avslag.

`drizzle-kit` drar inn en eldre `esbuild` med et kjent varsel. Det gjelder
bare utviklingsverktøyet, ikke det som kjører i produksjon —
`npm audit --omit=dev` er ren.

## Synk mot Tripletex

Synken henter prosjekter, aktiviteter og ansatte. Den sletter aldri noe:
et prosjekt som forsvinner fra Tripletex markeres som inaktivt, fordi vi
har timeføringer som peker på det.

Utløses på to måter:

```bash
# Fra admin: en leder trykker «Synk nå» (vanlig innlogging)

# Som planlagt jobb, med SYNK_NOKKEL fra miljøet:
curl -X POST https://<domene>/api/synk \
  -H "Authorization: Bearer $SYNK_NOKKEL"
```

På Vercel settes det opp i `vercel.json` som en cron mot `/api/synk`.
Én gang i timen på virkedager holder — porteføljen endrer seg ikke oftere.

## Bestilling mot Ahlsell

Bestillingsdokumentet i `src/lib/ahlsell/bestilling.ts` er den kanoniske
formen. Det rendres i dag til lesbar tekst og CSV, og sendes som e-post.

For å koble på EDI trengs tre ting fra Ahlsell:

1. E-handelsavtale og vårt kundenummer (`GROSSIST_KUNDENUMMER`).
2. Deres EDI-spesifikasjon — hvilke segmenter og kvalifikatorer
   ORDERS-meldingen skal ha.
3. Endepunkt eller aksesspunkt meldingen skal leveres til.

Da skrives `ahlsellEdi()` i `src/lib/ahlsell/transport.ts`, og
`BESTILLINGSVEI` settes til `ahlsell_edi`. Datamodellen, linjene og
CSV-en er allerede riktige — det er bare transporten som mangler.

## Tillegg i Tripletex

Et tillegg havner på et **underprosjekt** under hovedprosjektet, alltid
merket «Tillegg», med prosjektnummer og adresse i navnet:

```
Tillegg – 1042 Bekkeveien 4, 0596 Oslo    (nummer 1042-T)
```

Underprosjekt er Tripletex' eget begrep for tilleggsarbeid, så det er dit
kontoret går for å fakturere. Det opprettes **ett** underprosjekt per
hovedprosjekt, ikke ett per tillegg — en jobb med seks tillegg skal ikke gi
seks prosjekter å holde styr på.

Bilde og signatur lastes opp til **hovedprosjektets** dokumentarkiv via
`POST /documentArchive/PROJECT/{id}`, med filnavn som sorterer seg selv:

```
2026-09-06-bilde-ekstra-stikkontakt-dobbel.jpg
2026-09-06-signatur-ekstra-stikkontakt-dobbel.png
```

Alternativet er å legge dem på underprosjektet, slik at signaturen ligger
rett ved fakturagrunnlaget. Det er ett argument som endres i
`sendTilleggTilTripletex`.

Overføringen skjer etter at tillegget er lagret hos oss. Feiler den, er
tillegget fortsatt registrert med signatur — montøren får beskjed, og
overføringen kan kjøres på nytt.

## Geokoding

ABAX-timeforslagene sammenligner hvor bilen sto med hvor prosjektet er.
Tripletex gir bare adressen som tekst, så uten koordinater har prosjektene
ingenting å sammenlignes mot.

Synken slår derfor opp adressene mot Kartverkets åpne adresse-API — ingen
nøkkel, ingen kvote, alle offisielle norske adresser. Treffer vi ikke, står
prosjektet uten koordinater: vi gjetter aldri på en posisjon, for et
timeforslag på feil prosjekt er verre enn ingen forslag.

Hver adresse forsøkes én gang, og forsøket noteres uansett utfall, slik at
synken ikke spør om den samme umulige adressen hver time.

## Oppbevaring av bilder

Bilder og signaturer lagres i databasen mens jobben er fersk, og ryddes
bort etter **90 dager** — men bare når Tripletex har bekreftet at de har
fila. Tripletex er arkivet; kopien vår er en arbeidskopi.

Raden blir stående, så appen fortsatt vet at bildet finnes og hvem som tok
det. Bare bytene forsvinner.

Oppryddingen kjøres som del av synken og rapporterer tre tall: hvor mange
som ble ryddet, hvor mye plass det frigjorde, og hvor mange gamle filer som
**ikke** er bekreftet av Tripletex. Det siste tallet er verdt å følge med
på — er det ikke null, har en opplasting feilet i stillhet.

Oppbevaringstiden endres i `STANDARD_OPPBEVARING_DAGER` i
`src/lib/vedlegg/opprydding.ts`.

---

# Sette systemet i drift

Dette må gjøres én gang, av noen med tilgang til Hallands kontoer. Regn med
en til to timer. Rekkefølgen betyr noe — hvert steg bygger på det forrige.

## 1. Database

Opprett en PostgreSQL-database i **EU-region** (Frankfurt eller Stockholm).
Kravet om EU er ikke valgfritt: systemet behandler posisjonsdata om ansatte.

Alternativer som virker rett ut av boksen: Neon, Supabase, Vercel Postgres.
Kopier tilkoblingsstrengen til `DATABASE_URL`.

## 2. Hosting (Netlify)

**Ingenting skal settes i Netlify-grensesnittet.** `netlify.toml` i rota
forteller Netlify at appen ligger i `app/`, hvilken Node-versjon som skal
brukes, og hvor funksjonene er. Koble repoet, så er byggeoppsettet gjort.

Next.js-støtten er innebygd. Ikke installer noen plugin.

Én ting er verdt å vite hvis du skal endre `netlify.toml` senere: når
`base` er satt, tolkes alle andre stier i fila relativt til den. Derfor
står det `publish = ".next"` og ikke `app/.next`.

## 3. Innlogging (Microsoft Entra ID)

I Entra-portalen: **App registrations → New registration**.

- Redirect URI (type *Web*): `https://<domenet-ditt>/api/auth/callback/microsoft-entra-id`
- Under *Certificates & secrets*: lag en client secret
- Under *API permissions*: legg til applikasjonstillatelsen
  `Mail.Send` og gi administratorsamtykke — den brukes til
  bestillingslista til daglig leder

Fyll ut `AUTH_MICROSOFT_ENTRA_ID_ID`, `..._SECRET` og `..._ISSUER`
(issueren er `https://login.microsoftonline.com/<tenant-id>/v2.0`).

## 4. Nøkler

```bash
npx auth secret                 # AUTH_SECRET
openssl rand -base64 32         # KRYPTERINGSNOKKEL
openssl rand -base64 32         # SYNK_NOKKEL
```

`KRYPTERINGSNOKKEL` krypterer Tripletex-tokenene. **Mister dere den, kan
ingen av dem dekrypteres.** Legg den i en passordhvelv, ikke bare i Vercel.

## 5. Tripletex

Consumer token fra API 2.0-registreringen, og en employee token for
integrasjonsbrukeren. Test mot `https://api-test.tripletex.tech/v2` først —
det er samme kode, bare en annen `TRIPLETEX_BASE_URL`.

## 6. Databasen fylles

```bash
npm run db:push     # oppretter tabellene
```

**Ikke** kjør `db:seed` i produksjon — den legger inn testdata med falske
Entra-ID-er. Legg i stedet inn de ekte ansatte, og kjør så synken:

```bash
curl -X POST https://<domene>/api/synk -H "Authorization: Bearer $SYNK_NOKKEL"
```

Den henter prosjekter og aktiviteter fra Tripletex, kobler ansatte på
e-post, og geokoder adressene.

## 7. Synk på plan

Den planlagte funksjonen ligger klar i
`netlify/functions/synk-planlagt.mts` og kjører hver time av seg selv. Den
trenger bare `SYNK_NOKKEL` i miljøet — `URL` setter Netlify selv.

### Om tidsgrensene

Netlify gir planlagte funksjoner 30 sekunder og vanlige funksjoner 26.
Det er kortere enn en full synk kan trenge, så jobben er delt slik at den
holder seg innenfor:

- Den planlagte funksjonen gjør ikke arbeidet selv — den kaller `/api/synk`.
- Geokodingen, som er det eneste steget med mange nettverkskall, tar maks
  ti adresser og stopper uansett etter åtte sekunder.
- Det som ikke rekkes, står igjen til neste time. Synken speiler og sletter
  aldri, så den er trygg å kjøre om igjen.

Ti adresser i timen er 240 i døgnet — langt mer enn en portefølje vokser.

Ser du `gjenstaar` over null i synkrapporten over lengre tid, er det et
etterslep: øk `maksOppslag` i `geokodProsjekter`, eller kjør synken
manuelt noen ganger.

## Rekkefølge for å teste

0. Riktig gren i Netlify → bygget inneholder faktisk appen.
1. Steg 1–4 → appen starter, og du kan logge inn.
2. Steg 5–6 → montøren ser ekte prosjekter og kan føre timer.
3. ABAX-nøkler → bilkart og timeforslag fra kjørebok.
4. SMS og AI → når dere har valgt leverandør.

Punkt 1 og 2 er nok til å prøve systemet med én montør på én ekte jobb.
Resten kan slås på etter hvert — appen skjuler funksjoner som ikke er satt
opp i stedet for å feile.
