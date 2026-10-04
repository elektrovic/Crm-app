import { krevRolle } from "@/lib/tilgang";
import { tellRader } from "@/lib/data/omfang";
import { Kommer } from "../kommer";

export const metadata = { title: "Prislister · Montørappen" };

export default async function Prislister() {
  const okt = await krevRolle("leder");
  const n = await tellRader(okt, ["prislinjer", "tillegg"]);

  return (
    <Kommer
      tittel="Prislister"
      under="Prisene montørene selger etter, per avdeling"
      hensikt={[
        "Redigere pris, enhet og rekkefølge per avdeling",
        "Legge til og pensjonere linjer uten å endre det som alt er solgt",
        "Se når en pris sist ble endret, og av hvem",
        "Prisjustere en hel avdeling i én operasjon",
      ]}
      grunnlag={[
        { hva: "prislinjer", antall: n.prislinjer },
        { hva: "salg etter lista", antall: n.tillegg },
      ]}
    />
  );
}
