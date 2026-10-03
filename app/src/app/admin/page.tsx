import Link from "next/link";
import { krevRolle } from "@/lib/tilgang";
import {
  hentAvdelingssalg,
  hentNokkeltall,
  hentSendeko,
  hentTimerPerProsjekt,
} from "@/lib/data/dashboard";
import { hentDashboardtall, hentOppfolginger } from "@/lib/data/crm";
import { iDag } from "@/lib/data/dagen";
import { sorterOppfolginger, tellFrister } from "@/lib/crm/frister";
import { Etikett, Kort, Pille, Sidetittel, Tomt } from "@/components/ui";
import { Nokkeltallskort } from "./nokkeltallskort";

export const metadata = { title: "Dashboard · Montørappen" };

const NOK = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

const AVDELINGSFARGE: Record<string, string> = {
  Elektro: "#2563EB",
  "Lås og sikkerhet": "#6366F1",
  Eiendomspleie: "#22C55E",
};

export default async function Dashboard() {
  const okt = await krevRolle("leder");
  const dato = iDag();

  const [tall, sendeko, avdSalg, prosjekttimer, crmTall, oppfolginger] = await Promise.all([
    hentNokkeltall(okt, dato),
    hentSendeko(okt, 6),
    hentAvdelingssalg(okt, dato),
    hentTimerPerProsjekt(okt, dato),
    hentDashboardtall(okt),
    hentOppfolginger(okt),
  ]);

  const frister = tellFrister(sorterOppfolginger(oppfolginger, dato));
  const mestTimer = Math.max(1, ...prosjekttimer.map((p) => p.timer));

  return (
    <>
      <Sidetittel
        tittel="Dashboard – Ledelse"
        under="Oversikt over avdelingene og status mot Tripletex"
      />

      <div
        style={{
          display: "grid",
          // 160px, ikke 190: med 190 fikk det plass til fem kort på en
          // 1440-skjerm, og det sjette ble stående alene på rad to.
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
        }}
      >
        <Nokkeltallskort
          tegn="T"
          farge="#2563EB"
          tittel="Timer ført"
          under="Denne uka, alle avdelinger"
          tall={NOK.format(tall.timerDenneUka)}
        />
        <Nokkeltallskort
          tegn="+"
          farge="#F97316"
          tittel="Tilleggssalg"
          under="Denne måneden, eks. mva"
          tall={NOK.format(tall.tilleggssalgDenneManeden)}
        />
        <Nokkeltallskort
          tegn="%"
          farge="#A855F7"
          tittel="Jobber med tillegg"
          under="Andel av jobber det er ført timer på"
          tall={tall.andelJobberMedTillegg === null ? null : `${tall.andelJobberMedTillegg} %`}
        />
        <Nokkeltallskort
          tegn="◆"
          farge="#22C55E"
          tittel="Dekningsgrad"
          under="Krever kostpris fra Tripletex"
          tall={tall.dekningsgrad === null ? null : `${tall.dekningsgrad} %`}
        />
        <Nokkeltallskort
          tegn="↑"
          farge="#6366F1"
          tittel="I sendekø"
          under="Venter på Tripletex"
          tall={NOK.format(tall.iKo)}
        />
        <Nokkeltallskort
          tegn="!"
          farge="#F43F5E"
          tittel="Feilet"
          under="Krever handling nå"
          tall={NOK.format(tall.feilet)}
          framhev={tall.feilet > 0}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        <Kort style={{ padding: 22 }}>
          <div style={{ fontSize: 16.5, fontWeight: 700 }}>Sendekø mot Tripletex</div>
          <div style={{ fontSize: 13, color: "var(--svak)", marginTop: 3 }}>
            Ingenting blir liggende usett
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
            {sendeko.length === 0 ? (
              <Tomt tekst="Ingenting i kø. Alt er sendt." />
            ) : (
              sendeko.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "var(--flate)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {r.tekst}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--svak)",
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {r.meta}
                    </div>
                  </div>
                  <Pille
                    farge={
                      r.status === "feilet" ? "rod" : r.status === "i_ko" ? "oransje" : "gronn"
                    }
                  >
                    {r.status === "feilet" ? "Feilet" : r.status === "i_ko" ? "I kø" : "Sendt"}
                  </Pille>
                </div>
              ))
            )}
          </div>
        </Kort>

        <Kort style={{ padding: 22 }}>
          <div style={{ fontSize: 16.5, fontWeight: 700 }}>Timer per prosjekt</div>
          <div style={{ fontSize: 13, color: "var(--svak)", marginTop: 3 }}>
            Denne uka. Dekningsgrad kommer når Tripletex-synken henter kostpris.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 15, marginTop: 20 }}>
            {prosjekttimer.length === 0 ? (
              <Tomt tekst="Ingen timer ført denne uka." />
            ) : (
              prosjekttimer.map((p) => (
                <div key={p.nummer}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "baseline",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.nummer} {p.navn}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        flex: "none",
                        letterSpacing: "-.02em",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {NOK.format(p.timer)} t
                    </div>
                  </div>
                  <div
                    style={{
                      height: 7,
                      borderRadius: 4,
                      background: "var(--strek)",
                      marginTop: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 4,
                        background: "#2563EB",
                        width: `${Math.round((p.timer / mestTimer) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Kort>

        <Kort style={{ padding: 22 }}>
          <div style={{ fontSize: 16.5, fontWeight: 700 }}>Tilleggssalg per avdeling</div>
          <div style={{ fontSize: 13, color: "var(--svak)", marginTop: 3 }}>
            Denne måneden, eks. mva
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 20 }}>
            {avdSalg.length === 0 ? (
              <Tomt tekst="Ingen tillegg ført denne måneden." />
            ) : (
              avdSalg.map((a) => (
                <div
                  key={a.avdeling}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 13,
                    padding: "13px 14px",
                    borderRadius: 12,
                    background: "var(--flate)",
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      flex: "none",
                      background: AVDELINGSFARGE[a.avdeling] ?? "#6366F1",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    {a.avdeling.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {a.avdeling}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--svak)", marginTop: 1 }}>
                      {a.antallProsjekter} {a.antallProsjekter === 1 ? "prosjekt" : "prosjekter"}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      flex: "none",
                      letterSpacing: "-.02em",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {NOK.format(a.belop)} kr
                  </div>
                </div>
              ))
            )}
          </div>
        </Kort>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <Etikett>
            Nærmeste frister
            {frister.overFrist > 0 ? ` · ${frister.overFrist} over frist` : ""}
            {crmTall.ufordelte > 0 ? ` · ${crmTall.ufordelte} ufordelt` : ""}
          </Etikett>
          <Link href="/admin/crm" style={{ fontSize: 12.5, fontWeight: 700 }}>
            Se alle
          </Link>
        </div>

        {oppfolginger.length === 0 ? (
          <Tomt tekst="Ingen åpne oppfølginger. Alt er ajour." />
        ) : (
          sorterOppfolginger(oppfolginger, dato)
            .slice(0, 6)
            .map((o) => (
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
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{o.hva}</div>
                    <div style={{ fontSize: 12, color: "var(--dempet)", marginTop: 2 }}>
                      {o.kundeNavn ?? "Uten kunde"} · {o.ansvarligNavn ?? "Ufordelt"}
                    </div>
                  </div>
                  <Pille
                    farge={
                      o.klasse === "over_frist"
                        ? "rod"
                        : o.klasse === "i_dag"
                          ? "oransje"
                          : "noytral"
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
