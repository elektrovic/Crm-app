import Link from "next/link";
import { krevRolle } from "@/lib/tilgang";
import { iDag } from "@/lib/data/dagen";
import { mandagen } from "@/lib/uke";
import { hentMontorvalg, hentProsjektvalg, hentUkeplan, sondagen } from "@/lib/data/kalender";
import { Etikett, Sidetittel, Tomt } from "@/components/ui";
import { Ukerutenett } from "./ukerutenett";
import { NyTildeling } from "./ny-tildeling";

export const metadata = { title: "Kalender · Montørappen" };

/** Mandagen n uker fra en gitt mandag. */
function flytt(mandag: string, uker: number): string {
  const d = new Date(`${mandag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + uker * 7);
  return d.toISOString().slice(0, 10);
}

function ukeTekst(mandag: string): string {
  const f = (d: string) =>
    new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short" }).format(
      new Date(`${d}T00:00:00Z`),
    );
  return `${f(mandag)} – ${f(sondagen(mandag))}`;
}

export default async function Kalender({
  searchParams,
}: {
  searchParams: Promise<{ uke?: string }>;
}) {
  const okt = await krevRolle("leder");
  const { uke } = await searchParams;

  // Ugyldig dato i adressefeltet skal ikke gi en tom uke uten forklaring.
  const utgangspunkt = uke && /^\d{4}-\d{2}-\d{2}$/.test(uke) ? uke : iDag();
  const mandag = mandagen(utgangspunkt);

  const [jobber, montorer, prosjekter] = await Promise.all([
    hentUkeplan(okt, mandag),
    hentMontorvalg(okt),
    hentProsjektvalg(okt),
  ]);

  // En leder ser sin egen avdeling. Da skal ikke montører fra de andre
  // avdelingene fylle rutenettet med tomme rader.
  const synlige =
    okt.rolle === "admin" ? montorer : montorer.filter((m) => m.avdeling === okt.avdeling);

  const uplanlagt = jobber.filter((j) => j.antallMedbring === 0).length;

  return (
    <>
      <Sidetittel
        tittel="Kalender"
        under={
          okt.rolle === "admin"
            ? "Alle avdelinger. Fargen følger montøren."
            : `${okt.avdeling}. Fargen følger montøren.`
        }
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href={`/admin/kalender?uke=${flytt(mandag, -1)}`} style={pilstil}>
            ‹
          </Link>
          <div style={{ minWidth: 148, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{ukeTekst(mandag)}</div>
            <Link
              href="/admin/kalender"
              style={{ fontSize: 11, color: "var(--bla)", textDecoration: "none" }}
            >
              Denne uka
            </Link>
          </div>
          <Link href={`/admin/kalender?uke=${flytt(mandag, 1)}`} style={pilstil}>
            ›
          </Link>
        </div>

        <NyTildeling
          montorer={synlige.map((m) => ({ id: m.id, navn: m.navn, avdeling: m.avdeling }))}
          prosjekter={prosjekter.map((p) => ({
            id: p.id,
            navn: p.navn,
            nummer: p.nummer,
            avdeling: p.avdeling,
          }))}
          standarddato={iDag()}
        />
      </div>

      {synlige.length === 0 ? (
        <Tomt tekst="Ingen aktive montører i denne avdelingen." />
      ) : (
        <Ukerutenett mandag={mandag} montorer={synlige} jobber={jobber} />
      )}

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <Etikett>
          {jobber.length === 1 ? "1 jobb denne uka" : `${jobber.length} jobber denne uka`}
        </Etikett>
        {uplanlagt > 0 && (
          <Etikett style={{ color: "var(--oransje)" }}>
            {uplanlagt === 1
              ? "1 jobb uten pakkeliste"
              : `${uplanlagt} jobber uten pakkeliste`}
          </Etikett>
        )}
      </div>
    </>
  );
}

const pilstil = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  borderRadius: 10,
  border: "1px solid var(--linje)",
  background: "var(--kort)",
  color: "var(--tekst)",
  fontSize: 18,
  textDecoration: "none",
} as const;
