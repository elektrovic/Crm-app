/**
 * Garanti og gjenkjøp: registrer utført arbeid, og kryss av når kunden er
 * ringt.
 *
 * Avkryssingen er hele poenget med fanen: uten den vet ingen hvem som
 * allerede er kontaktet, og kunden blir ringt to ganger eller ingen.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { garantier } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { krevRolle } from "@/lib/tilgang";
import { loggEndring } from "@/lib/endringslogg";

const ISO_DATO = /^\d{4}-\d{2}-\d{2}$/;

const Ny = z.object({
  kundeId: z.uuid(),
  utfort: z.string().trim().min(1, "Skriv hva som ble utført.").max(300),
  utfortDato: z.string().regex(ISO_DATO, "Utført dato må være en dato."),
  garantiUtloper: z.string().regex(ISO_DATO).nullish(),
  kontaktesEtter: z.string().regex(ISO_DATO).nullish(),
  anbefaling: z.string().trim().max(500).nullish(),
  prosjektId: z.uuid().nullish(),
});

export const POST = endepunkt(Ny, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const [rad] = await db
    .insert(garantier)
    .values({
      tenantId: okt.tenantId,
      kundeId: data.kundeId,
      prosjektId: data.prosjektId ?? null,
      utfort: data.utfort,
      utfortDato: data.utfortDato,
      garantiUtloper: data.garantiUtloper ?? null,
      kontaktesEtter: data.kontaktesEtter ?? null,
      anbefaling: data.anbefaling?.trim() || null,
    })
    .returning();

  await loggEndring(okt, {
    handling: "garanti.opprettet",
    tabell: "garantier",
    radId: rad?.id,
    etter: { utfort: data.utfort, kundeId: data.kundeId },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad?.id });
});

const Endre = z.object({
  id: z.uuid(),
  kontaktet: z.boolean().optional(),
  kontaktesEtter: z.string().regex(ISO_DATO).nullish(),
  anbefaling: z.string().trim().max(500).nullish(),
});

export const PATCH = endepunkt(Endre, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const rad = await db.query.garantier.findFirst({
    where: and(eq(garantier.id, data.id), eq(garantier.tenantId, okt.tenantId)),
  });
  if (!rad) return NextResponse.json({ feil: "Ukjent garanti." }, { status: 404 });

  const endringer: Record<string, unknown> = {};
  if (data.kontaktet !== undefined) endringer.kontaktet = data.kontaktet;
  if (data.kontaktesEtter !== undefined) endringer.kontaktesEtter = data.kontaktesEtter ?? null;
  if (data.anbefaling !== undefined) endringer.anbefaling = data.anbefaling?.trim() || null;

  if (Object.keys(endringer).length === 0) {
    return NextResponse.json({ feil: "Ingenting å endre." }, { status: 400 });
  }

  await db.update(garantier).set(endringer).where(eq(garantier.id, rad.id));

  await loggEndring(okt, {
    handling: "garanti.endret",
    tabell: "garantier",
    radId: rad.id,
    for: { kontaktet: rad.kontaktet, kontaktesEtter: rad.kontaktesEtter },
    etter: endringer,
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad.id });
});
