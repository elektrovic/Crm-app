/**
 * Brukere: opprette, endre rolle og avdeling, og gi nytt passord.
 *
 * Bare admin. En leder kan styre sin egen avdeling i resten av systemet,
 * men å dele ut tilganger er noe annet enn å planlegge en uke — den som
 * kan lage brukere kan lage seg selv en ny med admin.
 *
 * Passordet vises nøyaktig én gang: i svaret når det lages. Det lagres
 * aldri, hverken i klartekst eller i loggen, og kan ikke hentes fram
 * igjen. Mistes det, lages et nytt.
 */
import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { ansatte, AVDELINGER, ROLLER } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";
import { foreslaPassord, lagHash } from "@/lib/passord";
import { krevRolle } from "@/lib/tilgang";

/** Initialer fra navnet, når lederen ikke skriver dem selv. */
function initialerFra(navn: string): string {
  const ord = navn.trim().split(/\s+/).filter(Boolean);
  const forste = ord[0]?.[0] ?? "?";
  const siste = ord.length > 1 ? (ord[ord.length - 1]?.[0] ?? "") : "";
  return (forste + siste).toUpperCase().slice(0, 2);
}

/** Fargene brukerne får i kalenderen, i tur og orden. */
const FARGER = [
  "#2563EB",
  "#0F766E",
  "#A855F7",
  "#F97316",
  "#DC2626",
  "#0EA5E9",
  "#65A30D",
  "#DB2777",
];

const Ny = z.object({
  navn: z.string().trim().min(2, "Skriv hele navnet.").max(120),
  epost: z.string().trim().toLowerCase().pipe(z.email("Ugyldig e-post.")).pipe(z.string().max(200)),
  rolle: z.enum(ROLLER).default("montor"),
  avdeling: z.enum(AVDELINGER),
  initialer: z.string().trim().max(3).nullish(),
});

export const POST = endepunkt(Ny, async ({ okt, data, request }) => {
  await krevRolle("admin");

  const finnes = await db.query.ansatte.findFirst({
    where: and(eq(ansatte.tenantId, okt.tenantId), eq(ansatte.epost, data.epost)),
    columns: { id: true },
  });
  if (finnes) {
    return NextResponse.json({ feil: "Det finnes alt en bruker med denne e-posten." }, { status: 409 });
  }

  const antall = await db.$count(ansatte, eq(ansatte.tenantId, okt.tenantId));
  const passord = foreslaPassord();

  const [rad] = await db
    .insert(ansatte)
    .values({
      tenantId: okt.tenantId,
      navn: data.navn,
      epost: data.epost,
      rolle: data.rolle,
      avdeling: data.avdeling,
      initialer: data.initialer?.toUpperCase() || initialerFra(data.navn),
      farge: FARGER[antall % FARGER.length] ?? "#2563EB",
      passordHash: await lagHash(passord),
      maaByttePassord: true,
    })
    .returning({ id: ansatte.id, navn: ansatte.navn, epost: ansatte.epost });

  await loggEndring(okt, {
    handling: "bruker.opprettet",
    tabell: "ansatte",
    radId: rad?.id,
    // Passordet står ikke her. Loggen leses av flere enn den som lagde det.
    etter: { navn: data.navn, epost: data.epost, rolle: data.rolle, avdeling: data.avdeling },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ ...rad, passord });
});

const Endring = z.object({
  id: z.uuid(),
  rolle: z.enum(ROLLER).optional(),
  avdeling: z.enum(AVDELINGER).optional(),
  aktiv: z.boolean().optional(),
  navn: z.string().trim().min(2).max(120).optional(),
  initialer: z.string().trim().min(1).max(3).optional(),
  /** Sant gir brukeren et nytt midlertidig passord, som kommer i svaret. */
  nyttPassord: z.literal(true).optional(),
});

export const PATCH = endepunkt(Endring, async ({ okt, data, request }) => {
  await krevRolle("admin");

  const rad = await db.query.ansatte.findFirst({
    where: and(eq(ansatte.id, data.id), eq(ansatte.tenantId, okt.tenantId)),
  });
  if (!rad) return NextResponse.json({ feil: "Ukjent bruker." }, { status: 404 });

  const endringer: Record<string, unknown> = {};
  if (data.navn !== undefined) endringer.navn = data.navn;
  if (data.initialer !== undefined) endringer.initialer = data.initialer.toUpperCase();
  if (data.avdeling !== undefined) endringer.avdeling = data.avdeling;

  // To regler som begge handler om det samme: systemet skal aldri kunne
  // ende opp uten noen som slipper inn. Den som er logget inn kan ikke
  // frata seg selv admin eller sperre seg selv ute, og den siste aktive
  // administratoren kan ikke fjernes av noen.
  const roreSegSelv = rad.id === okt.id;
  const misterAdmin = data.rolle !== undefined && data.rolle !== "admin" && rad.rolle === "admin";
  const blirSperret = data.aktiv === false;

  if (roreSegSelv && (misterAdmin || blirSperret)) {
    return NextResponse.json(
      { feil: "Du kan ikke ta fra deg selv tilgangen. Be en annen administrator gjøre det." },
      { status: 400 },
    );
  }

  if ((misterAdmin || blirSperret) && rad.rolle === "admin") {
    const andre = await db.$count(
      ansatte,
      and(
        eq(ansatte.tenantId, okt.tenantId),
        eq(ansatte.rolle, "admin"),
        eq(ansatte.aktiv, true),
        ne(ansatte.id, rad.id),
      ),
    );
    if (andre === 0) {
      return NextResponse.json(
        { feil: "Dette er den siste administratoren. Gi noen andre admin først." },
        { status: 400 },
      );
    }
  }

  if (data.rolle !== undefined) endringer.rolle = data.rolle;
  if (data.aktiv !== undefined) endringer.aktiv = data.aktiv;

  let passord: string | null = null;
  if (data.nyttPassord) {
    passord = foreslaPassord();
    endringer.passordHash = await lagHash(passord);
    endringer.maaByttePassord = true;
  }

  if (Object.keys(endringer).length === 0) {
    return NextResponse.json({ feil: "Ingenting å endre." }, { status: 400 });
  }

  await db.update(ansatte).set(endringer).where(eq(ansatte.id, rad.id));

  await loggEndring(okt, {
    handling: data.nyttPassord ? "bruker.nytt_passord" : "bruker.endret",
    tabell: "ansatte",
    radId: rad.id,
    for: { rolle: rad.rolle, avdeling: rad.avdeling, aktiv: rad.aktiv },
    etter: {
      rolle: data.rolle,
      avdeling: data.avdeling,
      aktiv: data.aktiv,
      navn: data.navn,
      // Igjen: aldri passordet selv.
      fikkNyttPassord: Boolean(data.nyttPassord),
    },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad.id, passord });
});
