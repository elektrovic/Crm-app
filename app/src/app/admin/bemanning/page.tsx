import { krevRolle } from "@/lib/tilgang";
import { hentAnsatte, hentUke, mandagen, ukedager } from "@/lib/data/bemanning";
import { iDag } from "@/lib/data/dagen";
import { Etikett, Kort, Sidetittel } from "@/components/ui";
import { BemanningTabell } from "./bemanning-tabell";

export const metadata = { title: "Bemanning · Montørappen" };

export default async function Bemanning() {
  const okt = await krevRolle("leder");

  const idag = iDag();
  const mandag = mandagen(idag);
  const dager = ukedager(mandag);

  const folk = await hentAnsatte(okt);
  const uke = await hentUke(okt, mandag);

  return (
    <>
      <Sidetittel
        tittel="Bemanning"
        under="Fargekoder, bil i ABAX, og hvem som er satt opp hvor"
      />

      <BemanningTabell
        ansatte={folk}
        kanRedigere={okt.rolle === "admin" || okt.rolle === "leder"}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Etikett>Denne uka</Etikett>

        <div
          style={{
            overflowX: "auto",
            background: "var(--kort)",
            borderRadius: "var(--r-kort)",
            boxShadow: "var(--skygge)",
          }}
        >
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 780 }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 14px 10px",
                    borderBottom: "1px solid var(--linje)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    letterSpacing: ".13em",
                    textTransform: "uppercase",
                    color: "var(--svak)",
                    fontWeight: 500,
                    width: 190,
                  }}
                >
                  Ansatt
                </th>
                {dager.map((d) => (
                  <th
                    key={d.iso}
                    style={{
                      textAlign: "left",
                      padding: "16px 12px 10px",
                      borderBottom: "1px solid var(--linje)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      letterSpacing: ".13em",
                      textTransform: "uppercase",
                      color: d.iso === idag ? "var(--bla)" : "var(--svak)",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.navn} {d.dato}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {folk.map((a) => (
                <tr key={a.id}>
                  <td
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid var(--linje-svak)",
                      verticalAlign: "top",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: a.farge,
                          flex: "none",
                        }}
                      />
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--tekst)" }}>
                        {a.navn}
                      </span>
                    </span>
                  </td>

                  {dager.map((d) => {
                    const jobber = uke.filter((u) => u.ansattId === a.id && u.dato === d.iso);
                    return (
                      <td
                        key={d.iso}
                        style={{
                          padding: "10px 12px",
                          borderBottom: "1px solid var(--linje-svak)",
                          verticalAlign: "top",
                          background: d.iso === idag ? "var(--bla-svak)" : undefined,
                        }}
                      >
                        {jobber.length === 0 ? (
                          <span style={{ fontSize: 12, color: "var(--svak)" }}>—</span>
                        ) : (
                          <span style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {jobber.map((j, i) => (
                              <span
                                key={`${j.prosjektNummer}-${i}`}
                                style={{
                                  display: "block",
                                  borderLeft: `3px solid ${a.farge}`,
                                  paddingLeft: 8,
                                  fontSize: 12,
                                  lineHeight: 1.4,
                                }}
                              >
                                <span style={{ fontWeight: 700, color: "var(--tekst)" }}>
                                  {j.prosjektNummer}
                                </span>
                                {j.fraKl && (
                                  <span style={{ display: "block", color: "var(--svak)" }}>
                                    {j.fraKl}–{j.tilKl}
                                  </span>
                                )}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {folk.length === 0 && (
          <Kort>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--dempet)" }}>
              Ingen aktive ansatte lagt inn ennå.
            </p>
          </Kort>
        )}
      </div>
    </>
  );
}
