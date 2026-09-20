import { notFound } from "next/navigation";
import { krevOkt } from "@/lib/tilgang";
import { hentMangler, hentProsjekt } from "@/lib/data/prosjekt";
import { bestillingKanSendes } from "@/lib/ahlsell/transport";
import { ManglerSkjerm } from "./mangler-skjerm";

export async function generateMetadata({ params }: { params: Promise<{ nr: string }> }) {
  const { nr } = await params;
  return { title: `Mangler · ${nr} · Montørappen` };
}

export default async function Mangler({ params }: { params: Promise<{ nr: string }> }) {
  const okt = await krevOkt();
  const { nr } = await params;

  const prosjekt = await hentProsjekt(okt, nr);
  if (!prosjekt) notFound();

  const linjer = await hentMangler(okt, prosjekt.id);

  return (
    <ManglerSkjerm
      prosjektId={prosjekt.id}
      prosjektNummer={prosjekt.nummer}
      prosjektNavn={prosjekt.navn}
      linjer={linjer.map((l) => ({
        ...l,
        opprettet: l.opprettet.toISOString(),
      }))}
      kanSendeBestilling={bestillingKanSendes()}
    />
  );
}
