# To utgaver av Montørappen — og hvorfor dette lageret finnes

Det ble bygget **to komplette, uavhengige utgaver** av samme produkt, av hver
sin økt, i lageret `elektrovic/CRM-SYSTEM-`. Dette lageret inneholder den ene
av dem. Dokumentet her sier hva forskjellen er, og hva som fortsatt er verdt
å hente fra den andre.

## Hvor de to ligger

| | Denne utgaven | Den andre utgaven |
|---|---|---|
| Lager | `elektrovic/Crm-app` (her) | `elektrovic/CRM-SYSTEM-` |
| Gren | `main` | `main` og `montorappen-pin-variant` |
| Mappestruktur | `app/src/app/...` | `app/(felt)/...` på rota |
| Innlogging | Microsoft Entra ID | E-post + PIN (scrypt) |
| Database | Postgres med Drizzle | Supabase |
| ABAX | ja | **nei** |
| SMS til kunde | ja | **nei** |
| Ahlsell-bestilling | ja | **nei** |
| Kobbr | fjernet | **fortsatt inne** |
| Tillegg til Tripletex | underprosjekt merket «Tillegg» | bare lokalt |
| Bilder til Tripletex | automatisk som vedlegg | til Supabase-fillager |

Denne utgaven er den som følger avgjørelsene som faktisk er tatt: Microsoft
365 er i bruk, ABAX er viktig, Kobbr er ute, Ahlsell skal med, tillegg skal
til Tripletex og bilder skal inn som vedlegg.

## Ingenting er slettet

Den andre utgaven ligger urørt i `elektrovic/CRM-SYSTEM-`, både på `main` og
på grenen `montorappen-pin-variant`. Den kan hentes fram når som helst.

## Det som er verdt å hente over

Den andre utgaven har fire ting vi ikke har, og som er reelle mangler:

1. **PDF av kontrollskjema.** Vi lagrer svarene, men lager ikke dokumentet
   kunden skal ha. Hos dem ligger det i `lib/pdf/`.
2. **Toppliste.** Rangering av montørene på registrerte timer.
3. **Kalender og planlegging.** Vi har bemanning per uke; de har en
   kalenderflate og en egen planleggingsside for ledelsen.
4. **Prislisteadministrasjon.** Vi har prislinjer i databasen og seed-data,
   men ingen skjerm der ledelsen vedlikeholder dem selv.

I tillegg er **PIN-innlogging** verdt å vurdere som reserveløsning for
montører som ikke har egen Microsoft-konto.

Hent én av gangen fra det andre lageret:

```bash
git clone https://github.com/elektrovic/CRM-SYSTEM- /tmp/gammel
cp -r /tmp/gammel/lib/pdf app/src/lib/pdf
```

Koden må skrives om til vår mappestruktur og vårt datalag. Den er ikke
kompatibel som den står.
