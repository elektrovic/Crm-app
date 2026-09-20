import Link from "next/link";
import { krevRolle } from "@/lib/tilgang";
import { hentDashboardtall, hentOppfolginger } from "@/lib/data/crm";
import { iDag } from "@/lib/data/dagen";
import { sorterOppfolginger, tellFrister } from "@/lib/crm/frister";
import { Etikett, Kort, Pille, Sidetittel } from "@/components/ui";

export const metadata = { title: "Dashboard · Montørappen" };

export default async function Dashboard() {
  const okt = await krevRolle("leder");
  const tall = await hentDashboardtall(okt);
  const oppfolginger = sorterOppfolginger(await hentOppfolginger(okt), iDag());
  const frister = tellFrister(oppfolginger);

  const fliser = [
    {
      etikett: "Over frist",
      verdi: frister.overFrist,
      farge: frister.overFrist > 0 ? "var(--rod-tekst)" : "var(--tekst)",
      under: "Skulle vært gjort",
      sti: "/admin/crm",
    },
    {
      etikett: "Ufordelt",
      verdi: tall.ufordelte,
      farge: tall.ufordelte > 0 ? "var(--oransje-tekst)" : "var(--tekst)",
      under: "Mangler en eier",
      sti: "/admin/crm",
    },
    {
      etikett: "Nye henvendelser",
      verdi: tall.nyeHenvendelser,
      farge: "var(--tekst)",
      under: "Ikke besvart",
      sti: "/admin/henvendelser",
    },
    {
      etikett: "Åpne reklamasjoner",
      verdi: tall.apneReklamasjoner,
      farge: "var(--tekst)",
      under: "Under behandling",
      sti: "/admin/crm/reklamasjoner",
    },
  ];

  return (
    <>
      <Sidetittel
        tittel="Dashboard"
        under={new Intl.DateTimeFormat("nb-NO", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date())}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12,
        }}
      >
        {fliser.map((f) => (
          <Link key={f.etikett} href={f.sti} style={{ textDecoration: "none" }}>
            <Kort>
              <Etikett>{f.etikett}</Etikett>
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  letterSpacing: "-.03em",
                  color: f.farge,
                  marginTop: 8,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {f.verdi}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--dempet)" }}>{f.under}</div>
            </Kort>
          </Link>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}
        >
          <Etikett>Nærmeste frister</Etikett>
          <Link href="/admin/crm" style={{ fontSize: 12.5, fontWeight: 700 }}>
            Se alle
          </Link>
        </div>

        {oppfolginger.length === 0 ? (
          <Kort>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--dempet)" }}>
              Ingen åpne oppfølginger. Alt er ajour.
            </p>
          </Kort>
        ) : (
          oppfolginger.slice(0, 6).map((o) => (
            <Kort key={o.id} style={{ padding: "13px 16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tekst)" }}>
                    {o.hva}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--dempet)", marginTop: 2 }}>
                    {o.kundeNavn ?? "Uten kunde"} · {o.ansvarligNavn ?? "Ufordelt"}
                  </div>
                </div>
                <Pille
                  farge={
                    o.klasse === "over_frist" ? "rod" : o.klasse === "i_dag" ? "oransje" : "noytral"
                  }
                >
                  {o.tekst}
                </Pille>
              </div>
            </Kort>
          ))
        )}
      </div>
    </>
  );
}
