import { krevRolle } from "@/lib/tilgang";
import { tellRader } from "@/lib/data/omfang";
import { Kommer } from "../kommer";

export const metadata = { title: "Tilleggssalg · Montørappen" };

export default async function Tilleggssalg() {
  const okt = await krevRolle("leder");
  const n = await tellRader(okt, ["tillegg", "prislinjer"]);

  return (
    <Kommer
      tittel="Tilleggssalg"
      under="Alt montørene har solgt ute, og hva som er fakturert"
      hensikt={[
        "Liste over registrerte tillegg med prosjekt, montør og beløp",
        "Følge sendekøen mot Tripletex og rette det som feilet",
        "Se hvem som selger, og på hvilke typer jobber",
        "Sammenligne mot prislista, så ingenting selges til feil pris",
      ]}
      grunnlag={[
        { hva: "registrerte tillegg", antall: n.tillegg },
        { hva: "linjer i prislista", antall: n.prislinjer },
      ]}
    />
  );
}
