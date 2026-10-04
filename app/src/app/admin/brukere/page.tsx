import { krevRolle } from "@/lib/tilgang";
import { hentBrukere, tellBrukere } from "@/lib/data/brukere";
import { Celle, IkonFlis, Kort, Sidetittel, Tabell } from "@/components/ui";
import { ROLLENAVN } from "@/lib/roller";
import { Brukerrad, NyBruker } from "./brukerhandlinger";

export const metadata = { title: "Brukere og roller · Montørappen" };

const NAR = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Hvem som slipper inn, og hva de får se.
 *
 * Alt skjer i lista: rolle og avdeling er nedtrekk i raden, og nytt
 * passord er én knapp. Et eget redigeringsskjema per bruker ville vært
 * flere klikk for noe som gjøres sjelden, men raskt når det gjøres.
 */
export default async function Brukere() {
  const okt = await krevRolle("admin");
  const rader = await hentBrukere(okt);
  const tall = tellBrukere(rader);

  return (
    <>
      <Sidetittel
        tittel="Brukere og roller"
        under="Alle som skal inn i portalen får sin egen bruker. Passordet lages her og byttes ved første innlogging."
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Talle merke="Aktive" tall={tall.aktive} />
        <Talle merke="Administratorer" tall={tall.administratorer} />
        <Talle
          merke="Aldri logget inn"
          tall={tall.aldriInne}
          framhev={tall.aldriInne > 0}
        />
        <Talle
          merke="Midlertidig passord"
          tall={tall.medMidlertidig}
          framhev={tall.medMidlertidig > 0}
        />
        {tall.sperrede > 0 && <Talle merke="Sperret" tall={tall.sperrede} />}
      </div>

      <NyBruker />

      <Tabell
        kolonner={["Navn", "Sist inne", "Tilgang"]}
        antall={rader.length}
        tomtekst="Ingen brukere ennå."
      >
        {rader.map((b) => (
          <tr key={b.id} style={b.aktiv ? undefined : { opacity: 0.55 }}>
            <Celle hoved under={`${b.epost} · ${ROLLENAVN[b.rolle]}, ${b.avdeling}`}>
              <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <IkonFlis farge={b.farge} storrelse={27}>
                  {b.initialer}
                </IkonFlis>
                <span>
                  {b.navn}
                  {b.erMeg && (
                    <span style={{ marginLeft: 7, fontSize: 11, color: "var(--svak)" }}>
                      deg
                    </span>
                  )}
                </span>
              </span>
            </Celle>

            <Celle
              tall
              under={
                !b.aktiv
                  ? "sperret"
                  : b.maaByttePassord
                    ? "må bytte passord"
                    : !b.harPassord
                      ? "bare Microsoft"
                      : undefined
              }
            >
              {b.sisteInnlogging ? NAR.format(b.sisteInnlogging) : "aldri"}
            </Celle>

            <Celle>
              <Brukerrad
                id={b.id}
                navn={b.navn}
                rolle={b.rolle}
                avdeling={b.avdeling}
                aktiv={b.aktiv}
                erMeg={b.erMeg}
              />
            </Celle>
          </tr>
        ))}
      </Tabell>
    </>
  );
}

function Talle({
  merke,
  tall,
  framhev = false,
}: {
  merke: string;
  tall: number;
  framhev?: boolean;
}) {
  return (
    <Kort style={{ flex: "1 1 150px", padding: "13px 15px" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: ".07em",
          textTransform: "uppercase",
          color: "var(--svak)",
        }}
      >
        {merke}
      </div>
      <div
        style={{
          fontSize: 25,
          fontWeight: 800,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
          color: framhev ? "var(--oransje-tekst)" : "var(--tekst)",
        }}
      >
        {tall}
      </div>
    </Kort>
  );
}
