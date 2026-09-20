import { krevRolle } from "@/lib/tilgang";
import { hentGarantier } from "@/lib/data/crm";
import { iDag } from "@/lib/data/dagen";
import { klassifiserFrist } from "@/lib/crm/frister";
import { Celle, Pille, Tabell, visDato } from "@/components/ui";

export const metadata = { title: "Garanti og gjenkjøp · CRM" };

/**
 * Garanti og gjenkjøp: hva som er utført, når garantien løper ut, hva som
 * anbefales neste gang — og hvem som er klar å ringe nå.
 */
export default async function Garanti() {
  const okt = await krevRolle("leder");
  const rader = await hentGarantier(okt);
  const idag = iDag();

  const klarAaRinge = rader.filter(
    (r) =>
      !r.kontaktet &&
      r.kontaktesEtter !== null &&
      ["over_frist", "i_dag"].includes(klassifiserFrist(r.kontaktesEtter, idag)),
  ).length;

  return (
    <>
      {klarAaRinge > 0 && (
        <div
          style={{
            background: "var(--gronn-bg)",
            borderRadius: "var(--r-kort)",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 11,
          }}
        >
          <Pille farge="gronn">
            {klarAaRinge === 1 ? "1 kunde" : `${klarAaRinge} kunder`}
          </Pille>
          <span style={{ fontSize: 13.5, color: "var(--gronn-tekst)", fontWeight: 600 }}>
            klar å ringe om gjenkjøp nå.
          </span>
        </div>
      )}

      <Tabell
        kolonner={["Kunde", "Utført", "Garanti utløper", "Anbefaling", "Kontaktes", "Status"]}
        antall={rader.length}
        tomtekst="Ingen garantier registrert."
      >
        {rader.map((g) => {
          const naa =
            !g.kontaktet &&
            g.kontaktesEtter !== null &&
            ["over_frist", "i_dag"].includes(klassifiserFrist(g.kontaktesEtter, idag));

          return (
            <tr key={g.id}>
              <Celle hoved under={g.kundeTelefon}>
                {g.kundeNavn}
              </Celle>
              <Celle under={visDato(g.utfortDato)}>{g.utfort}</Celle>
              <Celle tall>{visDato(g.garantiUtloper)}</Celle>
              <Celle>{g.anbefaling ?? "—"}</Celle>
              <Celle tall>{visDato(g.kontaktesEtter)}</Celle>
              <Celle>
                {g.kontaktet ? (
                  <Pille farge="noytral">Kontaktet</Pille>
                ) : naa ? (
                  <Pille farge="gronn">Ring nå</Pille>
                ) : (
                  <Pille farge="bla">Venter</Pille>
                )}
              </Celle>
            </tr>
          );
        })}
      </Tabell>
    </>
  );
}
