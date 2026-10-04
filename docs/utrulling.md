# Utrulling: push ofte, bygg sjelden

Hvert Netlify-bygg koster kreditter. Den 4. oktober 2026 gikk 20 bygg på én
dag — rundt 495 av 3 000 kreditter, altså omtrent **25 kreditter per bygg**.
I det tempoet varer en månedskvote under en uke.

Koden må likevel pushes ofte. Et repo der endringer samler seg lokalt er et
repo som mister arbeid når en container forsvinner.

Derfor: **push alltid, bygg bare når noen skal se resultatet.**

## Regelen

Hver commit får `[skip netlify]` i meldinga. Da pushes koden, men ingen bygg
starter. Ved flere commits i samme push er det den siste som avgjør.

```
git commit -m "Rett feltnavn i synken

[skip netlify]"
```

Når noe faktisk skal ut, kjør:

```
bin/rull-ut.sh "Hva som rulles ut"
```

Den lager én tom commit uten merkelappen, og det er den som starter bygget.
Alt som er pushet siden sist blir med i samme bygg.

## Hva som erstatter byggene

Et Netlify-bygg er ikke måten å finne ut om noe virker. Lokalt:

```
npm test                  # enhetstestene
npx tsc --noEmit          # typene
npm run build             # at det kompilerer
PORT=3000 npm run start   # produksjonsbygget, ikke npm run dev
```

Den siste er viktig. Flere feil i dette prosjektet har bare vist seg i
produksjonsbygget — og én viste seg bare i utviklingsmodus, fordi
produksjon minifiserer feilmeldingen. Begge er verdt en kjøring før
utrulling, og ingen av dem koster en kreditt.

## Når det likevel må bygges

- Når du skal teste noe selv
- Når en migrering må kjøres i produksjon (den kjører i byggesteget)
- Når en miljøvariabel er endret — de leses først ved neste bygg

De to siste er lette å glemme, og begge gir en app som ser riktig ut og
oppfører seg galt.
