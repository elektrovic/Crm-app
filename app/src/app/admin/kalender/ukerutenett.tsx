import Link from "next/link";
import type { Kalenderjobb } from "@/lib/data/kalender";
import { IkonFlis } from "@/components/ui";

/**
 * Uka som rutenett: én kolonne per dag, én rad per montør.
 *
 * Fargen er montørens egen, slik den ble bestilt. Da ser man hvem som er
 * hvor ved å se på farger, ikke ved å lese navn i hver celle.
 *
 * På telefon ruller rutenettet sideveis i sin egen kasse. Det er bevisst:
 * en uke med sju dager blir ikke lesbar om den presses inn på 390px, og
 * en leder som er ute sjekker som regel én dag, ikke hele uka.
 */
const DAGNAVN = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

export type Montorrad = { id: string; navn: string; initialer: string; farge: string };

export function Ukerutenett({
  mandag,
  montorer,
  jobber,
}: {
  mandag: string;
  montorer: Montorrad[];
  jobber: Kalenderjobb[];
}) {
  const dager = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${mandag}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const idag = new Date().toISOString().slice(0, 10);

  // Montører uten en eneste jobb denne uka vises likevel. Den tomme raden
  // er informasjonen: det er den lederen ser etter.
  return (
    <div
      style={{
        overflowX: "auto",
        background: "var(--kort)",
        borderRadius: "var(--r-kort)",
        boxShadow: "var(--skygge)",
      }}
    >
      {/* tableLayout: fixed — uten den vokser cellen med den lengste
          prosjekttittelen, og siste kolonne blir dyttet utenfor kortet i
          stedet for at teksten forkortes. */}
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          minWidth: 880,
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "12px 14px",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--svak)",
                borderBottom: "1px solid var(--linje)",
                position: "sticky",
                left: 0,
                background: "var(--kort)",
                minWidth: 132,
              }}
            >
              Montør
            </th>
            {dager.map((d, i) => (
              <th
                key={d}
                style={{
                  padding: "10px 10px",
                  textAlign: "left",
                  borderBottom: "1px solid var(--linje)",
                  borderLeft: "1px solid var(--linje)",
                  minWidth: 132,
                  background: d === idag ? "var(--flate)" : undefined,
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--tekst)" }}>
                  {DAGNAVN[i]}
                </div>
                <div style={{ fontSize: 11, color: "var(--dempet)" }}>
                  {d.slice(8)}.{d.slice(5, 7)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {montorer.map((m) => (
            <tr key={m.id}>
              <td
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--linje)",
                  position: "sticky",
                  left: 0,
                  background: "var(--kort)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IkonFlis farge={m.farge} storrelse={26}>
                    {m.initialer}
                  </IkonFlis>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m.navn}</span>
                </div>
              </td>
              {dager.map((d) => {
                const celle = jobber.filter((j) => j.ansattId === m.id && j.dato === d);
                return (
                  <td
                    key={d}
                    style={{
                      padding: 6,
                      verticalAlign: "top",
                      borderBottom: "1px solid var(--linje)",
                      borderLeft: "1px solid var(--linje)",
                      background: d === idag ? "var(--flate)" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {celle.map((j) => (
                        <Jobbrute key={j.tildelingId} jobb={j} />
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Jobbrute({ jobb }: { jobb: Kalenderjobb }) {
  const klokke =
    jobb.fraKl && jobb.tilKl ? `${jobb.fraKl}–${jobb.tilKl}` : (jobb.fraKl ?? "Hele dagen");
  const pakkeStatus =
    jobb.antallMedbring === 0
      ? null
      : `${jobb.antallPakket}/${jobb.antallMedbring} pakket`;

  return (
    <Link
      href={`/admin/kalender/${jobb.tildelingId}`}
      style={{
        display: "block",
        minWidth: 0,
        textDecoration: "none",
        borderRadius: 9,
        padding: "7px 8px",
        // Montørens farge som venstrekant, ikke som flate: teksten må
        // være lesbar uansett hvilken farge den ansatte har.
        borderLeft: `3px solid ${jobb.farge}`,
        background: "var(--flate)",
      }}
    >
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: "var(--tekst)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {jobb.nummer} {jobb.navn}
      </div>
      <div style={{ fontSize: 10.5, color: "var(--dempet)" }}>{klokke}</div>
      {pakkeStatus && (
        <div
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: jobb.antallPakket === jobb.antallMedbring ? "var(--gronn)" : "var(--oransje)",
          }}
        >
          {pakkeStatus}
        </div>
      )}
      {jobb.kolleger.length > 0 && (
        <div style={{ fontSize: 10, color: "var(--svak)" }}>
          med {jobb.kolleger.map((k) => k.initialer).join(", ")}
        </div>
      )}
    </Link>
  );
}
