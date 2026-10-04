@AGENTS.md

# Arbeidsregler for Montørappen

Satt av Victor 4. oktober 2026. Disse gjelder foran alt annet.

## Push aldri til main uten å bli bedt om det

Main rulles ut til produksjonen montørene bruker. Den skal bare få nye
commits når Victor skriver **«legg ut»** — ikke når noe er ferdig, ikke
når testene er grønne, ikke når det virker opplagt.

Alt annet arbeid committes lokalt og blir liggende. Spør når noe er
klart til å legges ut; ikke gjør det selv.

Vanlige commits merkes `[skip netlify]` i emnelinja, slik at de ikke
koster et bygg. `bin/rull-ut.sh` lager den ene commiten som bygger.

## Vis endringen før den legges ut

Etter hver ting som bygges: kjør appen og vis fram resultatet. Ikke
beskriv det — vis det.

Containeren Claude kjører i har ingen offentlig adresse, så Victor kan
ikke åpne en localhost her. Derfor er framvisningen skjermbilder fra
produksjonsbygget (`npm run build && npm run start`, Playwright mot
`http://localhost:3000`, `executablePath: "/opt/pw-browsers/chromium"`).
Det koster ingenting. Ta både 1280 px og 390 px.

Victor kan kjøre det samme på sin egen maskin med `bin/lokalt.sh`.

## Test og produksjon deler aldri database

- `main` → produksjonsbasen (Supabase `oezmybcojfjkpifypgvw`)
- `test` → testbasen, rullet ut på
  `https://test--sunny-semolina-02e49d.netlify.app`
- lokalt → Postgres på egen maskin

`app/src/db/vern.ts` nekter å koble til produksjonsbasen når `MILJO`
ikke er `produksjon`. Skru den aldri av for å få noe til å virke — den
feiler fordi noe faktisk peker feil sted.

## Hemmeligheter skrives aldri i chatten

API-nøkler, passord og tokens legges inn av Victor selv i Netlify,
merket «Contains secret values». Be om at det gjøres; ikke be om å få
dem tilsendt, og ikke les dem ut av miljøet i en form som havner i
loggen.

## Spør hva som skal bygges videre

Når en ting er ferdig: still spørsmål. Foreslå det neste, og fjern det
som ikke brukes.
