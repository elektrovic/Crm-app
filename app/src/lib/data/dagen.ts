/**
 * Datagrunnlaget for «Din dag».
 *
 * Filtreringen på ansatt skjer i spørringen, ikke i grensesnittet. En montør
 * får aldri kollegaenes oppdrag i svaret — det er forskjellen på en skjult
 * rad og en tilgangsregel.
 */
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { prosjekter, tildelinger, timeforinger } from "@/db/schema";
import { synligAnsattId, type Okt } from "../tilgang";

export type DagsOppdrag = {
  tildelingId: string;
  prosjektId: string;
  nummer: string;
  navn: string;
  kunde: string | null;
  adresse: string | null;
  farge: string;
  fraKl: string | null;
  tilKl: string | null;
  /** Initialer på den som er satt opp — bare synlig for leder. */
  eier: string | null;
};

export function iDag(tidssone = "Europe/Oslo"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tidssone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Oppdragene økten har lov til å se på en gitt dato. */
export async function hentDagensOppdrag(okt: Okt, dato = iDag()): Promise<DagsOppdrag[]> {
  const kunEgne = synligAnsattId(okt);

  const rader = await db
    .select({
      tildelingId: tildelinger.id,
      prosjektId: prosjekter.id,
      nummer: prosjekter.nummer,
      navn: prosjekter.navn,
      kunde: prosjekter.kunde,
      adresse: prosjekter.adresse,
      farge: prosjekter.farge,
      fraKl: tildelinger.fraKl,
      tilKl: tildelinger.tilKl,
      ansattId: tildelinger.ansattId,
    })
    .from(tildelinger)
    .innerJoin(prosjekter, eq(tildelinger.prosjektId, prosjekter.id))
    .where(
      and(
        eq(tildelinger.tenantId, okt.tenantId),
        eq(tildelinger.dato, dato),
        // Montør: kun egne rader. Leder/admin: hele avdelingen.
        ...(kunEgne ? [eq(tildelinger.ansattId, kunEgne)] : []),
        ...(kunEgne ? [] : [eq(prosjekter.avdeling, okt.avdeling)]),
      ),
    );

  return rader.map((r) => ({
    tildelingId: r.tildelingId,
    prosjektId: r.prosjektId,
    nummer: r.nummer,
    navn: r.navn,
    kunde: r.kunde,
    adresse: r.adresse,
    farge: r.farge,
    fraKl: r.fraKl,
    tilKl: r.tilKl,
    eier: kunEgne ? null : r.ansattId,
  }));
}

/** Tidsspennet dagen dekker, til linja «2 jobber · 07:30–15:00». */
export function dagensSpenn(oppdrag: DagsOppdrag[]): string | null {
  const fra = oppdrag.map((o) => o.fraKl).filter((v): v is string => Boolean(v)).sort();
  const til = oppdrag.map((o) => o.tilKl).filter((v): v is string => Boolean(v)).sort();
  if (fra.length === 0 || til.length === 0) return null;
  return `${fra[0]}–${til[til.length - 1]}`;
}

/**
 * Prosjektene montøren ofte fører på, i tillegg til dagens kalenderjobber.
 * Prototypen viser disse under kalenderjobbene så syv prosjekter går på
 * én skjerm.
 */
export async function hentOfteBrukte(okt: Okt, unntatt: string[]): Promise<DagsOppdrag[]> {
  const nylige = await db
    .selectDistinct({ prosjektId: timeforinger.prosjektId })
    .from(timeforinger)
    .where(and(eq(timeforinger.tenantId, okt.tenantId), eq(timeforinger.ansattId, okt.id)))
    .limit(20);

  const ider = nylige.map((r) => r.prosjektId).filter((id) => !unntatt.includes(id));
  if (ider.length === 0) return [];

  const rader = await db
    .select()
    .from(prosjekter)
    .where(and(eq(prosjekter.tenantId, okt.tenantId), inArray(prosjekter.id, ider)))
    .limit(4);

  return rader.map((p) => ({
    tildelingId: `ofte-${p.id}`,
    prosjektId: p.id,
    nummer: p.nummer,
    navn: p.navn,
    kunde: p.kunde,
    adresse: p.adresse,
    farge: p.farge,
    fraKl: null,
    tilKl: null,
    eier: null,
  }));
}
