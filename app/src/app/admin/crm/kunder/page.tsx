import { krevRolle } from "@/lib/tilgang";
import { hentKunder } from "@/lib/data/crm";
import Link from "next/link";
import { Celle, Pille, Tabell, kroner, visDato } from "@/components/ui";
import type { Avdeling, Kundestatus } from "@/db/schema";
import { KundeSkjema } from "../crm-handlinger";

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
    <>
      <KundeSkjema />

      <Tabell
      kolonner={["Kunde", "Type", "Avdeling", "Prosjekter", "Omsetning", "Status", ""]}
      antall={rader.length}
      tomtekst="Ingen kunder lagt inn ennå."
    >
      {rader.map((k) => {
        const status = STATUSNAVN[k.status];
        return (
          <tr key={k.id}>
            <Celle hoved under={k.kontaktperson}>
              {/* Navnet er veien inn til hele historikken. Uten lenken her
                  er kundekortet et sted man må vite om for å finne. */}
              <Link
                href={`/admin/crm/kunder/${k.id}`}
                style={{ color: "var(--tekst)", textDecoration: "none" }}
              >
                {k.navn}
              </Link>
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
            <Celle>
              <KundeSkjema
                kunde={{
                  id: k.id,
                  navn: k.navn,
                  type: k.type,
                  orgnummer: null,
                  kontaktperson: k.kontaktperson,
                  telefon: k.telefon,
                  epost: k.epost,
                  adresse: null,
                  avdeling: k.avdeling as Avdeling | null,
                  status: k.status,
                }}
              />
            </Celle>
          </tr>
        );
      })}
      </Tabell>
    </>
  );
}
