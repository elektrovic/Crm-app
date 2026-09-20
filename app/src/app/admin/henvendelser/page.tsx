import { krevRolle } from "@/lib/tilgang";
import { hentHenvendelser } from "@/lib/data/crm";
import { triageErSattOpp } from "@/lib/ai/triage";
import { Sidetittel } from "@/components/ui";
import { HenvendelserSkjerm } from "./henvendelser-skjerm";

export const metadata = { title: "Henvendelser · Montørappen" };

export default async function Henvendelser() {
  const okt = await krevRolle("leder");
  const rader = await hentHenvendelser(okt);

  return (
    <>
      <Sidetittel
        tittel="Henvendelser"
        under="Telefon, e-post og nettskjema i én liste"
      />
      <HenvendelserSkjerm
        henvendelser={rader.map((h) => ({
          ...h,
          mottatt: h.mottatt.toISOString(),
          aiVurdert: h.aiVurdert?.toISOString() ?? null,
        }))}
        kanTriagere={triageErSattOpp()}
      />
    </>
  );
}
