import { krevRolle } from "@/lib/tilgang";
import { tellRader } from "@/lib/data/omfang";
import { Kommer } from "../kommer";

export const metadata = { title: "Kontrollskjemaer · Montørappen" };

export default async function Kontrollskjemaer() {
  const okt = await krevRolle("leder");
  const n = await tellRader(okt, ["skjemamaler", "skjemasvar"]);

  return (
    <Kommer
      tittel="Kontrollskjemaer"
      under="Sluttkontroll, egenkontroll og SJA — maler og utfylte skjema"
      hensikt={[
        "Se hvilke skjema som er fylt ut, av hvem, og på hvilket prosjekt",
        "Finne jobber som mangler sluttkontroll før de faktureres",
        "Endre malene uten at gamle, signerte svar endrer seg",
        "Hente ut et utfylt skjema som PDF til kunde eller tilsyn",
      ]}
      grunnlag={[
        { hva: "maler", antall: n.skjemamaler },
        { hva: "utfylte skjema", antall: n.skjemasvar },
      ]}
    />
  );
}
