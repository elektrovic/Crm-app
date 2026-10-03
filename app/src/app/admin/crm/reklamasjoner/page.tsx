import { krevRolle } from "@/lib/tilgang";
import { hentKundevalg, hentReklamasjoner } from "@/lib/data/crm";
import { iDag } from "@/lib/data/dagen";
import { klassifiserFrist } from "@/lib/crm/frister";
import { Celle, Pille, Tabell, kroner, visDato } from "@/components/ui";
import type { Reklamasjonsstatus } from "@/db/schema";
import { NyReklamasjon, Reklamasjonsstatusvelger } from "../crm-handlinger";

export const metadata = { title: "Reklamasjoner · CRM" };

/**
 * Reklamasjoner.
 *
 * Feltene er valgt slik at en sak kan dokumenteres i en tvist: saksnummer,
 * mottatt dato, frist, ansvarlig, status og kostnad.
 *
 * Statusene er gjettet ut fra prototypen og skal rettes når dere sier hva
 * dere faktisk kaller dem.
 */
export default async function Reklamasjoner() {
  const okt = await krevRolle("leder");
  const [rader, kunder] = await Promise.all([hentReklamasjoner(okt), hentKundevalg(okt)]);
  const idag = iDag();

  return (
    <>
      <NyReklamasjon kunder={kunder} iDag={idag} />

      <Tabell
      kolonner={["Sak", "Kunde", "Mottatt", "Frist", "Ansvarlig", "Kostnad", "Status"]}
      antall={rader.length}
      tomtekst="Ingen reklamasjoner registrert."
    >
      {rader.map((r) => {
        const overFrist =
          r.frist !== null &&
          r.status !== "lukket" &&
          klassifiserFrist(r.frist, idag) === "over_frist";

        return (
          <tr key={r.id}>
            <Celle hoved>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                {r.saksnummer}
              </span>
            </Celle>
            <Celle under={r.beskrivelse}>{r.kundeNavn}</Celle>
            <Celle tall>{visDato(r.mottatt)}</Celle>
            <Celle tall>
              {r.frist ? (
                overFrist ? (
                  <span style={{ color: "var(--rod-tekst)", fontWeight: 700 }}>
                    {visDato(r.frist)}
                  </span>
                ) : (
                  visDato(r.frist)
                )
              ) : (
                "—"
              )}
            </Celle>
            <Celle>{r.ansvarligNavn ?? <Pille farge="oransje">Ufordelt</Pille>}</Celle>
            <Celle tall>{r.kostnad === null ? "—" : kroner.format(r.kostnad)}</Celle>
            <Celle>
              <Reklamasjonsstatusvelger id={r.id} status={r.status} />
            </Celle>
          </tr>
        );
      })}
      </Tabell>
    </>
  );
}
