import { notFound } from "next/navigation";
import { krevOkt } from "@/lib/tilgang";
import { hentPrisliste, hentProsjekt } from "@/lib/data/prosjekt";
import { TilleggSkjerm } from "./tillegg-skjerm";

export async function generateMetadata({ params }: { params: Promise<{ nr: string }> }) {
  const { nr } = await params;
  return { title: `Tillegg · ${nr} · Montørappen` };
}

export default async function Tillegg({ params }: { params: Promise<{ nr: string }> }) {
  const okt = await krevOkt();
  const { nr } = await params;

  const prosjekt = await hentProsjekt(okt, nr);
  if (!prosjekt) notFound();

  const prisliste = await hentPrisliste(okt);

  return (
    <TilleggSkjerm
      prosjektId={prosjekt.id}
      prosjektNummer={prosjekt.nummer}
      prosjektNavn={prosjekt.navn}
      prisliste={prisliste}
      avdeling={okt.avdeling}
    />
  );
}
