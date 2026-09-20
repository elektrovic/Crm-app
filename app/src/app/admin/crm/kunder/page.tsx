import { krevRolle } from "@/lib/tilgang";
import { hentKunder } from "@/lib/data/crm";
import { Celle, Pille, Tabell, kroner, visDato } from "@/components/ui";
import type { Kundestatus } from "@/db/schema";

export const metadata = { title: "Kunder · CRM" };

const STATUSNAVN: Record<Kundestatus, { tekst: string; farge: "gronn" | "bla" | "rod" | "noytral" }> = {
  kunde: { tekst: "Kunde", farge: "gronn" },
  prospekt: { tekst: "Prospekt", farge: "bla" },
  tapt: { tekst: "Tapt", farge: "rod" },
  inaktiv: { tekst: "Inaktiv", farge: "noytral" },
};

export default async function Kunder() {
  const okt = await krevRolle("leder");
  const rader = await hentKunder(okt);

  return (
    <Tabell
      kolonner={["Kunde", "Type", "Avdeling", "Prosjekter", "Omsetning", "Status"]}
      antall={rader.length}
      tomtekst="Ingen kunder lagt inn ennå."
    >
      {rader.map((k) => {
        const status = STATUSNAVN[k.status];
        return (
          <tr key={k.id}>
            <Celle hoved under={k.kontaktperson}>
              {k.navn}
            </Celle>
            <Celle>{k.type ?? "—"}</Celle>
            <Celle>{k.avdeling ?? "—"}</Celle>
            <Celle tall>{k.antallProsjekter}</Celle>
            <Celle
              tall
              under={
                k.omsetningSynket
                  ? `Fra Tripletex ${visDato(k.omsetningSynket)}`
                  : "Ikke synket ennå"
              }
            >
              {k.omsetning === null ? "—" : kroner.format(k.omsetning)}
            </Celle>
            <Celle>
              <Pille farge={status.farge}>{status.tekst}</Pille>
            </Celle>
          </tr>
        );
      })}
    </Tabell>
  );
}
