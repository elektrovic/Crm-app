import { krevRolle } from "@/lib/tilgang";
import { tellRader } from "@/lib/data/omfang";
import { Kommer } from "../kommer";

export const metadata = { title: "Timer · Montørappen" };

export default async function Timer() {
  const okt = await krevRolle("leder");
  const n = await tellRader(okt, ["timeforinger", "aktiviteter"]);

  return (
    <Kommer
      tittel="Timer"
      under="Alle førte timer, og hva som har kommet fram til Tripletex"
      hensikt={[
        "Se timer per ansatt, per prosjekt og per uke",
        "Godkjenne før sending, og se hvem som ikke har ført",
        "Sende om igjen det som feilet, uten å føre på nytt",
        "Skille fakturerbart fra internt, slik aktiviteten sier",
      ]}
      grunnlag={[
        { hva: "timeføringer", antall: n.timeforinger },
        { hva: "aktiviteter fra Tripletex", antall: n.aktiviteter },
      ]}
      avhenger="Tripletex-tokener for å kunne sende og lese tilbake."
    />
  );
}
