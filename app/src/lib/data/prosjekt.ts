/**
 * Oppslag mot ett prosjekt.
 *
 * Alt filtreres på tenantId. En rad som ikke tilhører innlogget kundes
 * organisasjon skal ikke bare skjules — den skal aldri komme ut av basen.
 */
import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  adkomst,
  ansatte,
  mangler,
  prislinjer,
  prosjekter,
  skjemamaler,
  tildelinger,
} from "@/db/schema";
import type { Okt } from "../tilgang";

export type ProsjektMedAdkomst = {
  id: string;
  tripletexProjectId: number;
  nummer: string;
  navn: string;
  kunde: string | null;
  adresse: string | null;
  farge: string;
  adkomst: {
    nokkelkode: string | null;
    kontaktperson: string | null;
    kontakttelefon: string | null;
    parkering: string | null;
    merknad: string | null;
    oppdatertAvNavn: string | null;
    oppdatert: Date | null;
  } | null;
};

export async function hentProsjekt(
  okt: Okt,
  nummer: string,
): Promise<ProsjektMedAdkomst | null> {
  const rader = await db
    .select({
      p: prosjekter,
      a: adkomst,
      oppdatertAvNavn: ansatte.navn,
    })
    .from(prosjekter)
    .leftJoin(adkomst, eq(adkomst.prosjektId, prosjekter.id))
    .leftJoin(ansatte, eq(adkomst.oppdatertAv, ansatte.id))
    .where(and(eq(prosjekter.tenantId, okt.tenantId), eq(prosjekter.nummer, nummer)))
    .limit(1);

  const rad = rader[0];
  if (!rad) return null;

  return {
    id: rad.p.id,
    tripletexProjectId: rad.p.tripletexProjectId,
    nummer: rad.p.nummer,
    navn: rad.p.navn,
    kunde: rad.p.kunde,
    adresse: rad.p.adresse,
    farge: rad.p.farge,
    adkomst: rad.a
      ? {
          nokkelkode: rad.a.nokkelkode,
          kontaktperson: rad.a.kontaktperson,
          kontakttelefon: rad.a.kontakttelefon,
          parkering: rad.a.parkering,
          merknad: rad.a.merknad,
          oppdatertAvNavn: rad.oppdatertAvNavn,
          oppdatert: rad.a.oppdatert,
        }
      : null,
  };
}

export type ManglerLinje = {
  id: string;
  tekst: string;
  antall: string | null;
  efoNummer: string | null;
  enhet: string;
  taltInn: boolean;
  bestilt: boolean;
  lagtInnAvNavn: string;
  opprettet: Date;
};

export async function hentMangler(okt: Okt, prosjektId: string): Promise<ManglerLinje[]> {
  const rader = await db
    .select({ m: mangler, navn: ansatte.navn })
    .from(mangler)
    .innerJoin(ansatte, eq(mangler.lagtInnAv, ansatte.id))
    .where(and(eq(mangler.tenantId, okt.tenantId), eq(mangler.prosjektId, prosjektId)))
    // Åpne linjer først — det er de montøren skal handle på.
    .orderBy(asc(mangler.bestilt), desc(mangler.opprettet));

  return rader.map((r) => ({
    id: r.m.id,
    tekst: r.m.tekst,
    antall: r.m.antall,
    efoNummer: r.m.efoNummer,
    enhet: r.m.enhet,
    taltInn: r.m.taltInn,
    bestilt: r.m.bestilt,
    lagtInnAvNavn: r.navn,
    opprettet: r.m.opprettet,
  }));
}

export type Prislinje = {
  id: string;
  navn: string;
  enhet: string | null;
  pris: number;
};

/** Prislista for økt-innehaverens avdeling. */
export async function hentPrisliste(okt: Okt): Promise<Prislinje[]> {
  const rader = await db
    .select()
    .from(prislinjer)
    .where(
      and(
        eq(prislinjer.tenantId, okt.tenantId),
        eq(prislinjer.avdeling, okt.avdeling),
        eq(prislinjer.aktiv, true),
      ),
    )
    .orderBy(asc(prislinjer.sortering), asc(prislinjer.navn));

  return rader.map((r) => ({
    id: r.id,
    navn: r.navn,
    enhet: r.enhet,
    pris: Number(r.pris),
  }));
}

/** Kontrollskjemaet for avdelingen. */
export async function hentSkjemamal(okt: Okt) {
  const rad = await db.query.skjemamaler.findFirst({
    where: and(
      eq(skjemamaler.tenantId, okt.tenantId),
      eq(skjemamaler.avdeling, okt.avdeling),
      eq(skjemamaler.aktiv, true),
    ),
  });
  return rad ?? null;
}

/** Tidsvinduet montøren er satt opp på i dag, brukt i SMS-en til kunden. */
export async function hentTidsvindu(
  okt: Okt,
  prosjektId: string,
  dato: string,
): Promise<string | null> {
  const rad = await db.query.tildelinger.findFirst({
    where: and(
      eq(tildelinger.tenantId, okt.tenantId),
      eq(tildelinger.prosjektId, prosjektId),
      eq(tildelinger.ansattId, okt.id),
      eq(tildelinger.dato, dato),
    ),
  });
  if (!rad?.fraKl || !rad.tilKl) return null;
  return `${rad.fraKl}-${rad.tilKl}`;
}
