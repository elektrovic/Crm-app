import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ansatte, type Avdeling, type Rolle } from "@/db/schema";
import type { Okt } from "../tilgang";

export type Brukerrad = {
  id: string;
  navn: string;
  epost: string;
  rolle: Rolle;
  avdeling: Avdeling;
  initialer: string;
  farge: string;
  aktiv: boolean;
  /** Null betyr at brukeren aldri har vært inne. */
  sisteInnlogging: Date | null;
  maaByttePassord: boolean;
  /** Falsk når brukeren bare kan komme inn med Microsoft. */
  harPassord: boolean;
  erMeg: boolean;
};

/**
 * Alle brukere, aktive først.
 *
 * Sperrede står nederst i stedet for å skjules. De er sjelden mange, og
 * «finnes ikke» og «er sperret» er to helt forskjellige svar når noen
 * lurer på hvorfor en ansatt ikke kommer inn.
 */
export async function hentBrukere(okt: Okt): Promise<Brukerrad[]> {
  const rader = await db
    .select({
      id: ansatte.id,
      navn: ansatte.navn,
      epost: ansatte.epost,
      rolle: ansatte.rolle,
      avdeling: ansatte.avdeling,
      initialer: ansatte.initialer,
      farge: ansatte.farge,
      aktiv: ansatte.aktiv,
      sisteInnlogging: ansatte.sisteInnlogging,
      maaByttePassord: ansatte.maaByttePassord,
      harPassord: sql<boolean>`${ansatte.passordHash} is not null`.mapWith(Boolean),
    })
    .from(ansatte)
    .where(eq(ansatte.tenantId, okt.tenantId))
    .orderBy(desc(ansatte.aktiv), asc(ansatte.navn));

  return rader.map((r) => ({ ...r, erMeg: r.id === okt.id }));
}

export type Brukertall = {
  aktive: number;
  sperrede: number;
  administratorer: number;
  /** Opprettet, men aldri logget inn. Disse må noen følge opp. */
  aldriInne: number;
  /** Går fortsatt med det midlertidige passordet. */
  medMidlertidig: number;
};

export function tellBrukere(rader: Brukerrad[]): Brukertall {
  return {
    aktive: rader.filter((r) => r.aktiv).length,
    sperrede: rader.filter((r) => !r.aktiv).length,
    administratorer: rader.filter((r) => r.aktiv && r.rolle === "admin").length,
    aldriInne: rader.filter((r) => r.aktiv && r.sisteInnlogging === null).length,
    medMidlertidig: rader.filter((r) => r.aktiv && r.maaByttePassord).length,
  };
}
