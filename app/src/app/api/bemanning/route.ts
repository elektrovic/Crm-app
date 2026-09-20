/**
 * Bemanning: fargekode og initialer per ansatt.
 *
 * Kun leder og admin. En montør skal ikke kunne endre sin egen eller andres
 * oppføring herfra.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { ansatte } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { krevRolle } from "@/lib/tilgang";
import { loggEndring } from "@/lib/endringslogg";

const Skjema = z.object({
  id: z.uuid(),
  /** Heksadesimal farge, seks siffer. */
  farge: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Fargen må være på formen #RRGGBB")
    .optional(),
  initialer: z.string().min(1).max(4).optional(),
  abaxVehicleId: z.string().max(120).nullish(),
});

export const PATCH = endepunkt(Skjema, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const rad = await db.query.ansatte.findFirst({
    where: and(eq(ansatte.id, data.id), eq(ansatte.tenantId, okt.tenantId)),
  });
  if (!rad) {
    return NextResponse.json({ feil: "Ukjent ansatt." }, { status: 404 });
  }

  const endringer: Record<string, unknown> = {};
  if (data.farge !== undefined) endringer.farge = data.farge.toUpperCase();
  if (data.initialer !== undefined) endringer.initialer = data.initialer.toUpperCase();
  if (data.abaxVehicleId !== undefined) endringer.abaxVehicleId = data.abaxVehicleId;

  if (Object.keys(endringer).length === 0) {
    return NextResponse.json({ feil: "Ingenting å endre." }, { status: 400 });
  }

  await db.update(ansatte).set(endringer).where(eq(ansatte.id, rad.id));

  await loggEndring(okt, {
    handling: "bemanning.endret",
    tabell: "ansatte",
    radId: rad.id,
    for: { farge: rad.farge, initialer: rad.initialer, abaxVehicleId: rad.abaxVehicleId },
    etter: endringer,
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad.id, ...endringer });
});
