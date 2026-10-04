/**
 * Prosjektkortene.
 *
 * Ett kort per åpent prosjekt. «Åpent» er Tripletex sitt ord: synken henter
 * bare prosjekter med isClosed=false, og setter `aktiv = false` på alt som
 * ikke lenger kommer med. Avsluttede prosjekter forsvinner altså herfra av
 * seg selv — men radene blir stående, så timer og bilder fra i fjor ikke
 * mister prosjektet sitt.
 */
import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { mangler, prosjekter, synkkjoringer, tildelinger, vedlegg } from "@/db/schema";
import type { Avdeling } from "@/db/schema";
import type { Okt } from "../tilgang";

export type Prosjektkort = {
  id: string;
  nummer: string;
  navn: string;
  kunde: string | null;
  adresse: string | null;
  avdeling: Avdeling;
  /** Hvor mange ganger noen er satt opp på jobben framover. */
  planlagt: number;
  /** Åpne mangler — materiell noen har meldt at de trenger. */
  mangler: number;
  bilder: number;
  sistSynket: Date | null;
};

/**
 * Kortene, med tallene som gjør dem verdt å se på.
 *
 * Tellingene gjøres som underspørringer i samme kall. Et join med tre
 * grupperinger ville gitt kryssprodukt — tre mangler og to bilder blir
 * seks rader, og da teller man feil uten å merke det.
 */
export async function hentProsjektkort(okt: Okt, fraDato: string): Promise<Prosjektkort[]> {
  const planlagt = db
    .select({ n: sql<number>`count(*)` })
    .from(tildelinger)
    .where(and(eq(tildelinger.prosjektId, prosjekter.id), gte(tildelinger.dato, fraDato)));

  const apneMangler = db
    .select({ n: sql<number>`count(*)` })
    .from(mangler)
    .where(and(eq(mangler.prosjektId, prosjekter.id), eq(mangler.bestilt, false)));

  const antallBilder = db
    .select({ n: sql<number>`count(*)` })
    .from(vedlegg)
    .where(and(eq(vedlegg.prosjektId, prosjekter.id), sql`${vedlegg.slag} <> 'signatur'`));

  return db
    .select({
      id: prosjekter.id,
      nummer: prosjekter.nummer,
      navn: prosjekter.navn,
      kunde: prosjekter.kunde,
      adresse: prosjekter.adresse,
      avdeling: prosjekter.avdeling,
      sistSynket: prosjekter.sistSynket,
      planlagt: sql<number>`(${planlagt})`.mapWith(Number),
      mangler: sql<number>`(${apneMangler})`.mapWith(Number),
      bilder: sql<number>`(${antallBilder})`.mapWith(Number),
    })
    .from(prosjekter)
    .where(and(eq(prosjekter.tenantId, okt.tenantId), eq(prosjekter.aktiv, true)))
    .orderBy(asc(prosjekter.nummer));
}

export type Synkkjoring = {
  utloser: string;
  start: Date;
  slutt: Date | null;
  ok: boolean | null;
  feil: string | null;
};

/**
 * De siste kjøringene av synken.
 *
 * Vises til ledelsen fordi den timesvise jobben ellers er usynlig: den
 * virker helt til noen oppdager at tallene er gamle. En kjøring uten
 * sluttidspunkt betyr at den ble avbrutt midtveis — og ingen rad på en
 * hel time betyr at planleggeren aldri kalte oss.
 */
export async function hentSynkkjoringer(okt: Okt, antall = 5): Promise<Synkkjoring[]> {
  return db
    .select({
      utloser: synkkjoringer.utloser,
      start: synkkjoringer.start,
      slutt: synkkjoringer.slutt,
      ok: synkkjoringer.ok,
      feil: synkkjoringer.feil,
    })
    .from(synkkjoringer)
    .where(eq(synkkjoringer.tenantId, okt.tenantId))
    .orderBy(desc(synkkjoringer.start))
    .limit(antall);
}
