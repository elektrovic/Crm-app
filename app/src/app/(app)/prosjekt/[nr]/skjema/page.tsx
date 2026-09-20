import { notFound } from "next/navigation";
import { krevOkt } from "@/lib/tilgang";
import { hentProsjekt, hentSkjemamal } from "@/lib/data/prosjekt";
import { Kort, Sidetittel } from "@/components/ui";
import { SkjemaSkjerm } from "./skjema-skjerm";

export async function generateMetadata({ params }: { params: Promise<{ nr: string }> }) {
  const { nr } = await params;
  return { title: `Kontrollskjema · ${nr} · Montørappen` };
}

export default async function Skjema({ params }: { params: Promise<{ nr: string }> }) {
  const okt = await krevOkt();
  const { nr } = await params;

  const prosjekt = await hentProsjekt(okt, nr);
  if (!prosjekt) notFound();

  const mal = await hentSkjemamal(okt);

  if (!mal) {
    return (
      <>
        <Sidetittel tittel="Kontrollskjema" under={`${prosjekt.nummer} · ${prosjekt.navn}`} />
        <Kort>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--dempet)", lineHeight: 1.55 }}>
            Det er ikke lagt inn noe kontrollskjema for {okt.avdeling} ennå.
            Kontoret legger det inn under Admin.
          </p>
        </Kort>
      </>
    );
  }

  return (
    <SkjemaSkjerm
      prosjektId={prosjekt.id}
      prosjektNummer={prosjekt.nummer}
      prosjektNavn={prosjekt.navn}
      skjemaNavn={mal.navn}
      sporsmal={mal.sporsmal}
      beskrivelseLedetekst={mal.beskrivelseLedetekst}
    />
  );
}
