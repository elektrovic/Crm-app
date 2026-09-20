/**
 * Utfylt kontrollskjema — sluttkontroll, egenkontroll eller SJA,
 * avhengig av avdeling.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { prosjekter, skjemasvar } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";

const Skjema = z.object({
  klientNokkel: z.string().min(8).max(64),
  prosjektId: z.uuid(),
  skjemaNavn: z.string().min(1).max(200),
  svar: z
    .array(z.object({ sporsmal: z.string().min(1).max(500), svar: z.string().max(2000) }))
    .min(1)
    .max(50),
  beskrivelse: z.string().max(5000).nullish(),
});

export const POST = endepunkt(Skjema, async ({ okt, data, request }) => {
  const fraFor = await db.query.skjemasvar.findFirst({
    where: and(
      eq(skjemasvar.tenantId, okt.tenantId),
      eq(skjemasvar.klientNokkel, data.klientNokkel),
    ),
  });
  if (fraFor) return NextResponse.json({ id: fraFor.id, gjentakelse: true });

  const prosjekt = await db.query.prosjekter.findFirst({
    where: and(eq(prosjekter.id, data.prosjektId), eq(prosjekter.tenantId, okt.tenantId)),
  });
  if (!prosjekt) {
    return NextResponse.json({ feil: "Ukjent prosjekt." }, { status: 400 });
  }

  const [rad] = await db
    .insert(skjemasvar)
    .values({
      tenantId: okt.tenantId,
      prosjektId: prosjekt.id,
      ansattId: okt.id,
      skjemaNavn: data.skjemaNavn,
      svar: data.svar,
      beskrivelse: data.beskrivelse ?? null,
      fullfort: true,
      klientNokkel: data.klientNokkel,
    })
    .returning();

  await loggEndring(okt, {
    handling: "skjema.fullfort",
    tabell: "skjemasvar",
    radId: rad?.id,
    etter: { prosjekt: prosjekt.nummer, skjema: data.skjemaNavn, antallSvar: data.svar.length },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad?.id });
});
