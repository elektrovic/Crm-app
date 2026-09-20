/**
 * Manglende materiell på et prosjekt.
 *
 * POST legger til en linje (også fra sendekøen, derfor klientnøkkel).
 * PATCH krysser av for bestilt.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { mangler, prosjekter } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";

const NyLinje = z.object({
  klientNokkel: z.string().min(8).max(64),
  prosjektId: z.uuid(),
  tekst: z.string().min(1).max(500),
  antall: z.string().max(40).nullish(),
  /** EFO-nummer, når montøren har det. Gjør bestillingen entydig. */
  efoNummer: z.string().max(40).nullish(),
  enhet: z.enum(["STK", "M", "PK", "KG", "RL", "SET"]).default("STK"),
  /** Sant når linja ble snakket inn i stedet for skrevet. */
  taltInn: z.boolean().default(false),
});

export const POST = endepunkt(NyLinje, async ({ okt, data, request }) => {
  const prosjekt = await db.query.prosjekter.findFirst({
    where: and(eq(prosjekter.id, data.prosjektId), eq(prosjekter.tenantId, okt.tenantId)),
  });
  if (!prosjekt) {
    return NextResponse.json({ feil: "Ukjent prosjekt." }, { status: 400 });
  }

  const [rad] = await db
    .insert(mangler)
    .values({
      tenantId: okt.tenantId,
      prosjektId: prosjekt.id,
      tekst: data.tekst.trim(),
      antall: data.antall ?? null,
      efoNummer: data.efoNummer ?? null,
      enhet: data.enhet,
      taltInn: data.taltInn,
      lagtInnAv: okt.id,
    })
    .returning();

  await loggEndring(okt, {
    handling: "mangel.lagtTil",
    tabell: "mangler",
    radId: rad?.id,
    etter: { tekst: data.tekst, prosjekt: prosjekt.nummer },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad?.id });
});

const Avkryssing = z.object({
  id: z.uuid(),
  bestilt: z.boolean(),
});

export const PATCH = endepunkt(Avkryssing, async ({ okt, data, request }) => {
  const linje = await db.query.mangler.findFirst({
    where: and(eq(mangler.id, data.id), eq(mangler.tenantId, okt.tenantId)),
  });
  if (!linje) {
    return NextResponse.json({ feil: "Ukjent linje." }, { status: 404 });
  }

  await db
    .update(mangler)
    .set({
      bestilt: data.bestilt,
      bestiltTidspunkt: data.bestilt ? new Date() : null,
    })
    .where(eq(mangler.id, linje.id));

  await loggEndring(okt, {
    handling: data.bestilt ? "mangel.bestilt" : "mangel.gjenapnet",
    tabell: "mangler",
    radId: linje.id,
    for: { bestilt: linje.bestilt },
    etter: { bestilt: data.bestilt },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: linje.id, bestilt: data.bestilt });
});
