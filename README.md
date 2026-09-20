# Montørappen

Internt driftssystem for Halland Gruppen. Timeføring mot Tripletex, bilkart
og kjørebok fra ABAX, prosjektinfo montørene deler seg imellom, og etter
hvert CRM og henvendelser for ledelsen.

Én installerbar web-app (PWA) som virker på både mobil og PC.

## Innhold

| Mappe | Hva det er |
| --- | --- |
| `app/` | Selve applikasjonen. Next.js, TypeScript, PostgreSQL. Se `app/README.md`. |
| `design/` | Den klikkbare prototypen fra Claude Design, som formspråket er hentet fra. |

## Kom i gang

```bash
cd app
npm install
cp .env.example .env      # fyll ut verdiene
npm run db:push
npm run db:seed
npm run dev
```

Full oppskrift, miljøvariabler og arkitektur ligger i
[`app/README.md`](app/README.md).

## Status

Fase 1–6 av seks er bygget:

- Designsystem hentet fra prototypen
- Innlogging med Microsoft Entra ID, roller håndhevet i backend
- Databaseskjema med `tenantId` på hver rad
- Tripletex-klient — timer, prosjekter, aktiviteter, låste perioder
- ABAX-klient og timeforslag fra kjørebok, med tester
- Offline sendekø i IndexedDB
- Skjermene hjem, timer, bilkart og sendekø
- Prosjektkort med adkomstinfo — nøkkelkode, kontakt, parkering
- Mangler-liste med diktering og bestilling til daglig leder
- Tillegg med prisliste, kamerabilde og kundesignatur
- Kontrollskjema, ett spørsmål av gangen, per avdeling
- SMS til kunde før og etter oppdrag, med tester
- Admin-flate med mørk sidemeny og rollesperre
- CRM: oppfølging, pipeline, kunder, reklamasjoner, garanti og gjenkjøp
- Henvendelser fra telefon, e-post og nettskjema i én liste, med AI-triagering
- Bemanning med fargekoder og ukesoversikt
- Synk av prosjekter, aktiviteter og ansatte fra Tripletex
- Kryptering av Tripletex-tokenene i databasen
- Bestillingsmodell med EFO-nummer og CSV, klar for Ahlsell

Gjenstår: transporten mot Ahlsell (EDI eller PunchOut), som venter på
e-handelsavtalen, og salgsklargjøring.

## Om designet

`design/Montørappen.dc.html` er den opprinnelige prototypen. Formspråket
derfra — Plus Jakarta Sans, lys grå flate, hvite kort med lav skygge,
fargede ikonfliser, blå avrundet pille som aktiv markør — ligger som
designtokens i `app/src/app/globals.css`.

Alt nytt som bygges skal arve det derfra, ikke definere egne farger.
