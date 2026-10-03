/**
 * Oppfølginger: opprett, kryss av som gjort, og fordel til en ansvarlig.
 *
 * «Fullført» får både et flagg og et tidspunkt. Flagget er det lista
 * filtrerer på; tidspunktet er det noen spør om et halvår senere når det
 * er uenighet om når saken faktisk ble lukket.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { ansatte, oppfolginger } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { krevRolle } from "@/lib/tilgang";
import { loggEndring } from "@/lib/endringslogg";

const ISO_DATO = /^\d{4}-\d{2}-\d{2}$/;

const Ny = z.object({
  hva: z.string().trim().min(1, "Skriv hva som skal gjøres.").max(300),
  frist: z.string().regex(ISO_DATO, "Fristen må være en dato."),
  kundeId: z.uuid().nullish(),
  henvendelseId: z.uuid().nullish(),
  reklamasjonId: z.uuid().nullish(),
  ansvarlig: z.uuid().nullish(),
});

export const POST = endepunkt(Ny, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const [rad] = await db
    .insert(oppfolginger)
    .values({
      tenantId: okt.tenantId,
      hva: data.hva,
      frist: data.frist,
      kundeId: data.kundeId ?? null,
      henvendelseId: data.henvendelseId ?? null,
      reklamasjonId: data.reklamasjonId ?? null,
      ansvarlig: data.ansvarlig ?? null,
    })
    .returning();

  await loggEndring(okt, {
    handling: "oppfolging.opprettet",
    tabell: "oppfolginger",
    radId: rad?.id,
    etter: { hva: data.hva, frist: data.frist },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad?.id });
});

const Endre = z.object({
  id: z.uuid(),
  fullfort: z.boolean().optional(),
  /** null fordeler saken tilbake til ingen. */
  ansvarlig: z.uuid().nullish(),
  frist: z.string().regex(ISO_DATO).optional(),
});

export const PATCH = endepunkt(Endre, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const rad = await db.query.oppfolginger.findFirst({
    where: and(eq(oppfolginger.id, data.id), eq(oppfolginger.tenantId, okt.tenantId)),
  });
  if (!rad) return NextResponse.json({ feil: "Ukjent oppfølging." }, { status: 404 });

  const endringer: Record<string, unknown> = {};

  if (data.fullfort !== undefined) {
    endringer.fullfort = data.fullfort;
    // Tidspunktet settes når den krysses av, og fjernes om den gjenåpnes.
    endringer.fullfortTidspunkt = data.fullfort ? new Date() : null;
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

  if (data.frist !== undefined) endringer.frist = data.frist;

  if (Object.keys(endringer).length === 0) {
    return NextResponse.json({ feil: "Ingenting å endre." }, { status: 400 });
  }

  await db.update(oppfolginger).set(endringer).where(eq(oppfolginger.id, rad.id));

  await loggEndring(okt, {
    handling: "oppfolging.endret",
    tabell: "oppfolginger",
    radId: rad.id,
    for: { fullfort: rad.fullfort, ansvarlig: rad.ansvarlig, frist: rad.frist },
    etter: endringer,
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad.id });
});
