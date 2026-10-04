/**
 * Oppslag for CRM-flaten.
 *
 * Alt filtreres på tenantId, som resten av systemet. Disse spørringene er
 * bare tilgjengelige bak `krevRolle("leder")` — se admin-layouten og
 * rutene som kaller dem.
 */
import "server-only";
import { and, asc, desc, eq, gte, isNull, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  ansatte,
  garantier,
  henvendelser,
  kundehistorikk,
  kunder,
  oppfolginger,
  prosjekter,
  reklamasjoner,
  type Kanal,
  type PipelineTrinn,
} from "@/db/schema";
import type { Okt } from "../tilgang";
import type { Oppfolgingsrad } from "../crm/frister";

export async function hentOppfolginger(okt: Okt): Promise<Oppfolgingsrad[]> {
  const rader = await db
    .select({
      id: oppfolginger.id,
      hva: oppfolginger.hva,
      frist: oppfolginger.frist,
      fullfort: oppfolginger.fullfort,
      ansvarlig: oppfolginger.ansvarlig,
      ansvarligNavn: ansatte.navn,
      kundeNavn: kunder.navn,
    })
    .from(oppfolginger)
    .leftJoin(ansatte, eq(oppfolginger.ansvarlig, ansatte.id))
    .leftJoin(kunder, eq(oppfolginger.kundeId, kunder.id))
    .where(and(eq(oppfolginger.tenantId, okt.tenantId), eq(oppfolginger.fullfort, false)));

  return rader;
}

export type PipelineKort = {
  id: string;
  trinn: PipelineTrinn;
  kanal: Kanal;
  kundeNavn: string | null;
  avsenderNavn: string | null;
  innhold: string;
  sum: number | null;
  mottatt: Date;
  aiHastegrad: string | null;
  ansvarligNavn: string | null;
  /** Finnes det en åpen oppfølging på saken? Styrer om vi spør om én. */
  harNesteSteg: boolean;
  kundeId: string | null;
  prosjektId: string | null;
};

export async function hentPipeline(okt: Okt): Promise<PipelineKort[]> {
  const rader = await db
    .select({
      id: henvendelser.id,
      trinn: henvendelser.trinn,
      kanal: henvendelser.kanal,
      kundeNavn: kunder.navn,
      avsenderNavn: henvendelser.avsenderNavn,
      innhold: henvendelser.innhold,
      sum: henvendelser.sum,
      mottatt: henvendelser.mottatt,
      aiHastegrad: henvendelser.aiHastegrad,
      ansvarligNavn: ansatte.navn,
      kundeId: henvendelser.kundeId,
      prosjektId: henvendelser.prosjektId,
      harNesteSteg: sql<boolean>`exists (
        select 1 from ${oppfolginger}
        where ${oppfolginger.henvendelseId} = ${henvendelser.id}
          and ${oppfolginger.fullfort} = false
      )`,
    })
    .from(henvendelser)
    .leftJoin(kunder, eq(henvendelser.kundeId, kunder.id))
    .leftJoin(ansatte, eq(henvendelser.ansvarlig, ansatte.id))
    .where(eq(henvendelser.tenantId, okt.tenantId))
    .orderBy(desc(henvendelser.mottatt));

  return rader.map((r) => ({
    ...r,
    sum: r.sum === null ? null : Number(r.sum),
    harNesteSteg: Boolean(r.harNesteSteg),
  }));
}

/** Henvendelser til innboksen, nyeste først. */
export async function hentHenvendelser(okt: Okt) {
  return db
    .select({
      id: henvendelser.id,
      kanal: henvendelser.kanal,
      mottatt: henvendelser.mottatt,
      innhold: henvendelser.innhold,
      avsenderNavn: henvendelser.avsenderNavn,
      avsenderTelefon: henvendelser.avsenderTelefon,
      avsenderEpost: henvendelser.avsenderEpost,
      trinn: henvendelser.trinn,
      aiSammendrag: henvendelser.aiSammendrag,
      aiKategori: henvendelser.aiKategori,
      aiHastegrad: henvendelser.aiHastegrad,
      aiVurdert: henvendelser.aiVurdert,
      aiModell: henvendelser.aiModell,
    })
    .from(henvendelser)
    .where(eq(henvendelser.tenantId, okt.tenantId))
    .orderBy(desc(henvendelser.mottatt))
    .limit(200);
}

export async function hentKunder(okt: Okt) {
  const rader = await db
    .select({
      id: kunder.id,
      navn: kunder.navn,
      type: kunder.type,
      avdeling: kunder.avdeling,
      status: kunder.status,
      kontaktperson: kunder.kontaktperson,
      telefon: kunder.telefon,
      epost: kunder.epost,
      omsetning: kunder.omsetning,
      omsetningSynket: kunder.omsetningSynket,
      // Telles med en join, ikke en underspørring.
      //
      // Underspørringen som sto her ble til «where "kunde_id" = "id"» —
      // uten tabellnavn. Inne i underspørringen betyr «id» prosjektets
      // egen id, så den sammenlignet prosjekter.kunde_id med
      // prosjekter.id og ga null på hver eneste kunde. Den var stille:
      // spørringen kjørte fint, tallet var bare alltid feil.
      antallProsjekter: sql<number>`count(${prosjekter.id})`.mapWith(Number),
    })
    .from(kunder)
    .leftJoin(prosjekter, eq(prosjekter.kundeId, kunder.id))
    .where(eq(kunder.tenantId, okt.tenantId))
    .groupBy(kunder.id)
    .orderBy(kunder.navn);

  return rader.map((r) => ({
    ...r,
    omsetning: r.omsetning === null ? null : Number(r.omsetning),
  }));
}

export async function hentReklamasjoner(okt: Okt) {
  const rader = await db
    .select({
      id: reklamasjoner.id,
      saksnummer: reklamasjoner.saksnummer,
      kundeNavn: kunder.navn,
      mottatt: reklamasjoner.mottatt,
      frist: reklamasjoner.frist,
      beskrivelse: reklamasjoner.beskrivelse,
      status: reklamasjoner.status,
      kostnad: reklamasjoner.kostnad,
      ansvarligNavn: ansatte.navn,
    })
    .from(reklamasjoner)
    .innerJoin(kunder, eq(reklamasjoner.kundeId, kunder.id))
    .leftJoin(ansatte, eq(reklamasjoner.ansvarlig, ansatte.id))
    .where(eq(reklamasjoner.tenantId, okt.tenantId))
    .orderBy(desc(reklamasjoner.mottatt));

  return rader.map((r) => ({
    ...r,
    kostnad: r.kostnad === null ? null : Number(r.kostnad),
  }));
}

export async function hentGarantier(okt: Okt) {
  return db
    .select({
      id: garantier.id,
      kundeNavn: kunder.navn,
      kundeTelefon: kunder.telefon,
      utfort: garantier.utfort,
      utfortDato: garantier.utfortDato,
      garantiUtloper: garantier.garantiUtloper,
      anbefaling: garantier.anbefaling,
      kontaktesEtter: garantier.kontaktesEtter,
      kontaktet: garantier.kontaktet,
    })
    .from(garantier)
    .innerJoin(kunder, eq(garantier.kundeId, kunder.id))
    .where(eq(garantier.tenantId, okt.tenantId))
    .orderBy(garantier.kontaktesEtter);
}

export async function hentKundehistorikk(okt: Okt, kundeId: string) {
  return db
    .select()
    .from(kundehistorikk)
    .where(and(eq(kundehistorikk.tenantId, okt.tenantId), eq(kundehistorikk.kundeId, kundeId)))
    .orderBy(desc(kundehistorikk.dato))
    .limit(50);
}

/** Tallene på dashbordet. */
export async function hentDashboardtall(okt: Okt) {
  const [apneOppfolginger] = await db
    .select({ antall: sql<number>`count(*)`.mapWith(Number) })
    .from(oppfolginger)
    .where(and(eq(oppfolginger.tenantId, okt.tenantId), eq(oppfolginger.fullfort, false)));

  const [ufordelte] = await db
    .select({ antall: sql<number>`count(*)`.mapWith(Number) })
    .from(oppfolginger)
    .where(
      and(
        eq(oppfolginger.tenantId, okt.tenantId),
        eq(oppfolginger.fullfort, false),
        isNull(oppfolginger.ansvarlig),
      ),
    );

  const [nyeHenvendelser] = await db
    .select({ antall: sql<number>`count(*)`.mapWith(Number) })
    .from(henvendelser)
    .where(and(eq(henvendelser.tenantId, okt.tenantId), eq(henvendelser.trinn, "ny")));

  const [apneReklamasjoner] = await db
    .select({ antall: sql<number>`count(*)`.mapWith(Number) })
    .from(reklamasjoner)
    .where(
      and(
        eq(reklamasjoner.tenantId, okt.tenantId),
        sql`${reklamasjoner.status} <> 'lukket'`,
      ),
    );

  return {
    apneOppfolginger: apneOppfolginger?.antall ?? 0,
    ufordelte: ufordelte?.antall ?? 0,
    nyeHenvendelser: nyeHenvendelser?.antall ?? 0,
    apneReklamasjoner: apneReklamasjoner?.antall ?? 0,
  };
}

export type CrmNokkeltall = {
  nyeSyvDager: number;
  ubesvartOverDognet: number;
  apneReklamasjoner: number;
  reklamasjonerOverFrist: number;
  tilbudUte: number;
  antallTilbud: number;
  gjenkjopKlare: number;
};

/**
 * De fem kortene øverst i CRM-en.
 *
 * «Ubesvart over 24 t» teller bare henvendelser som fortsatt står på
 * `ny`. Har noen tatt tak i den, er den ikke ubesvart lenger, uansett hvor
 * gammel den er.
 */
export async function hentCrmNokkeltall(okt: Okt, iDag: string): Promise<CrmNokkeltall> {
  const syvDager = new Date(Date.now() - 7 * 86_400_000);
  const etDognSiden = new Date(Date.now() - 86_400_000);

  const [nye] = await db
    .select({ antall: sql<number>`count(*)`.mapWith(Number) })
    .from(henvendelser)
    .where(
      // gte, ikke en sql-streng: da vet driveren at kolonnen er et
      // tidspunkt og oversetter Date-objektet riktig.
      and(eq(henvendelser.tenantId, okt.tenantId), gte(henvendelser.mottatt, syvDager)),
    );

  const [ubesvart] = await db
    .select({ antall: sql<number>`count(*)`.mapWith(Number) })
    .from(henvendelser)
    .where(
      and(
        eq(henvendelser.tenantId, okt.tenantId),
        eq(henvendelser.trinn, "ny"),
        lt(henvendelser.mottatt, etDognSiden),
      ),
    );

  const [rek] = await db
    .select({
      apne: sql<number>`count(*)`.mapWith(Number),
      overFrist: sql<number>`count(*) filter (where ${reklamasjoner.frist} is not null and ${reklamasjoner.frist} < ${iDag})`.mapWith(
        Number,
      ),
    })
    .from(reklamasjoner)
    .where(and(eq(reklamasjoner.tenantId, okt.tenantId), sql`${reklamasjoner.status} <> 'lukket'`));

  const [tilbud] = await db
    .select({
      sum: sql<number>`coalesce(sum(${henvendelser.sum}), 0)`.mapWith(Number),
      antall: sql<number>`count(*)`.mapWith(Number),
    })
    .from(henvendelser)
    .where(and(eq(henvendelser.tenantId, okt.tenantId), eq(henvendelser.trinn, "tilbud_sendt")));

  const [gjenkjop] = await db
    .select({ antall: sql<number>`count(*)`.mapWith(Number) })
    .from(garantier)
    .where(
      and(
        eq(garantier.tenantId, okt.tenantId),
        eq(garantier.kontaktet, false),
        sql`${garantier.kontaktesEtter} is not null and ${garantier.kontaktesEtter} <= ${iDag}`,
      ),
    );

  return {
    nyeSyvDager: nye?.antall ?? 0,
    ubesvartOverDognet: ubesvart?.antall ?? 0,
    apneReklamasjoner: rek?.apne ?? 0,
    reklamasjonerOverFrist: rek?.overFrist ?? 0,
    tilbudUte: tilbud?.sum ?? 0,
    antallTilbud: tilbud?.antall ?? 0,
    gjenkjopKlare: gjenkjop?.antall ?? 0,
  };
}

/** Navnelista til nedtrekkene: hvem en sak kan fordeles til. */
export async function hentAnsattvalg(okt: Okt) {
  return db
    .select({ id: ansatte.id, navn: ansatte.navn })
    .from(ansatte)
    .where(and(eq(ansatte.tenantId, okt.tenantId), eq(ansatte.aktiv, true)))
    .orderBy(ansatte.navn);
}

/** Kundelista til nedtrekkene. */
export async function hentKundevalg(okt: Okt) {
  return db
    .select({ id: kunder.id, navn: kunder.navn })
    .from(kunder)
    .where(eq(kunder.tenantId, okt.tenantId))
    .orderBy(kunder.navn);
}

/* ------------------------------------------------- det som glipper */

export type Glipp = {
  id: string;
  hva: string;
  hvem: string | null;
  kundeId: string | null;
  kunde: string | null;
  trinn: string;
  dager: number;
};

/**
 * Henvendelser uten et neste steg.
 *
 * Dette er den ene spørringen CRM-en egentlig handler om. En henvendelse
 * som verken er vunnet eller tapt, og som ingen har satt en frist på, er
 * en jobb som holder på å bli glemt. Den ser helt i orden ut i lista —
 * den står bare der, og ingen har sagt når noe skal skje.
 *
 * Alt annet i systemet kan man finne hvis man leter. Denne finner man
 * bare hvis noen spør etter den.
 */
export async function hentUtenNesteSteg(okt: Okt, iDag: string): Promise<Glipp[]> {
  const apenOppfolging = db
    .select({ n: sql<number>`1` })
    .from(oppfolginger)
    .where(
      and(
        eq(oppfolginger.henvendelseId, henvendelser.id),
        eq(oppfolginger.fullfort, false),
      ),
    );

  const rader = await db
    .select({
      id: henvendelser.id,
      innhold: henvendelser.innhold,
      avsenderNavn: henvendelser.avsenderNavn,
      trinn: henvendelser.trinn,
      mottatt: henvendelser.mottatt,
      kundeId: henvendelser.kundeId,
      kunde: kunder.navn,
      ansvarlig: ansatte.navn,
    })
    .from(henvendelser)
    .leftJoin(kunder, eq(henvendelser.kundeId, kunder.id))
    .leftJoin(ansatte, eq(henvendelser.ansvarlig, ansatte.id))
    .where(
      and(
        eq(henvendelser.tenantId, okt.tenantId),
        notInArray(henvendelser.trinn, ["vunnet", "tapt"]),
        sql`not exists (${apenOppfolging})`,
      ),
    )
    .orderBy(asc(henvendelser.mottatt));

  const naa = new Date(`${iDag}T00:00:00Z`).getTime();
  return rader.map((r) => ({
    id: r.id,
    hva: r.avsenderNavn ?? kortTekst(r.innhold),
    hvem: r.ansvarlig,
    kundeId: r.kundeId,
    kunde: r.kunde,
    trinn: r.trinn,
    dager: Math.max(0, Math.floor((naa - r.mottatt.getTime()) / 86_400_000)),
  }));
}

/** Første setning, til når en henvendelse ikke har avsendernavn. */
function kortTekst(tekst: string, maks = 70): string {
  const ren = tekst.replace(/\s+/g, " ").trim();
  return ren.length <= maks ? ren : `${ren.slice(0, maks - 1)}…`;
}

export type StilleKunde = {
  id: string;
  navn: string;
  status: string;
  sisteKontakt: Date | null;
  dager: number | null;
};

/**
 * Kunder det er blitt stille rundt.
 *
 * «Siste kontakt» er det seneste av alt vi vet: en henvendelse, en
 * oppfølging som ble gjort, en linje i historikken. Er det lenge siden,
 * betyr det ikke nødvendigvis noe galt — men det er det ingen andre
 * skjermer forteller deg.
 */
export async function hentStilleKunder(
  okt: Okt,
  minstDager = 60,
  antall = 8,
): Promise<StilleKunde[]> {
  const rader = await db
    .select({
      id: kunder.id,
      navn: kunder.navn,
      status: kunder.status,
      sisteHenvendelse: sql<Date | null>`(
        select max(${henvendelser.mottatt}) from ${henvendelser}
        where ${henvendelser.kundeId} = ${kunder.id}
      )`,
      sisteHistorikk: sql<string | null>`(
        select max(${kundehistorikk.dato}) from ${kundehistorikk}
        where ${kundehistorikk.kundeId} = ${kunder.id}
      )`,
      sisteOppfolging: sql<Date | null>`(
        select max(${oppfolginger.fullfortTidspunkt}) from ${oppfolginger}
        where ${oppfolginger.kundeId} = ${kunder.id}
      )`,
    })
    .from(kunder)
    .where(and(eq(kunder.tenantId, okt.tenantId), notInArray(kunder.status, ["tapt", "inaktiv"])));

  const naa = Date.now();
  return rader
    .map((r) => {
      const tider = [
        r.sisteHenvendelse ? new Date(r.sisteHenvendelse).getTime() : null,
        r.sisteHistorikk ? new Date(`${r.sisteHistorikk}T00:00:00Z`).getTime() : null,
        r.sisteOppfolging ? new Date(r.sisteOppfolging).getTime() : null,
      ].filter((t): t is number => t !== null && !Number.isNaN(t));

      const siste = tider.length ? Math.max(...tider) : null;
      return {
        id: r.id,
        navn: r.navn,
        status: r.status,
        sisteKontakt: siste ? new Date(siste) : null,
        dager: siste === null ? null : Math.floor((naa - siste) / 86_400_000),
      };
    })
    // Kunder vi aldri har registrert kontakt med er mest påfallende av alle,
    // så de sorteres øverst og ikke bort.
    .filter((k) => k.dager === null || k.dager >= minstDager)
    .sort((a, b) => (b.dager ?? Number.MAX_SAFE_INTEGER) - (a.dager ?? Number.MAX_SAFE_INTEGER))
    .slice(0, antall);
}

/* --------------------------------------------- alt om én kunde */

export type Tidslinjehendelse = {
  id: string;
  slag: "henvendelse" | "prosjekt" | "reklamasjon" | "garanti" | "oppfolging" | "notat";
  dato: Date;
  tittel: string;
  detalj: string | null;
  farge: string;
  /** Peker videre dit saken hører hjemme, når det finnes et sted. */
  lenke: string | null;
};

const FARGE: Record<Tidslinjehendelse["slag"], string> = {
  henvendelse: "#2563EB",
  prosjekt: "#0F766E",
  reklamasjon: "#DC2626",
  garanti: "#A855F7",
  oppfolging: "#F97316",
  notat: "#64748B",
};

/**
 * Alt vi vet om én kunde, i én tidslinje.
 *
 * Dette er hele poenget med et kunderegister. Det som gjør at du husker,
 * er ikke fem lister — det er å se at henvendelsen i mars ble til
 * prosjektet i april, som fikk reklamasjonen i juni. Hver av de tre står
 * i hver sin tabell, og sammenhengen finnes bare når de legges etter
 * hverandre i tid.
 *
 * Sorteringen gjøres her og ikke i databasen. Kildene har ulike
 * datotyper — noen tidsstempel, noen ISO-datoer — og å presse dem inn i
 * én spørring ville gjort den vanskeligere å lese enn den er verdt.
 */
export async function hentKundetidslinje(
  okt: Okt,
  kundeId: string,
): Promise<Tidslinjehendelse[]> {
  const t = okt.tenantId;

  const [hv, pr, rek, gar, opp, hist] = await Promise.all([
    db
      .select({
        id: henvendelser.id,
        mottatt: henvendelser.mottatt,
        kanal: henvendelser.kanal,
        trinn: henvendelser.trinn,
        innhold: henvendelser.innhold,
      })
      .from(henvendelser)
      .where(and(eq(henvendelser.tenantId, t), eq(henvendelser.kundeId, kundeId))),

    db
      .select({
        id: prosjekter.id,
        nummer: prosjekter.nummer,
        navn: prosjekter.navn,
        sistSynket: prosjekter.sistSynket,
        aktiv: prosjekter.aktiv,
      })
      .from(prosjekter)
      .where(and(eq(prosjekter.tenantId, t), eq(prosjekter.kundeId, kundeId))),

    db
      .select({
        id: reklamasjoner.id,
        saksnummer: reklamasjoner.saksnummer,
        beskrivelse: reklamasjoner.beskrivelse,
        status: reklamasjoner.status,
        opprettet: reklamasjoner.opprettet,
      })
      .from(reklamasjoner)
      .where(and(eq(reklamasjoner.tenantId, t), eq(reklamasjoner.kundeId, kundeId))),

    db
      .select({
        id: garantier.id,
        utfort: garantier.utfort,
        utfortDato: garantier.utfortDato,
        kontaktet: garantier.kontaktet,
      })
      .from(garantier)
      .where(and(eq(garantier.tenantId, t), eq(garantier.kundeId, kundeId))),

    db
      .select({
        id: oppfolginger.id,
        hva: oppfolginger.hva,
        frist: oppfolginger.frist,
        fullfort: oppfolginger.fullfort,
        fullfortTidspunkt: oppfolginger.fullfortTidspunkt,
      })
      .from(oppfolginger)
      .where(and(eq(oppfolginger.tenantId, t), eq(oppfolginger.kundeId, kundeId))),

    db
      .select({
        id: kundehistorikk.id,
        hendelse: kundehistorikk.hendelse,
        dato: kundehistorikk.dato,
        farge: kundehistorikk.farge,
      })
      .from(kundehistorikk)
      .where(and(eq(kundehistorikk.tenantId, t), eq(kundehistorikk.kundeId, kundeId))),
  ]);

  const ut: Tidslinjehendelse[] = [
    ...hv.map((h) => ({
      id: h.id,
      slag: "henvendelse" as const,
      dato: h.mottatt,
      tittel: `Henvendelse på ${h.kanal}`,
      detalj: h.innhold,
      farge: FARGE.henvendelse,
      lenke: "/admin/crm/pipeline",
    })),

    // Prosjekter har ingen opprettetdato hos oss — de kommer fra Tripletex.
    // Vi bruker tidspunktet vi først så dem, og sier ikke at det er noe annet.
    ...pr
      .filter((p) => p.sistSynket !== null)
      .map((p) => ({
        id: p.id,
        slag: "prosjekt" as const,
        dato: p.sistSynket as Date,
        tittel: `Prosjekt ${p.nummer}`,
        detalj: p.aktiv ? p.navn : `${p.navn} (avsluttet)`,
        farge: FARGE.prosjekt,
        lenke: `/prosjekt/${p.nummer}`,
      })),

    ...rek.map((r) => ({
      id: r.id,
      slag: "reklamasjon" as const,
      dato: r.opprettet,
      tittel: `Reklamasjon ${r.saksnummer}`,
      detalj: `${r.beskrivelse} · ${r.status.replace(/_/g, " ")}`,
      farge: FARGE.reklamasjon,
      lenke: "/admin/crm/reklamasjoner",
    })),

    ...gar.map((g) => ({
      id: g.id,
      slag: "garanti" as const,
      dato: new Date(`${g.utfortDato}T00:00:00Z`),
      tittel: "Utført arbeid",
      detalj: g.kontaktet ? `${g.utfort} · kunden er ringt` : g.utfort,
      farge: FARGE.garanti,
      lenke: "/admin/crm/garanti",
    })),

    ...opp.map((o) => ({
      id: o.id,
      slag: "oppfolging" as const,
      // Gjort: når den ble gjort. Ikke gjort: når den skal gjøres.
      dato: o.fullfortTidspunkt ?? new Date(`${o.frist}T00:00:00Z`),
      tittel: o.fullfort ? "Oppfølging gjort" : "Oppfølging med frist",
      detalj: o.hva,
      farge: FARGE.oppfolging,
      lenke: "/admin/crm",
    })),

    ...hist.map((h) => ({
      id: h.id,
      slag: "notat" as const,
      dato: new Date(`${h.dato}T00:00:00Z`),
      tittel: h.hendelse,
      detalj: null,
      farge: h.farge || FARGE.notat,
      lenke: null,
    })),
  ];

  return ut
    .filter((h) => !Number.isNaN(h.dato.getTime()))
    .sort((a, b) => b.dato.getTime() - a.dato.getTime());
}

/** Én kunde, med feltene kortet trenger. */
export async function hentKunde(okt: Okt, kundeId: string) {
  return db.query.kunder.findFirst({
    where: and(eq(kunder.id, kundeId), eq(kunder.tenantId, okt.tenantId)),
  });
}

/* ------------------------------------------------------ uka */

export type Ukesoppsummering = {
  inn: number;
  vunnet: number;
  tapt: number;
  gjort: number;
  nyeReklamasjoner: number;
  lukkedeReklamasjoner: number;
  /** Frister denne uka som ennå ikke er gjort. */
  staarIgjen: { id: string; hva: string; frist: string; hvem: string | null }[];
  /** Det som faktisk ble gjort, til å lese fredag ettermiddag. */
  gjortListe: { id: string; hva: string; naar: Date; hvem: string | null }[];
};

/**
 * Uka som ble, og det som står igjen.
 *
 * Denne finnes fordi fredag ettermiddag er det eneste tidspunktet man
 * faktisk ser tilbake. Resten av uka ser man bare framover, og da er det
 * ingen som oppdager at noe har ligget stille i fem dager.
 */
export async function hentUkesoppsummering(
  okt: Okt,
  mandag: string,
  sondag: string,
): Promise<Ukesoppsummering> {
  const t = okt.tenantId;
  const fra = new Date(`${mandag}T00:00:00Z`);
  const til = new Date(`${sondag}T23:59:59Z`);

  const [inn, vunnet, tapt, nyeRek, lukkedeRek, frister, gjort] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(henvendelser)
      .where(
        and(
          eq(henvendelser.tenantId, t),
          gte(henvendelser.mottatt, fra),
          lt(henvendelser.mottatt, til),
        ),
      ),

    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(henvendelser)
      .where(and(eq(henvendelser.tenantId, t), eq(henvendelser.trinn, "vunnet"))),

    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(henvendelser)
      .where(and(eq(henvendelser.tenantId, t), eq(henvendelser.trinn, "tapt"))),

    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(reklamasjoner)
      .where(
        and(
          eq(reklamasjoner.tenantId, t),
          gte(reklamasjoner.opprettet, fra),
          lt(reklamasjoner.opprettet, til),
        ),
      ),

    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(reklamasjoner)
      .where(
        and(
          eq(reklamasjoner.tenantId, t),
          gte(reklamasjoner.lukket, fra),
          lt(reklamasjoner.lukket, til),
        ),
      ),

    db
      .select({
        id: oppfolginger.id,
        hva: oppfolginger.hva,
        frist: oppfolginger.frist,
        hvem: ansatte.navn,
      })
      .from(oppfolginger)
      .leftJoin(ansatte, eq(oppfolginger.ansvarlig, ansatte.id))
      .where(
        and(
          eq(oppfolginger.tenantId, t),
          eq(oppfolginger.fullfort, false),
          gte(oppfolginger.frist, mandag),
          lt(oppfolginger.frist, sondag),
        ),
      )
      .orderBy(asc(oppfolginger.frist)),

    db
      .select({
        id: oppfolginger.id,
        hva: oppfolginger.hva,
        naar: oppfolginger.fullfortTidspunkt,
        hvem: ansatte.navn,
      })
      .from(oppfolginger)
      .leftJoin(ansatte, eq(oppfolginger.ansvarlig, ansatte.id))
      .where(
        and(
          eq(oppfolginger.tenantId, t),
          eq(oppfolginger.fullfort, true),
          gte(oppfolginger.fullfortTidspunkt, fra),
          lt(oppfolginger.fullfortTidspunkt, til),
        ),
      )
      .orderBy(desc(oppfolginger.fullfortTidspunkt)),
  ]);

  return {
    inn: inn[0]?.n ?? 0,
    vunnet: vunnet[0]?.n ?? 0,
    tapt: tapt[0]?.n ?? 0,
    gjort: gjort.length,
    nyeReklamasjoner: nyeRek[0]?.n ?? 0,
    lukkedeReklamasjoner: lukkedeRek[0]?.n ?? 0,
    staarIgjen: frister,
    gjortListe: gjort
      .filter((g): g is typeof g & { naar: Date } => g.naar !== null)
      .map((g) => ({ id: g.id, hva: g.hva, naar: g.naar, hvem: g.hvem })),
  };
}
