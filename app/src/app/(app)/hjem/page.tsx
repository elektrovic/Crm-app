import Link from "next/link";
import { krevOkt } from "@/lib/tilgang";
import { dagensSpenn, hentDagensOppdrag } from "@/lib/data/dagen";
import { Etikett, IkonFlis, Kort, Pille, Sidetittel, Tomt } from "@/components/ui";

export const metadata = { title: "Hjem · Montørappen" };

const FLISER = [
  { sti: "/timer", navn: "Før timer", under: "Dagens føring", farge: "var(--bla)", ikon: "T" },
  { sti: "/biler", navn: "Bilkart", under: "Hvor står bilene", farge: "var(--oransje)", ikon: "B" },
  { sti: "/ko", navn: "Sendekø", under: "Status på sending", farge: "var(--lilla)", ikon: "K" },
];

export default async function Hjem() {
  const okt = await krevOkt();
  const oppdrag = await hentDagensOppdrag(okt);
  const spenn = dagensSpenn(oppdrag);

  const fornavn = okt.navn.split(" ")[0] ?? okt.navn;
  const erLeder = okt.rolle !== "montor";

  return (
    <>
      <Sidetittel
        tittel={`Hei, ${fornavn}`}
        under={`${okt.avdeling} · ${new Intl.DateTimeFormat("nb-NO", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date())}`}
      />

      {/* «Min dag» som én slank linje, slik den ble ryddet opp i prototypen */}
      <Link href="/timer" style={{ textDecoration: "none" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            background: "var(--mork)",
            borderRadius: 14,
            padding: "12px 14px",
          }}
        >
          <IkonFlis farge={okt.farge} storrelse={32}>
            {okt.initialer}
          </IkonFlis>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff" }}>
              {oppdrag.length === 1 ? "1 jobb" : `${oppdrag.length} jobber`}
              {spenn && <span style={{ color: "var(--mork-dempet)" }}> · {spenn}</span>}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--mork-dempet)" }}>
              {erLeder ? "Hele avdelingen" : "Tildelt deg"}
            </div>
          </div>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>Start ›</span>
        </div>
      </Link>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "0 4px",
          }}
        >
          <Etikett>{erLeder ? "Oppdrag i dag" : "Dine oppdrag i dag"}</Etikett>
          <span style={{ fontSize: 12, color: "var(--svak)" }}>{oppdrag.length}</span>
        </div>

        {oppdrag.length === 0 ? (
          <Tomt tekst="Ingen jobber satt opp på deg i dag. Du kan fortsatt føre timer på et prosjekt du har vært innom." />
        ) : (
          oppdrag.map((o) => (
            <Link key={o.tildelingId} href={`/prosjekt/${o.nummer}`} style={{ textDecoration: "none" }}>
              <Kort style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 4,
                      alignSelf: "stretch",
                      borderRadius: 999,
                      background: o.farge,
                      flex: "none",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11.5,
                          color: "var(--svak)",
                        }}
                      >
                        {o.nummer}
                      </span>
                      {o.fraKl && (
                        <span style={{ fontSize: 11.5, color: "var(--dempet)" }}>
                          {o.fraKl}–{o.tilKl}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: "var(--tekst)",
                        letterSpacing: "-.01em",
                        marginTop: 2,
                      }}
                    >
                      {o.navn}
                    </div>
                    {o.adresse && (
                      <div style={{ fontSize: 12.5, color: "var(--dempet)", marginTop: 2 }}>
                        {o.adresse}
                      </div>
                    )}
                  </div>
                </div>
              </Kort>
            </Link>
          ))
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Etikett style={{ padding: "0 4px" }}>Snarveier</Etikett>
        {FLISER.map((f) => (
          <Link key={f.sti} href={f.sti} style={{ textDecoration: "none" }}>
            <Kort style={{ padding: "13px 15px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <IkonFlis farge={f.farge}>{f.ikon}</IkonFlis>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tekst)" }}>
                    {f.navn}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--dempet)" }}>{f.under}</div>
                </div>
                <span style={{ color: "var(--svak)", fontSize: 17 }} aria-hidden="true">
                  ›
                </span>
              </div>
            </Kort>
          </Link>
        ))}
      </div>

      {erLeder && (
        <Kort style={{ background: "var(--bla-svak)", boxShadow: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Pille farge="bla">{okt.rolle === "admin" ? "Admin" : "Leder"}</Pille>
            <span style={{ fontSize: 12.5, color: "var(--tekst-2)" }}>
              Du ser hele {okt.avdeling.toLowerCase()}. Montører ser bare sine egne.
            </span>
          </div>
        </Kort>
      )}
    </>
  );
}
