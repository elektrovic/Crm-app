/**
 * Reklamasjoner: opprett, oppdater status, og lukk med en løsning.
 *
 * Saksnummeret lages her i stedet for å skrives inn. To saker med samme
 * nummer er verre enn et nummer ingen liker, og nummeret er det folk viser
 * til i e-post og telefon.
 */
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { ansatte, reklamasjoner, REKLAMASJONSSTATUS } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { krevRolle } from "@/lib/tilgang";
import { loggEndring } from "@/lib/endringslogg";
import type { Okt } from "@/lib/tilgang";

const ISO_DATO = /^\d{4}-\d{2}-\d{2}$/;

/** «R-2026-015» — året saken kom inn, og et løpenummer innenfor året. */
async function nesteSaksnummer(okt: Okt, aar: string): Promise<string> {
  const [rad] = await db
    .select({ antall: sql<number>`count(*)`.mapWith(Number) })
    .from(reklamasjoner)
    .where(
      and(
        eq(reklamasjoner.tenantId, okt.tenantId),
        sql`${reklamasjoner.saksnummer} like ${"R-" + aar + "-%"}`,
      ),
    );
  return `R-${aar}-${String((rad?.antall ?? 0) + 1).padStart(3, "0")}`;
}

const Ny = z.object({
  kundeId: z.uuid(),
  beskrivelse: z.string().trim().min(1, "Beskriv hva reklamasjonen gjelder.").max(2000),
  mottatt: z.string().regex(ISO_DATO, "Mottatt må være en dato."),
  frist: z.string().regex(ISO_DATO).nullish(),
  prosjektId: z.uuid().nullish(),
  ansvarlig: z.uuid().nullish(),
  kostnad: z.number().nonnegative().nullish(),
});

export const POST = endepunkt(Ny, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const saksnummer = await nesteSaksnummer(okt, data.mottatt.slice(0, 4));

  const [rad] = await db
    .insert(reklamasjoner)
    .values({
      tenantId: okt.tenantId,
      saksnummer,
      kundeId: data.kundeId,
      prosjektId: data.prosjektId ?? null,
      mottatt: data.mottatt,
      frist: data.frist ?? null,
      beskrivelse: data.beskrivelse,
      ansvarlig: data.ansvarlig ?? null,
      kostnad: data.kostnad === null || data.kostnad === undefined ? null : String(data.kostnad),
    })
    .returning();

  await loggEndring(okt, {
    handling: "reklamasjon.opprettet",
    tabell: "reklamasjoner",
    radId: rad?.id,
    etter: { saksnummer, kundeId: data.kundeId },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad?.id, saksnummer });
});

const Endre = z.object({
  id: z.uuid(),
  status: z.enum(REKLAMASJONSSTATUS).optional(),
  ansvarlig: z.uuid().nullish(),
  frist: z.string().regex(ISO_DATO).nullish(),
  kostnad: z.number().nonnegative().nullish(),
  losning: z.string().trim().max(2000).nullish(),
});

export const PATCH = endepunkt(Endre, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const rad = await db.query.reklamasjoner.findFirst({
    where: and(eq(reklamasjoner.id, data.id), eq(reklamasjoner.tenantId, okt.tenantId)),
  });
  if (!rad) return NextResponse.json({ feil: "Ukjent reklamasjon." }, { status: 404 });

  const endringer: Record<string, unknown> = {};

  if (data.status !== undefined) {
    endringer.status = data.status;
    // Lukketidspunktet settes når saken lukkes og fjernes om den åpnes
    // igjen, så «lukket» og tidspunktet aldri sier hver sin ting.
    endringer.lukket = data.status === "lukket" ? new Date() : null;
  }
  if (data.frist !== undefined) endringer.frist = data.frist ?? null;
  if (data.losning !== undefined) endringer.losning = data.losning?.trim() || null;
  if (data.kostnad !== undefined) {
    endringer.kostnad = data.kostnad === null ? null : String(data.kostnad);
  }

  if (data.ansvarlig !== undefined) {
    if (data.ansvarlig) {
      const finnes = await db.query.ansatte.findFirst({
        where: and(eq(ansatte.id, data.ansvarlig), eq(ansatte.tenantId, okt.tenantId)),
        columns: { id: true },
      });
      if (!finnes) return NextResponse.json({ feil: "Ukjent ansatt." }, { status: 400 });
    }
    endringer.ansvarlig = data.ansvarlig ?? null;
  }

  if (Object.keys(endringer).length === 0) {
    return NextResponse.json({ feil: "Ingenting å endre." }, { status: 400 });
  }

  await db.update(reklamasjoner).set(endringer).where(eq(reklamasjoner.id, rad.id));

  await loggEndring(okt, {
    handling: "reklamasjon.endret",
    tabell: "reklamasjoner",
    radId: rad.id,
    for: { status: rad.status, ansvarlig: rad.ansvarlig, frist: rad.frist, kostnad: rad.kostnad },
    etter: endringer,
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad.id });
});
