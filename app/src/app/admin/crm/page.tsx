import { krevRolle } from "@/lib/tilgang";
import { hentOppfolginger } from "@/lib/data/crm";
import { iDag } from "@/lib/data/dagen";
import { sorterOppfolginger, tellFrister } from "@/lib/crm/frister";
import { Celle, Etikett, Kort, Pille, Tabell, visDato } from "@/components/ui";

export const metadata = { title: "Oppfølging · CRM" };

/**
 * Inngangen til CRM-en: alt som har en frist, sortert med det som er over
 * frist først. Ufordelte saker merkes tydelig så de ikke blir liggende.
 */
export default async function Oppfolging() {
  const okt = await krevRolle("leder");
  const rader = sorterOppfolginger(await hentOppfolginger(okt), iDag());
  const tall = tellFrister(rader);

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Kort style={{ flex: "1 1 160px", padding: "14px 16px" }}>
          <Etikett>Over frist</Etikett>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              marginTop: 5,
              color: tall.overFrist > 0 ? "var(--rod-tekst)" : "var(--tekst)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {tall.overFrist}
          </div>
        </Kort>
        <Kort style={{ flex: "1 1 160px", padding: "14px 16px" }}>
          <Etikett>Forfaller i dag</Etikett>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              marginTop: 5,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {tall.iDag}
          </div>
        </Kort>
        <Kort style={{ flex: "1 1 160px", padding: "14px 16px" }}>
          <Etikett>Ufordelt</Etikett>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              marginTop: 5,
              color: tall.ufordelt > 0 ? "var(--oransje-tekst)" : "var(--tekst)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {tall.ufordelt}
          </div>
        </Kort>
      </div>

      <Tabell
        kolonner={["Hva", "Kunde", "Ansvarlig", "Frist", "Status"]}
        antall={rader.length}
        tomtekst="Ingen åpne oppfølginger. Alt er ajour."
      >
        {rader.map((r) => (
          <tr key={r.id}>
            <Celle hoved>{r.hva}</Celle>
            <Celle>{r.kundeNavn ?? "—"}</Celle>
            <Celle>
              {r.ansvarligNavn ?? <Pille farge="oransje">Ufordelt</Pille>}
            </Celle>
            <Celle tall under={r.tekst}>
              {visDato(r.frist)}
            </Celle>
            <Celle>
              <Pille
                farge={
                  r.klasse === "over_frist"
                    ? "rod"
                    : r.klasse === "i_dag"
                      ? "oransje"
                      : r.klasse === "snart"
                        ? "bla"
                        : "noytral"
                }
              >
                {r.klasse === "over_frist"
                  ? "Over frist"
                  : r.klasse === "i_dag"
                    ? "I dag"
                    : r.klasse === "snart"
                      ? "Snart"
                      : "Senere"}
              </Pille>
            </Celle>
          </tr>
        ))}
      </Tabell>
    </>
  );
}
