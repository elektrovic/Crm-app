import { krevRolle } from "@/lib/tilgang";
import { tellRader } from "@/lib/data/omfang";
import { Kommer } from "../kommer";

export const metadata = { title: "Brukere og roller · Montørappen" };

export default async function Brukere() {
  const okt = await krevRolle("leder");
  const n = await tellRader(okt, ["ansatte", "endringslogg"]);

  return (
    <Kommer
      tittel="Brukere og roller"
      under="Hvem har tilgang til hva, og hva de har gjort"
      hensikt={[
        "Legge til og deaktivere ansatte, og sette rolle og avdeling",
        "Koble en ansatt til Entra-kontoen, Tripletex-ID-en og ABAX-bilen",
        "Lese endringsloggen: hvem endret hva, når, og fra hvilken IP",
        "Se hvem som ikke har logget inn på lenge",
      ]}
      grunnlag={[
        { hva: "ansatte", antall: n.ansatte },
        { hva: "rader i endringsloggen", antall: n.endringslogg },
      ]}
      avhenger="Entra ID må settes opp før roller kan styres mot ekte kontoer."
    />
  );
}
