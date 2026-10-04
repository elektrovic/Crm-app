/**
 * Radtall per område, til seksjonene som ennå ikke har en skjerm.
 *
 * Poenget er å skille «det finnes ingen data» fra «dataene finnes, men
 * grensesnittet mangler». Uten det tallet ser en ubygget seksjon lik ut
 * i begge tilfeller, og man vet ikke om det er en skjerm eller en synk
 * som skal bygges først.
 *
 * Alt telles innenfor innloggedes tenant. Det er ikke pynt: tallene vises
 * til ledelsen, og en teller som lekker på tvers av kunder ville vært en
 * stille feil i et system som skal kunne selges videre.
 */
import "server-only";
import { eq, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  adkomst,
  aktiviteter,
  ansatte,
  endringslogg,
  mangler,
  prislinjer,
  prosjekter,
  skjemamaler,
  skjemasvar,
  tildelinger,
  tillegg,
  timeforinger,
  vedlegg,
} from "@/db/schema";
import type { Okt } from "../tilgang";

/** En tabell vi kan telle: alt vi trenger er tenant-kolonnen. */
type Tellbar = PgTable & { tenantId: AnyPgColumn };

const TABELLER = {
  adkomst,
  aktiviteter,
  ansatte,
  endringslogg,
  mangler,
  prislinjer,
  prosjekter,
  skjemamaler,
  skjemasvar,
  tildelinger,
  tillegg,
  timeforinger,
  vedlegg,
} satisfies Record<string, Tellbar>;

export type Omrade = keyof typeof TABELLER;

/**
 * Teller rader i de oppgitte tabellene. Én spørring per tabell, men de
 * kjøres samtidig — en ubygget side skal ikke koste mer enn den må.
 */
export async function tellRader<T extends Omrade>(
  okt: Okt,
  omrader: readonly T[],
): Promise<Record<T, number>> {
  const tall = await Promise.all(
    omrader.map(async (navn) => {
      const tabell: Tellbar = TABELLER[navn];
      const [rad] = await db
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(tabell)
        .where(eq(tabell.tenantId, okt.tenantId));
      return [navn, rad?.n ?? 0] as const;
    }),
  );
  return Object.fromEntries(tall) as Record<T, number>;
}
