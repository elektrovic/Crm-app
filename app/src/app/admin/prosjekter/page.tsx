import { krevRolle } from "@/lib/tilgang";
import { tellRader } from "@/lib/data/omfang";
import { Kommer } from "../kommer";

export const metadata = { title: "Prosjekter · Montørappen" };

export default async function Prosjekter() {
  const okt = await krevRolle("leder");
  const n = await tellRader(okt, ["prosjekter", "mangler", "adkomst", "vedlegg"]);

  return (
    <Kommer
      tittel="Prosjekter"
      under="Alle jobber på tvers av avdelingene, med status og framdrift"
      hensikt={[
        "Liste over alle prosjekter med avdeling, kunde og status",
        "Åpne ett prosjekt og se mangler, adkomst, vedlegg og førte timer samlet",
        "Opprette prosjekt, og la synken holde nummeret i takt med Tripletex",
        "Se hvilke prosjekter som ikke har fått ført timer på en uke",
      ]}
      grunnlag={[
        { hva: "prosjekter", antall: n.prosjekter },
        { hva: "mangler", antall: n.mangler },
        { hva: "adkomstnotater", antall: n.adkomst },
        { hva: "vedlegg", antall: n.vedlegg },
      ]}
    />
  );
}
