/**
 * Henvendelser: registrer ny, og flytt mellom trinnene i pipelinen.
 *
 * Trinnet er det saksbehandleren har bestemt. AI-kolonnene røres ikke
 * herfra — de er et forslag, ikke en avgjørelse, og skal kunne
 * sammenlignes med hva mennesket faktisk valgte.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { ansatte, AVDELINGER, henvendelser, KANAL, PIPELINE } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { krevRolle } from "@/lib/tilgang";
import { loggEndring } from "@/lib/endringslogg";

const Ny = z.object({
  kanal: z.enum(KANAL),
  innhold: z.string().trim().min(1, "Skriv hva henvendelsen gjelder.").max(4000),
  avsenderNavn: z.string().trim().max(200).nullish(),
  avsenderTelefon: z.string().trim().max(40).nullish(),
  avsenderEpost: z.string().trim().max(200).nullish(),
  kundeId: z.uuid().nullish(),
  avdeling: z.enum(AVDELINGER).nullish(),
  sum: z.number().nonnegative().nullish(),
});

export const POST = endepunkt(Ny, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const [rad] = await db
    .insert(henvendelser)
    .values({
      tenantId: okt.tenantId,
      kanal: data.kanal,
      innhold: data.innhold,
      avsenderNavn: data.avsenderNavn ?? null,
      avsenderTelefon: data.avsenderTelefon ?? null,
      avsenderEpost: data.avsenderEpost ?? null,
      kundeId: data.kundeId ?? null,
      avdeling: data.avdeling ?? null,
      sum: data.sum === null || data.sum === undefined ? null : String(data.sum),
    })
    .returning();

  await loggEndring(okt, {
    handling: "henvendelse.opprettet",
    tabell: "henvendelser",
    radId: rad?.id,
    etter: { kanal: data.kanal, avdeling: data.avdeling },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad?.id });
});

const Endre = z.object({
  id: z.uuid(),
  trinn: z.enum(PIPELINE).optional(),
  ansvarlig: z.uuid().nullish(),
  avdeling: z.enum(AVDELINGER).nullish(),
  sum: z.number().nonnegative().nullish(),
});

export const PATCH = endepunkt(Endre, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const rad = await db.query.henvendelser.findFirst({
    where: and(eq(henvendelser.id, data.id), eq(henvendelser.tenantId, okt.tenantId)),
  });
  if (!rad) return NextResponse.json({ feil: "Ukjent henvendelse." }, { status: 404 });

  const endringer: Record<string, unknown> = {};
  if (data.trinn !== undefined) endringer.trinn = data.trinn;
  if (data.avdeling !== undefined) endringer.avdeling = data.avdeling ?? null;
  if (data.sum !== undefined) {
    endringer.sum = data.sum === null ? null : String(data.sum);
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

  await db.update(henvendelser).set(endringer).where(eq(henvendelser.id, rad.id));

  await loggEndring(okt, {
    handling: "henvendelse.endret",
    tabell: "henvendelser",
    radId: rad.id,
    for: { trinn: rad.trinn, ansvarlig: rad.ansvarlig, avdeling: rad.avdeling, sum: rad.sum },
    etter: endringer,
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad.id });
});
