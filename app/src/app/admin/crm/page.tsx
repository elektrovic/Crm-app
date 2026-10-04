import { krevRolle } from "@/lib/tilgang";
import {
  hentAnsattvalg,
  hentKundevalg,
  hentOppfolginger,
  hentStilleKunder,
  hentUtenNesteSteg,
} from "@/lib/data/crm";
import { iDag } from "@/lib/data/dagen";
import { sorterOppfolginger, tellFrister } from "@/lib/crm/frister";
import { Celle, Etikett, Kort, Pille, Tabell, visDato } from "@/components/ui";
import Link from "next/link";
import { Ring } from "@/components/ring";
import { NyOppfolging, Oppfolgingsrad } from "./oppfolging-handlinger";
import { Glipper } from "./glipper";

export const metadata = { title: "Oppfølging · CRM" };

/**
 * Inngangen til CRM-en: alt som har en frist, sortert med det som er over
 * frist først. Ufordelte saker merkes tydelig så de ikke blir liggende.
 */
export default async function Oppfolging() {
  const okt = await krevRolle("leder");
  const dato = iDag();
  const [alle, ansatte, kunder, utenNesteSteg, stille] = await Promise.all([
    hentOppfolginger(okt),
    hentAnsattvalg(okt),
    hentKundevalg(okt),
    hentUtenNesteSteg(okt, dato),
    hentStilleKunder(okt),
  ]);
  const rader = sorterOppfolginger(alle, dato);
  const tall = tellFrister(rader);

  return (
    <>
      <Glipper utenNesteSteg={utenNesteSteg} stille={stille} />

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

      <NyOppfolging ansatte={ansatte} kunder={kunder} iDag={dato} />

      <Tabell
        kolonner={["Hva", "Kunde", "Frist", "Status", "Handling"]}
        antall={rader.length}
        tomtekst="Ingen åpne oppfølginger. Alt er ajour."
      >
        {rader.map((r) => (
          <tr key={r.id}>
            <Celle hoved>{r.hva}</Celle>
            <Celle under={r.telefon ? undefined : "uten nummer"}>
              {r.henvendelseId ? (
                <Link
                  href={`/admin/crm/sak/${r.henvendelseId}`}
                  style={{ color: "var(--tekst)", textDecoration: "none" }}
                >
                  {r.kundeNavn ?? "Åpne saken"}
                </Link>
              ) : (
                (r.kundeNavn ?? "—")
              )}
              {r.telefon && (
                <div style={{ marginTop: 2 }}>
                  <Ring nummer={r.telefon} />
                </div>
              )}
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
            <Celle>
              <Oppfolgingsrad
                id={r.id}
                fullfort={r.fullfort}
                ansvarlig={r.ansvarlig}
                ansatte={ansatte}
              />
            </Celle>
          </tr>
        ))}
      </Tabell>
    </>
  );
}
