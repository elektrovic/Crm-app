import { krevRolle } from "@/lib/tilgang";
import { iDag } from "@/lib/data/dagen";
import { hentProsjektkort } from "@/lib/data/prosjekter";
import { hentMontorvalg } from "@/lib/data/kalender";
import { AVDELINGER } from "@/db/schema";
import { Sidetittel, Tomt } from "@/components/ui";
import { SynkNa } from "./synk-na";
import { Prosjektkort } from "./prosjektkort";

export const metadata = { title: "Prosjekter · Montørappen" };

export default async function Prosjekter() {
  const okt = await krevRolle("leder");
  const idag = iDag();

  const [kort, montorer] = await Promise.all([
    hentProsjektkort(okt, idag),
    hentMontorvalg(okt),
  ]);

  // En leder ser sin egen avdeling, en admin ser alt — samme regel som
  // kalenderen. Ellers ville en leder kunne sette opp folk på et prosjekt
  // hen ikke får se i uka si etterpå.
  const synlige = okt.rolle === "admin" ? kort : kort.filter((p) => p.avdeling === okt.avdeling);
  const valgbare =
    okt.rolle === "admin" ? montorer : montorer.filter((m) => m.avdeling === okt.avdeling);

  return (
    <>
      <Sidetittel
        tittel="Prosjekter"
        under="Åpne prosjekter fra Tripletex. Avsluttede faller ut av seg selv."
      />

      <SynkNa />

      {synlige.length === 0 ? (
        <Tomt tekst="Ingen åpne prosjekter. Kjør en synk, eller sjekk at avdelingen er satt riktig." />
      ) : (
        <Prosjektkort
          kort={synlige}
          montorer={valgbare.map((m) => ({ id: m.id, navn: m.navn, avdeling: m.avdeling }))}
          avdelinger={AVDELINGER}
          idag={idag}
          kanEndreAvdeling
        />
      )}
    </>
  );
}
