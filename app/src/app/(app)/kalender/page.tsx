import Link from "next/link";
import { krevOkt } from "@/lib/tilgang";
import { iDag } from "@/lib/data/dagen";
import { mandagen } from "@/lib/uke";
import { hentMinUke, sondagen } from "@/lib/data/kalender";
import { Etikett, IkonFlis, Kort, Sidetittel, Tomt } from "@/components/ui";

export const metadata = { title: "Min uke · Montørappen" };

function flytt(mandag: string, uker: number): string {
  const d = new Date(`${mandag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + uker * 7);
  return d.toISOString().slice(0, 10);
}

export default async function MinUke({
  searchParams,
}: {
  searchParams: Promise<{ uke?: string }>;
}) {
  const okt = await krevOkt();
  const { uke } = await searchParams;
  const mandag = mandagen(uke && /^\d{4}-\d{2}-\d{2}$/.test(uke) ? uke : iDag());

  const jobber = await hentMinUke(okt, mandag);
  const idag = iDag();

  // Gruppert på dag, så uka leses nedover som en liste og ikke som et bord.
  const dager = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${mandag}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const dato = d.toISOString().slice(0, 10);
    return { dato, jobber: jobber.filter((j) => j.dato === dato) };
  }).filter((d) => d.jobber.length > 0);

  const spenn = (d: string) =>
    new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short" }).format(
      new Date(`${d}T00:00:00Z`),
    );

  return (
    <>
      <Sidetittel
        tittel="Min uke"
        under={`${spenn(mandag)} – ${spenn(sondagen(mandag))}`}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Link href={`/kalender?uke=${flytt(mandag, -1)}`} style={pilstil}>
          ‹ Forrige
        </Link>
        <Link href="/kalender" style={{ ...pilstil, flex: 1, justifyContent: "center" }}>
          Denne uka
        </Link>
        <Link href={`/kalender?uke=${flytt(mandag, 1)}`} style={pilstil}>
          Neste ›
        </Link>
      </div>

      {dager.length === 0 ? (
        <Tomt tekst="Ingen jobber satt opp på deg denne uka." />
      ) : (
        dager.map((d) => (
          <div key={d.dato} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Etikett style={d.dato === idag ? { color: "var(--bla)" } : undefined}>
              {new Intl.DateTimeFormat("nb-NO", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date(`${d.dato}T00:00:00Z`))}
              {d.dato === idag ? " · i dag" : ""}
            </Etikett>

            {d.jobber.map((j) => (
              <Link key={j.tildelingId} href={`/jobb/${j.tildelingId}`} style={{ textDecoration: "none" }}>
                <Kort style={{ borderLeft: `3px solid ${j.farge}` }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tekst)" }}>
                      {j.nummer} {j.navn}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--dempet)" }}>
                      {j.fraKl && j.tilKl ? `${j.fraKl}–${j.tilKl}` : (j.fraKl ?? "Hele dagen")}
                      {j.adresse ? ` · ${j.adresse}` : ""}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      {j.antallMedbring > 0 && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            color:
                              j.antallPakket === j.antallMedbring
                                ? "var(--gronn)"
                                : "var(--oransje)",
                          }}
                        >
                          {j.antallPakket}/{j.antallMedbring} pakket
                        </span>
                      )}
                      {j.kolleger.map((k) => (
                        <span key={k.id} title={k.navn}>
                          <IkonFlis farge={k.farge} storrelse={20}>
                            {k.initialer}
                          </IkonFlis>
                        </span>
                      ))}
                    </div>
                  </div>
                </Kort>
              </Link>
            ))}
          </div>
        ))
      )}
    </>
  );
}

const pilstil = {
  display: "flex",
  alignItems: "center",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid var(--linje)",
  background: "var(--kort)",
  color: "var(--tekst)",
  fontSize: 12.5,
  fontWeight: 600,
  textDecoration: "none",
} as const;
