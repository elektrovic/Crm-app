/**
 * Tallene på ledelsens dashboard.
 *
 * Alt her regnes ut fra våre egne tabeller. Det er et bevisst valg: tall
 * som vises til ledelsen skal kunne spores tilbake til en rad noen har
 * ført, ikke til en mellomregning ingen kan ettergå.
 *
 * Én ting mangler, og den er verdt å si høyt: **dekningsgrad**. Den
 * krever kostpris og timepris per prosjekt, og de ligger i Tripletex —
 * ikke hos oss. Vi gjetter den ikke. Feltet står tomt til synken henter
 * den, og sier hvorfor.
 */
import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { prosjekter, tillegg, timeforinger } from "@/db/schema";
import { mandagen } from "../uke";
import type { Okt } from "../tilgang";

/** Første dag i inneværende måned, som ISO-dato. */
function manedensForste(iDag: string): string {
  return `${iDag.slice(0, 7)}-01`;
}

export type Nokkeltall = {
  timerDenneUka: number;
  tilleggssalgDenneManeden: number;
  andelJobberMedTillegg: number | null;
  /** null betyr «vi vet ikke», ikke «null prosent». */
  dekningsgrad: number | null;
  iKo: number;
  feilet: number;
};

export async function hentNokkeltall(okt: Okt, iDag: string): Promise<Nokkeltall> {
  const mandag = mandagen(iDag);
  const forste = manedensForste(iDag);

  // Seks uavhengige tellinger. Etter hverandre ble de seks turer over
  // Atlanteren — Ohio til London og tilbake, rundt 85 ms hver. Samtidig
  // koster de én tur.
  const [[timer], [salg], [medTimer], [medTillegg], [ko], [koTillegg]] = await Promise.all([
    db
    .select({ sum: sql<number>`coalesce(sum(${timeforinger.timer}), 0)`.mapWith(Number) })
    .from(timeforinger)
    .where(and(eq(timeforinger.tenantId, okt.tenantId), gte(timeforinger.dato, mandag))),

    db
    .select({
      sum: sql<number>`coalesce(sum(${tillegg.antall} * ${tillegg.enhetspris}), 0)`.mapWith(Number),
    })
    .from(tillegg)
    .where(and(eq(tillegg.tenantId, okt.tenantId), gte(tillegg.opprettet, new Date(forste)))),

    // Andelen regnes mot prosjekter det faktisk er ført timer på i perioden.
    // Prosjekter ingen har rørt skal ikke trekke andelen ned.
    db
    .select({
      antall: sql<number>`count(distinct ${timeforinger.prosjektId})`.mapWith(Number),
    })
    .from(timeforinger)
    .where(and(eq(timeforinger.tenantId, okt.tenantId), gte(timeforinger.dato, forste))),

    db
    .select({ antall: sql<number>`count(distinct ${tillegg.prosjektId})`.mapWith(Number) })
    .from(tillegg)
    .where(and(eq(tillegg.tenantId, okt.tenantId), gte(tillegg.opprettet, new Date(forste)))),

    db
    .select({
      iKo: sql<number>`count(*) filter (where ${timeforinger.status} = 'i_ko')`.mapWith(Number),
      feilet: sql<number>`count(*) filter (where ${timeforinger.status} = 'feilet')`.mapWith(Number),
    })
    .from(timeforinger)
    .where(eq(timeforinger.tenantId, okt.tenantId)),

    db
    .select({
      iKo: sql<number>`count(*) filter (where ${tillegg.status} = 'i_ko')`.mapWith(Number),
      feilet: sql<number>`count(*) filter (where ${tillegg.status} = 'feilet')`.mapWith(Number),
    })
    .from(tillegg)
    .where(eq(tillegg.tenantId, okt.tenantId)),
  ]);

  const grunnlag = medTimer?.antall ?? 0;

  return {
    timerDenneUka: timer?.sum ?? 0,
    tilleggssalgDenneManeden: salg?.sum ?? 0,
    andelJobberMedTillegg:
      grunnlag > 0 ? Math.round(((medTillegg?.antall ?? 0) / grunnlag) * 100) : null,
    // Se kommentaren øverst: denne kommer fra Tripletex, ikke herfra.
    dekningsgrad: null,
    iKo: (ko?.iKo ?? 0) + (koTillegg?.iKo ?? 0),
    feilet: (ko?.feilet ?? 0) + (koTillegg?.feilet ?? 0),
  };
}

export type Korad = {
  id: string;
  tekst: string;
  meta: string;
  status: "i_ko" | "sendt" | "feilet";
};

/**
 * Sendekøen mot Tripletex, timer og tillegg om hverandre, nyest først.
 * Feilet først — det er det eneste noen må gjøre noe med.
 */
export async function hentSendeko(okt: Okt, grense = 12): Promise<Korad[]> {
  const timerader = await db
    .select({
      id: timeforinger.id,
      timer: timeforinger.timer,
      dato: timeforinger.dato,
      status: timeforinger.status,
      feilmelding: timeforinger.feilmelding,
      opprettet: timeforinger.opprettet,
      prosjektNummer: prosjekter.nummer,
      prosjektNavn: prosjekter.navn,
    })
    .from(timeforinger)
    .innerJoin(prosjekter, eq(prosjekter.id, timeforinger.prosjektId))
    .where(eq(timeforinger.tenantId, okt.tenantId))
    .orderBy(sql`${timeforinger.opprettet} desc`)
    .limit(grense);

  const tilleggsrader = await db
    .select({
      id: tillegg.id,
      navn: tillegg.navn,
      antall: tillegg.antall,
      enhetspris: tillegg.enhetspris,
      status: tillegg.status,
      feilmelding: tillegg.feilmelding,
      opprettet: tillegg.opprettet,
      prosjektNummer: prosjekter.nummer,
    })
    .from(tillegg)
    .innerJoin(prosjekter, eq(prosjekter.id, tillegg.prosjektId))
    .where(eq(tillegg.tenantId, okt.tenantId))
    .orderBy(sql`${tillegg.opprettet} desc`)
    .limit(grense);

  const alle: (Korad & { opprettet: Date })[] = [
    ...timerader.map((r) => ({
      id: `timer-${r.id}`,
      tekst: `${Number(r.timer).toLocaleString("nb-NO")} t – ${r.prosjektNummer} ${r.prosjektNavn}`,
      meta: r.feilmelding ?? `Ført ${r.dato}`,
      status: r.status as Korad["status"],
      opprettet: r.opprettet,
    })),
    ...tilleggsrader.map((r) => ({
      id: `tillegg-${r.id}`,
      tekst: `${r.navn} – ${Math.round(Number(r.antall) * Number(r.enhetspris)).toLocaleString("nb-NO")} kr`,
      meta: r.feilmelding ?? `Tillegg på prosjekt ${r.prosjektNummer}`,
      status: r.status as Korad["status"],
      opprettet: r.opprettet,
    })),
  ];

  const vekt = { feilet: 0, i_ko: 1, sendt: 2 } as const;

  return alle
    .sort(
      (a, b) =>
        vekt[a.status] - vekt[b.status] || b.opprettet.getTime() - a.opprettet.getTime(),
    )
    .slice(0, grense)
    .map(({ opprettet: _, ...rad }) => rad);
}

export type Avdelingssalg = {
  avdeling: string;
  belop: number;
  antallProsjekter: number;
};

/** Tilleggssalg denne måneden, fordelt på avdeling. */
export async function hentAvdelingssalg(okt: Okt, iDag: string): Promise<Avdelingssalg[]> {
  const forste = manedensForste(iDag);

  return db
    .select({
      avdeling: prosjekter.avdeling,
      belop: sql<number>`coalesce(sum(${tillegg.antall} * ${tillegg.enhetspris}), 0)`.mapWith(
        Number,
      ),
      antallProsjekter: sql<number>`count(distinct ${tillegg.prosjektId})`.mapWith(Number),
    })
    .from(tillegg)
    .innerJoin(prosjekter, eq(prosjekter.id, tillegg.prosjektId))
    .where(and(eq(tillegg.tenantId, okt.tenantId), gte(tillegg.opprettet, new Date(forste))))
    .groupBy(prosjekter.avdeling)
    .orderBy(sql`2 desc`);
}

export type Prosjekttimer = {
  nummer: string;
  navn: string;
  timer: number;
};

/**
 * Timer per prosjekt denne uka.
 *
 * Står der prototypen har «topp jobber etter dekningsgrad». Den krever
 * tall fra Tripletex vi ikke har, og et oppdiktet stolpediagram er verre
 * enn ingen. Dette er samme form, og tallene er våre egne.
 */
export async function hentTimerPerProsjekt(
  okt: Okt,
  iDag: string,
  grense = 5,
): Promise<Prosjekttimer[]> {
  const mandag = mandagen(iDag);

  return db
    .select({
      nummer: prosjekter.nummer,
      navn: prosjekter.navn,
      timer: sql<number>`coalesce(sum(${timeforinger.timer}), 0)`.mapWith(Number),
    })
    .from(timeforinger)
    .innerJoin(prosjekter, eq(prosjekter.id, timeforinger.prosjektId))
    .where(and(eq(timeforinger.tenantId, okt.tenantId), gte(timeforinger.dato, mandag)))
    .groupBy(prosjekter.nummer, prosjekter.navn)
    .orderBy(sql`3 desc`)
    .limit(grense);
}
