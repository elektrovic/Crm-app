import { krevRolle } from "@/lib/tilgang";
import { hentCrmNokkeltall } from "@/lib/data/crm";
import { iDag } from "@/lib/data/dagen";
import { Sidetittel } from "@/components/ui";
import { Nokkeltallskort } from "../nokkeltallskort";
import { Fanerad } from "./fanerad";
import { Sokefelt } from "./sokefelt";

const NOK = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

/**
 * CRM-en med de fem underfanene fra prototypen. Fanene ligger i layouten
 * så de ikke rerendres når man bytter mellom dem — og nøkkeltallene står
 * her av samme grunn: de gjelder hele CRM-en, ikke én fane.
 */
export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const okt = await krevRolle("leder");
  const tall = await hentCrmNokkeltall(okt, iDag());

  return (
    <>
      <Sidetittel
        tittel="CRM – kunder og oppfølging"
        under="Henvendelser, reklamasjoner og gjenkjøp. Ingen kunde skal falle mellom to stoler."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
          gap: 16,
        }}
      >
        <Nokkeltallskort
          tegn="✳"
          farge="#2563EB"
          tittel="Nye henvendelser"
          under="Siste 7 dager"
          tall={NOK.format(tall.nyeSyvDager)}
        />
        <Nokkeltallskort
          tegn="!"
          farge="#F43F5E"
          tittel="Ubesvart over 24 t"
          under="Krever handling nå"
          tall={NOK.format(tall.ubesvartOverDognet)}
          framhev={tall.ubesvartOverDognet > 0}
        />
        <Nokkeltallskort
          tegn="⚑"
          farge="#F97316"
          tittel="Åpne reklamasjoner"
          under={
            tall.reklamasjonerOverFrist > 0
              ? `${tall.reklamasjonerOverFrist} over frist`
              : "Ingen over frist"
          }
          tall={NOK.format(tall.apneReklamasjoner)}
          framhev={tall.reklamasjonerOverFrist > 0}
        />
        <Nokkeltallskort
          tegn="≡"
          farge="#A855F7"
          tittel="Tilbud ute"
          under={`${tall.antallTilbud} ute, eks. mva`}
          tall={NOK.format(tall.tilbudUte)}
        />
        <Nokkeltallskort
          tegn="↻"
          farge="#22C55E"
          tittel="Gjenkjøp klare"
          under="Kundeliste klar å ringe"
          tall={NOK.format(tall.gjenkjopKlare)}
        />
      </div>

      <Sokefelt />

      <Fanerad />
      {children}
    </>
  );
}
