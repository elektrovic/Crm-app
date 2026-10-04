import { krevRolle } from "@/lib/tilgang";
import { tellRader } from "@/lib/data/omfang";
import { Kommer } from "../kommer";

export const metadata = { title: "Avdelinger · Montørappen" };

export default async function Avdelinger() {
  const okt = await krevRolle("leder");
  const n = await tellRader(okt, ["ansatte", "prosjekter", "prislinjer"]);

  return (
    <Kommer
      tittel="Avdelinger"
      under="Elektro, Lås og sikkerhet, Eiendomspleie"
      hensikt={[
        "Se nøkkeltall per avdeling side om side",
        "Styre hvilken aktivitet og prisliste som er standard for hver avdeling",
        "Flytte en ansatt mellom avdelinger uten å miste historikken",
        "Legge til en fjerde avdeling den dagen det blir aktuelt",
      ]}
      grunnlag={[
        { hva: "ansatte fordelt", antall: n.ansatte },
        { hva: "prosjekter", antall: n.prosjekter },
        { hva: "prislinjer", antall: n.prislinjer },
      ]}
    />
  );
}
