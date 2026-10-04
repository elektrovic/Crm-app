import { krevRolle } from "@/lib/tilgang";
import { tellRader } from "@/lib/data/omfang";
import { Kommer } from "../kommer";

export const metadata = { title: "Kalender · Montørappen" };

export default async function Kalender() {
  const okt = await krevRolle("leder");
  const n = await tellRader(okt, ["tildelinger", "prosjekter"]);

  return (
    <Kommer
      tittel="Kalender"
      under="Hvem er hvor, og når — på tvers av avdelingene"
      hensikt={[
        "Uke- og månedsvisning av hvem som er satt opp på hvilket prosjekt",
        "Flytte en tildeling ved å dra den, uten å gå via bemanningstabellen",
        "Se frister fra oppfølging og reklamasjon i samme bilde",
        "Markere fravær og ferie, så bemanningen ikke lover bort folk som ikke er der",
      ]}
      grunnlag={[
        { hva: "tildelinger", antall: n.tildelinger },
        { hva: "prosjekter å fordele", antall: n.prosjekter },
      ]}
      avhenger="Avklaring på om ferie og fravær skal leses fra Microsoft 365 eller føres her."
    />
  );
}
