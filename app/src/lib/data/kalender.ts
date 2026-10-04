/**
 * Kalenderen — hvem skal hvor, og hva de trenger for å gjøre jobben.
 *
 * Alt montøren trenger å vite om en jobb hentes i ett kall: adressen, hvem
 * som åpner døra, hva han skal ha med, hva som ble meldt manglende forrige
 * gang, og bildene. Det er ikke en ytelsesdetalj — det er fordi han står
 * ved bilen klokka sju med én strek dekning, og ikke skal måtte åpne fire
 * skjermer for å finne ut om han har med seg riktig.
 *
 * Fargen følger montøren, ikke prosjektet. Det var valget da kalenderen
 * ble bestilt: lederen ser på uka for å finne ut hvem som er hvor.
 */
import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  adkomst,
  ansatte,
  mangler,
  medbring,
  prosjekter,
  tildelinger,
  vedlegg,
} from "@/db/schema";
import type { Avdeling } from "@/db/schema";
import type { Okt } from "../tilgang";

export type Kollega = { id: string; navn: string; initialer: string; farge: string };

export type Kalenderjobb = {
  tildelingId: string;
  dato: string;
  fraKl: string | null;
  tilKl: string | null;
  notat: string | null;
  prosjektId: string;
  nummer: string;
  navn: string;
  kunde: string | null;
  adresse: string | null;
  avdeling: Avdeling;
  ansattId: string;
  ansattNavn: string;
  initialer: string;
  /** Montørens farge. Se toppen: fargen følger personen. */
  farge: string;
  antallMedbring: number;
  antallPakket: number;
  kolleger: Kollega[];
};

/** Søndagen i samme uke som mandagen. */
export function sondagen(mandag: string): string {
  const d = new Date(`${mandag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/**
 * En leder ser sin egen avdeling, en admin ser alle.
 *
 * Det er samme regel som resten av appen bruker. Står daglig leder som
 * `leder` på én avdeling, ser hen bare den — da må rollen settes til
 * `admin`, ikke kalenderen gjøres til et unntak.
 */
function avdelingsfilter(okt: Okt) {
  return okt.rolle === "admin" ? [] : [eq(prosjekter.avdeling, okt.avdeling)];
}

const VALG = {
  tildelingId: tildelinger.id,
  dato: tildelinger.dato,
  fraKl: tildelinger.fraKl,
  tilKl: tildelinger.tilKl,
  notat: tildelinger.notat,
  prosjektId: prosjekter.id,
  nummer: prosjekter.nummer,
  navn: prosjekter.navn,
  kunde: prosjekter.kunde,
  adresse: prosjekter.adresse,
  avdeling: prosjekter.avdeling,
  ansattId: ansatte.id,
  ansattNavn: ansatte.navn,
  initialer: ansatte.initialer,
  farge: ansatte.farge,
} as const;

/** Teller pakkelinjer per tildeling, i én spørring for hele uka. */
async function tellMedbring(tenantId: string, tildelingIder: string[]) {
  if (tildelingIder.length === 0) return new Map<string, { av: number; pakket: number }>();
  const rader = await db
    .select({
      tildelingId: medbring.tildelingId,
      pakket: medbring.pakket,
    })
    .from(medbring)
    .where(
      and(eq(medbring.tenantId, tenantId), inArray(medbring.tildelingId, tildelingIder)),
    );

  const kart = new Map<string, { av: number; pakket: number }>();
  for (const r of rader) {
    const n = kart.get(r.tildelingId) ?? { av: 0, pakket: 0 };
    n.av += 1;
    if (r.pakket) n.pakket += 1;
    kart.set(r.tildelingId, n);
  }
  return kart;
}

/**
 * Hvem andre står på samme prosjekt samme dag.
 *
 * Montøren får se dette selv om han ikke får se resten av uka deres — han
 * skal vite hvem han møter på bygget.
 */
async function hentKolleger(
  tenantId: string,
  par: { prosjektId: string; dato: string }[],
  utenomAnsattId: string | null,
) {
  if (par.length === 0) return new Map<string, Kollega[]>();

  const rader = await db
    .select({
      prosjektId: tildelinger.prosjektId,
      dato: tildelinger.dato,
      id: ansatte.id,
      navn: ansatte.navn,
      initialer: ansatte.initialer,
      farge: ansatte.farge,
    })
    .from(tildelinger)
    .innerJoin(ansatte, eq(tildelinger.ansattId, ansatte.id))
    // De to listene gir et kryssprodukt: vi kan få tilbake en rad for
    // prosjekt A på en dato som hørte til prosjekt B. Det er greit — under
    // slås radene opp på «prosjekt|dato», og bare de parene vi faktisk
    // spurte om kan leses ut. Alternativet er én spørring per jobb.
    .where(
      and(
        eq(tildelinger.tenantId, tenantId),
        inArray(
          tildelinger.prosjektId,
          par.map((p) => p.prosjektId),
        ),
        inArray(
          tildelinger.dato,
          par.map((p) => p.dato),
        ),
      ),
    );

  const kart = new Map<string, Kollega[]>();
  for (const r of rader) {
    if (utenomAnsattId && r.id === utenomAnsattId) continue;
    const nokkel = `${r.prosjektId}|${r.dato}`;
    const liste = kart.get(nokkel) ?? [];
    if (!liste.some((k) => k.id === r.id)) {
      liste.push({ id: r.id, navn: r.navn, initialer: r.initialer, farge: r.farge });
    }
    kart.set(nokkel, liste);
  }
  return kart;
}

async function berik(okt: Okt, rader: Awaited<ReturnType<typeof hentRader>>) {
  const tall = await tellMedbring(
    okt.tenantId,
    rader.map((r) => r.tildelingId),
  );
  // Kolleger regnes alltid ut fra radens eget perspektiv: står du selv på
  // jobben, er du ikke din egen kollega.
  const kart = await hentKolleger(
    okt.tenantId,
    rader.map((r) => ({ prosjektId: r.prosjektId, dato: r.dato })),
    null,
  );

  return rader.map((r): Kalenderjobb => {
    const n = tall.get(r.tildelingId) ?? { av: 0, pakket: 0 };
    const alle = kart.get(`${r.prosjektId}|${r.dato}`) ?? [];
    return {
      ...r,
      antallMedbring: n.av,
      antallPakket: n.pakket,
      kolleger: alle.filter((k) => k.id !== r.ansattId),
    };
  });
}

function hentRader(tenantId: string, filtre: ReturnType<typeof and>[]) {
  return db
    .select(VALG)
    .from(tildelinger)
    .innerJoin(prosjekter, eq(tildelinger.prosjektId, prosjekter.id))
    .innerJoin(ansatte, eq(tildelinger.ansattId, ansatte.id))
    .where(and(eq(tildelinger.tenantId, tenantId), ...filtre))
    .orderBy(asc(tildelinger.dato), asc(tildelinger.fraKl), asc(ansatte.navn));
}

/** Hele uka, slik ledelsen ser den. */
export async function hentUkeplan(okt: Okt, mandag: string): Promise<Kalenderjobb[]> {
  const rader = await hentRader(okt.tenantId, [
    gte(tildelinger.dato, mandag),
    lte(tildelinger.dato, sondagen(mandag)),
    ...avdelingsfilter(okt),
  ]);
  return berik(okt, rader);
}

/** Montørens egen uke. Bare hans egne rader — kollegene kommer som navn. */
export async function hentMinUke(okt: Okt, mandag: string): Promise<Kalenderjobb[]> {
  const rader = await hentRader(okt.tenantId, [
    gte(tildelinger.dato, mandag),
    lte(tildelinger.dato, sondagen(mandag)),
    eq(tildelinger.ansattId, okt.id),
  ]);
  return berik(okt, rader);
}

export type Pakkelinje = {
  id: string;
  tekst: string;
  antall: string | null;
  enhet: string;
  pakket: boolean;
  /** Kom linja fra en mangel noen meldte inn, eller ble den skrevet her? */
  fraMangel: boolean;
};

export type Manglerlinje = {
  id: string;
  tekst: string;
  antall: string | null;
  enhet: string;
  bestilt: boolean;
  efoNummer: string | null;
};

export type Bilde = {
  id: string;
  slag: string;
  mimetype: string;
  /** Falsk når bytene er ryddet bort lokalt, men raden står igjen. */
  tilgjengelig: boolean;
  /** Når Tripletex bekreftet at de har fila. Null betyr «ikke sendt ennå». */
  iTripletex: Date | null;
  /** Satt når synken ga opp. Da trenger den et menneske. */
  feilmelding: string | null;
};

export type Jobbkort = Kalenderjobb & {
  adkomst: {
    nokkelkode: string | null;
    kontaktperson: string | null;
    kontakttelefon: string | null;
    parkering: string | null;
    merknad: string | null;
  } | null;
  medbring: Pakkelinje[];
  mangler: Manglerlinje[];
  bilder: Bilde[];
};

/** Bildene på et prosjekt, nyeste først. Signaturer hører ikke hjemme her. */
async function hentBilder(tenantId: string, prosjektId: string): Promise<Bilde[]> {
  const rader = await db
    .select({
      id: vedlegg.id,
      slag: vedlegg.slag,
      mimetype: vedlegg.mimetype,
      data: vedlegg.data,
      opprettet: vedlegg.opprettet,
      iTripletex: vedlegg.tripletexLastetOpp,
      feilmelding: vedlegg.tripletexFeilmelding,
    })
    .from(vedlegg)
    .where(and(eq(vedlegg.tenantId, tenantId), eq(vedlegg.prosjektId, prosjektId)));

  return rader
    .filter((r) => r.slag !== "signatur" && r.mimetype.startsWith("image/"))
    .sort((a, b) => b.opprettet.getTime() - a.opprettet.getTime())
    .map((r) => ({
      id: r.id,
      slag: r.slag,
      mimetype: r.mimetype,
      tilgjengelig: r.data !== null,
      iTripletex: r.iTripletex,
      feilmelding: r.feilmelding,
    }));
}

/**
 * Alt om én jobb.
 *
 * Tilgangen avgjøres her, ikke i skjermen: en montør får bare åpne sine
 * egne tildelinger, en leder sin avdeling, en admin alt. Returnerer null
 * når raden ikke finnes *eller* ikke er din — en bruker skal ikke kunne
 * skille de to tilfellene fra hverandre ved å prøve seg fram.
 */
export async function hentJobb(okt: Okt, tildelingId: string): Promise<Jobbkort | null> {
  const [rad] = await hentRader(okt.tenantId, [
    eq(tildelinger.id, tildelingId),
    ...(okt.rolle === "montor" ? [eq(tildelinger.ansattId, okt.id)] : avdelingsfilter(okt)),
  ]);
  if (!rad) return null;

  const [beriket] = await berik(okt, [rad]);
  if (!beriket) return null;

  const [adk, pakke, mangel, bilder] = await Promise.all([
    db.query.adkomst.findFirst({ where: eq(adkomst.prosjektId, rad.prosjektId) }),
    db
      .select({
        id: medbring.id,
        tekst: medbring.tekst,
        antall: medbring.antall,
        enhet: medbring.enhet,
        pakket: medbring.pakket,
        mangelId: medbring.mangelId,
      })
      .from(medbring)
      .where(and(eq(medbring.tenantId, okt.tenantId), eq(medbring.tildelingId, rad.tildelingId)))
      .orderBy(asc(medbring.sortering), asc(medbring.opprettet)),
    db
      .select({
        id: mangler.id,
        tekst: mangler.tekst,
        antall: mangler.antall,
        enhet: mangler.enhet,
        bestilt: mangler.bestilt,
        efoNummer: mangler.efoNummer,
      })
      .from(mangler)
      .where(and(eq(mangler.tenantId, okt.tenantId), eq(mangler.prosjektId, rad.prosjektId)))
      .orderBy(asc(mangler.opprettet)),
    hentBilder(okt.tenantId, rad.prosjektId),
  ]);

  return {
    ...beriket,
    adkomst: adk
      ? {
          nokkelkode: adk.nokkelkode,
          kontaktperson: adk.kontaktperson,
          kontakttelefon: adk.kontakttelefon,
          parkering: adk.parkering,
          merknad: adk.merknad,
        }
      : null,
    medbring: pakke.map((p) => ({
      id: p.id,
      tekst: p.tekst,
      antall: p.antall,
      enhet: p.enhet,
      pakket: p.pakket,
      fraMangel: p.mangelId !== null,
    })),
    mangler: mangel,
    bilder,
  };
}

/** Det lederen trenger for å planlegge: ansatte, prosjekter, og hva som alt finnes. */
export async function hentPlanleggingsgrunnlag(okt: Okt, prosjektId: string) {
  const prosjekt = await db.query.prosjekter.findFirst({
    where: and(eq(prosjekter.id, prosjektId), eq(prosjekter.tenantId, okt.tenantId)),
  });
  if (!prosjekt) return null;

  const [mangel, bilder] = await Promise.all([
    db
      .select({
        id: mangler.id,
        tekst: mangler.tekst,
        antall: mangler.antall,
        enhet: mangler.enhet,
        bestilt: mangler.bestilt,
        efoNummer: mangler.efoNummer,
      })
      .from(mangler)
      .where(and(eq(mangler.tenantId, okt.tenantId), eq(mangler.prosjektId, prosjektId)))
      .orderBy(asc(mangler.opprettet)),
    hentBilder(okt.tenantId, prosjektId),
  ]);

  return { prosjekt, mangler: mangel, bilder };
}

/** Montørene man kan sette opp, med fargen de får i kalenderen. */
export async function hentMontorvalg(okt: Okt) {
  return db
    .select({
      id: ansatte.id,
      navn: ansatte.navn,
      initialer: ansatte.initialer,
      farge: ansatte.farge,
      avdeling: ansatte.avdeling,
    })
    .from(ansatte)
    .where(and(eq(ansatte.tenantId, okt.tenantId), eq(ansatte.aktiv, true)))
    .orderBy(asc(ansatte.navn));
}

/** Prosjektene man kan sette folk på. */
export async function hentProsjektvalg(okt: Okt) {
  return db
    .select({
      id: prosjekter.id,
      nummer: prosjekter.nummer,
      navn: prosjekter.navn,
      adresse: prosjekter.adresse,
      avdeling: prosjekter.avdeling,
    })
    .from(prosjekter)
    .where(and(eq(prosjekter.tenantId, okt.tenantId), eq(prosjekter.aktiv, true)))
    .orderBy(asc(prosjekter.nummer));
}
