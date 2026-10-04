import Link from "next/link";
import { notFound } from "next/navigation";
import { krevOkt } from "@/lib/tilgang";
import { hentJobb } from "@/lib/data/kalender";
import { Jobbkort } from "@/components/jobbkort";

export const metadata = { title: "Jobb · Montørappen" };

export default async function MinJobb({ params }: { params: Promise<{ id: string }> }) {
  const okt = await krevOkt();
  const { id } = await params;

  // hentJobb avgjør tilgangen selv: en montør får bare sine egne.
  const jobb = await hentJobb(okt, id);
  if (!jobb) notFound();

  return (
    <>
      <Link href="/kalender" style={{ fontSize: 13, color: "var(--bla)", textDecoration: "none" }}>
        ‹ Min uke
      </Link>
      <Jobbkort jobb={jobb} kanRedigere={false} />
    </>
  );
}
