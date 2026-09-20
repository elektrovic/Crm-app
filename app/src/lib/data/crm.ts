/**
 * Oppslag for CRM-flaten.
 *
 * Alt filtreres på tenantId, som resten av systemet. Disse spørringene er
 * bare tilgjengelige bak `krevRolle("leder")` — se admin-layouten og
 * rutene som kaller dem.
 */
import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
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
    })
    .from(henvendelser)
    .leftJoin(kunder, eq(henvendelser.kundeId, kunder.id))
    .leftJoin(ansatte, eq(henvendelser.ansvarlig, ansatte.id))
    .where(eq(henvendelser.tenantId, okt.tenantId))
    .orderBy(desc(henvendelser.mottatt));

  return rader.map((r) => ({ ...r, sum: r.sum === null ? null : Number(r.sum) }));
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
      // Antall prosjekter telles i spørringen framfor i grensesnittet, så
      // lista kan sorteres på det uten å hente alle prosjektene.
      antallProsjekter: sql<number>`(
        select count(*) from ${prosjekter}
        where ${prosjekter.kundeId} = ${kunder.id}
      )`.mapWith(Number),
    })
    .from(kunder)
    .where(eq(kunder.tenantId, okt.tenantId))
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
