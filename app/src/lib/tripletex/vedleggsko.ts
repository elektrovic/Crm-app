/**
 * Køen av vedlegg som skal opp til Tripletex.
 *
 * Bilder blir tatt der det ikke er dekning. Derfor lagres de først hos oss,
 * og sendes videre når det passer. Denne sveipen kjøres av den planlagte
 * synken og tar alt som ligger igjen — uansett hvor i appen det kom fra.
 *
 * Det er også det som gjør oppryddingen mulig. `lib/vedlegg/opprydding.ts`
 * sletter bare lokale kopier Tripletex har bekreftet at de har. Et bilde som
 * aldri kommer opp, blir derfor aldri ryddet bort — og da vokser databasen
 * med filer i stedet for data. Køen lukker den sløyfa.
 */
import "server-only";
import { and, asc, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { prosjekter, vedlegg } from "@/db/schema";
import { lastOppVedlegg } from "./tillegg";

/**
 * Etter så mange forsøk gir vi opp.
 *
 * En fil Tripletex aldri godtar skal ikke prøves hver time for alltid. Den
 * blir stående med feilmeldingen sin, synlig for den som leter.
 */
export const MAKS_FORSOK = 5;

export type Koresultat = {
  lastetOpp: number;
  feilet: number;
  /** Filer som har brukt opp forsøkene sine og trenger et menneske. */
  oppgitt: number;
};

/** Beskrivelsen som blir en del av filnavnet kontoret ser i Tripletex. */
function beskrivelse(slag: string, prosjektnavn: string): string {
  if (slag === "planlegging") return `Planlegging ${prosjektnavn}`;
  if (slag === "jobb") return `Fra jobben ${prosjektnavn}`;
  return `${slag} ${prosjektnavn}`;
}

export async function lastOppVentendeVedlegg(
  tenantId: string,
  maks = 40,
): Promise<Koresultat> {
  const ventende = await db
    .select({
      id: vedlegg.id,
      slag: vedlegg.slag,
      forsok: vedlegg.tripletexForsok,
      prosjektnavn: prosjekter.navn,
      tripletexProjectId: prosjekter.tripletexProjectId,
    })
    .from(vedlegg)
    .innerJoin(prosjekter, eq(vedlegg.prosjektId, prosjekter.id))
    .where(
      and(
        eq(vedlegg.tenantId, tenantId),
        isNull(vedlegg.tripletexLastetOpp),
        // Uten bytes er det ingenting å sende. Det skjer bare for filer
        // Tripletex alt har, så det er ikke en feil — bare ikke vår jobb.
        isNotNull(vedlegg.data),
        lt(vedlegg.tripletexForsok, MAKS_FORSOK),
      ),
    )
    .orderBy(asc(vedlegg.opprettet))
    .limit(maks);

  let lastetOpp = 0;
  let feilet = 0;
  let oppgitt = 0;

  for (const v of ventende) {
    // Forsøket telles før vi prøver, ikke etter. Krasjer funksjonen midt i,
    // skal telleren likevel ha gått opp — ellers kan en fil som river ned
    // synken prøves i det uendelige.
    await db
      .update(vedlegg)
      .set({ tripletexForsok: v.forsok + 1 })
      .where(eq(vedlegg.id, v.id));

    try {
      await lastOppVedlegg(
        tenantId,
        v.id,
        v.tripletexProjectId,
        beskrivelse(v.slag, v.prosjektnavn),
      );
      lastetOpp += 1;
    } catch (feil) {
      const melding = feil instanceof Error ? feil.message : "Ukjent feil";
      await db
        .update(vedlegg)
        .set({ tripletexFeilmelding: melding })
        .where(eq(vedlegg.id, v.id));
      feilet += 1;
      if (v.forsok + 1 >= MAKS_FORSOK) oppgitt += 1;
      console.error("Vedlegg gikk ikke opp til Tripletex", { vedlegg: v.id, feil: melding });
    }
  }

  return { lastetOpp, feilet, oppgitt };
}
