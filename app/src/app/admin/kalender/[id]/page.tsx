import Link from "next/link";
import { notFound } from "next/navigation";
import { krevRolle } from "@/lib/tilgang";
import { hentJobb, hentPlanleggingsgrunnlag } from "@/lib/data/kalender";
import { Jobbkort } from "@/components/jobbkort";
import { Planlegging } from "../planlegging";

export const metadata = { title: "Jobb · Montørappen" };

export default async function AdminJobb({ params }: { params: Promise<{ id: string }> }) {
  const okt = await krevRolle("leder");
  const { id } = await params;

  const jobb = await hentJobb(okt, id);
  if (!jobb) notFound();

  const grunnlag = await hentPlanleggingsgrunnlag(okt, jobb.prosjektId);

  // Mangler som alt står på pakkelista skal ikke kunne legges til to ganger.
  const alleredeValgt = new Set(
    jobb.medbring.filter((m) => m.fraMangel).map((m) => m.tekst),
  );
  const ledige = (grunnlag?.mangler ?? []).filter((m) => !alleredeValgt.has(m.tekst));

  return (
    <>
      <Link
        href={`/admin/kalender?uke=${jobb.dato}`}
        style={{ fontSize: 13, color: "var(--bla)", textDecoration: "none" }}
      >
        ‹ Tilbake til uka
      </Link>

      <Jobbkort jobb={jobb} kanRedigere kanTaBilde />

      <Planlegging
        tildelingId={jobb.tildelingId}
        ledigeMangler={ledige}
        fraKl={jobb.fraKl}
        tilKl={jobb.tilKl}
        notat={jobb.notat}
      />
    </>
  );
}
